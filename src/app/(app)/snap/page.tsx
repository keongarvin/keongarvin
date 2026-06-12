"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLookups } from "@/lib/use-lookups";
import { downscaleImage } from "@/lib/downscale";
import { inputClass, LocationSelect, QuantityStepper } from "@/components/ItemForm";
import { locationPaths, type Location } from "@/lib/types";
import type { DetectionT } from "@/lib/ai/detected-item";

type Step = "capture" | "analyzing" | "review" | "saved";

type Draft = {
  key: number;
  name: string;
  quantity: number;
  category_id: string | null;
  location_id: string | null;
  person_id: string | null;
  notes: string | null;
  confidence: "high" | "medium" | "low";
};

function matchLocation(
  suggestion: string | null,
  locations: Location[],
  paths: Map<string, string>
): string | null {
  if (!suggestion) return null;
  const s = suggestion.trim().toLowerCase();
  for (const [id, path] of paths) {
    if (path.toLowerCase() === s) return id;
  }
  const byName = locations.find((l) => l.name.toLowerCase() === s);
  return byName?.id ?? null;
}

export default function SnapPage() {
  const { categories, locations, people } = useLookups();
  const paths = useMemo(() => locationPaths(locations), [locations]);
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("capture");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const keyCounter = useRef(0);

  async function handleFile(file: File) {
    setError(null);
    setStep("analyzing");
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const supabase = supabaseBrowser();
      const blob = await downscaleImage(file);
      const storagePath = `${crypto.randomUUID()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(storagePath, blob, { contentType: "image/jpeg" });
      if (uploadError) throw new Error(uploadError.message);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: photo, error: photoError } = await supabase
        .from("photos")
        .insert({ storage_path: storagePath, uploaded_by: user?.id ?? null })
        .select()
        .single();
      if (photoError || !photo) throw new Error(photoError?.message ?? "Photo insert failed");
      setPhotoId(photo.id);

      const res = await fetch("/api/analyze-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Photo analysis failed");
      }
      const detection = (await res.json()) as DetectionT;

      setDrafts(
        detection.items.map((d) => ({
          key: keyCounter.current++,
          name: d.name,
          quantity: Math.max(1, d.quantity),
          category_id:
            categories.find((c) => c.name.toLowerCase() === d.category.toLowerCase())?.id ??
            null,
          location_id: matchLocation(d.suggested_location, locations, paths),
          person_id:
            people.find((p) => p.name.toLowerCase() === (d.person ?? "").toLowerCase())?.id ??
            null,
          notes: d.notes,
          confidence: d.confidence,
        }))
      );
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("capture");
    }
  }

  function updateDraft(key: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  async function confirm() {
    if (!photoId) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const rows = drafts
        .filter((d) => d.name.trim())
        .map((d) => ({
          name: d.name.trim(),
          quantity: d.quantity,
          category_id: d.category_id,
          location_id: d.location_id ?? defaultLocationId,
          person_id: d.person_id,
          notes: d.notes,
        }));
      const { data: inserted, error: insertError } = await supabase
        .from("items")
        .insert(rows)
        .select("id");
      if (insertError || !inserted) throw new Error(insertError?.message ?? "Insert failed");

      const { error: linkError } = await supabase
        .from("item_photos")
        .insert(inserted.map((row) => ({ item_id: row.id, photo_id: photoId })));
      if (linkError) throw new Error(linkError.message);

      setStep("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setStep("capture");
    setError(null);
    setPreviewUrl(null);
    setPhotoId(null);
    setDrafts([]);
    setDefaultLocationId(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-pine-800">Snap</h1>

      {step === "capture" && (
        <>
          <p className="text-sm text-stone-500">
            Lay items out so they&apos;re visible, take one photo, and Claude will identify
            and catalog them for you to review.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-xl bg-pine-700 px-4 py-6 text-lg font-medium text-white"
          >
            📷 Take a photo
          </button>
        </>
      )}

      {step === "analyzing" && (
        <div className="flex flex-col items-center gap-4 py-8">
          {previewUrl && (
            <Image
              src={previewUrl}
              alt="Your photo"
              width={224}
              height={224}
              unoptimized
              className="h-56 w-56 rounded-xl object-cover opacity-70"
            />
          )}
          <p className="animate-pulse text-stone-500">Claude is identifying your stuff…</p>
        </div>
      )}

      {step === "review" && (
        <>
          <div className="flex items-center gap-3">
            {previewUrl && (
              <Image
                src={previewUrl}
                alt="Your photo"
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 rounded-lg object-cover"
              />
            )}
            <p className="text-sm text-stone-500">
              Found <strong>{drafts.length}</strong> item{drafts.length === 1 ? "" : "s"}.
              Edit anything that&apos;s off, then confirm.
            </p>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
            Where is this stuff going? (used when an item has no location)
            <LocationSelect
              locations={locations}
              value={defaultLocationId}
              onChange={setDefaultLocationId}
            />
          </label>

          {drafts.map((draft) => (
            <div
              key={draft.key}
              className={`flex flex-col gap-2 rounded-xl border bg-white p-3 ${
                draft.confidence === "low" ? "border-amber-300" : "border-stone-200"
              }`}
            >
              {draft.confidence === "low" && (
                <p className="text-xs font-medium text-amber-700">
                  ⚠️ Claude wasn&apos;t sure about this one
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={draft.name}
                  onChange={(e) => updateDraft(draft.key, { name: e.target.value })}
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => setDrafts((prev) => prev.filter((d) => d.key !== draft.key))}
                  className="px-2 text-stone-400"
                  aria-label={`Remove ${draft.name}`}
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <QuantityStepper
                  value={draft.quantity}
                  onChange={(n) => updateDraft(draft.key, { quantity: n })}
                />
                <select
                  value={draft.person_id ?? ""}
                  onChange={(e) =>
                    updateDraft(draft.key, { person_id: e.target.value || null })
                  }
                  className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm"
                >
                  <option value="">Whose?</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={draft.category_id ?? ""}
                  onChange={(e) =>
                    updateDraft(draft.key, { category_id: e.target.value || null })
                  }
                  className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm"
                >
                  <option value="">Category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <LocationSelect
                  locations={locations}
                  value={draft.location_id}
                  onChange={(id) => updateDraft(draft.key, { location_id: id })}
                />
              </div>
              {draft.notes && <p className="text-xs text-stone-400">{draft.notes}</p>}
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setDrafts((prev) => [
                ...prev,
                {
                  key: keyCounter.current++,
                  name: "",
                  quantity: 1,
                  category_id: null,
                  location_id: null,
                  person_id: null,
                  notes: null,
                  confidence: "high",
                },
              ])
            }
            className="rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500"
          >
            + Add another item
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={confirm}
            disabled={saving || drafts.length === 0}
            className="rounded-lg bg-pine-700 px-3 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : `Add ${drafts.length} item${drafts.length === 1 ? "" : "s"} to inventory`}
          </button>
          <button type="button" onClick={reset} className="text-sm text-stone-500">
            Start over
          </button>
        </>
      )}

      {step === "saved" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-3xl">✅</p>
          <p className="text-stone-600">Added to the inventory.</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-pine-700 px-4 py-2 font-medium text-white"
            >
              Snap another
            </button>
            <Link
              href="/"
              className="rounded-lg border border-stone-300 px-4 py-2 font-medium text-stone-600"
            >
              View inventory
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

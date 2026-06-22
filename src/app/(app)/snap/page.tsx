"use client";

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
  photoId: string;
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
  return locations.find((l) => l.name.toLowerCase() === s)?.id ?? null;
}

export default function SnapPage() {
  const { categories, locations, people } = useLookups();
  const paths = useMemo(() => locationPaths(locations), [locations]);
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("capture");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const keyCounter = useRef(0);

  async function processOne(file: File): Promise<Draft[]> {
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

    return detection.items.map((d) => ({
      key: keyCounter.current++,
      name: d.name,
      quantity: Math.max(1, d.quantity),
      category_id:
        categories.find((c) => c.name.toLowerCase() === d.category.toLowerCase())?.id ?? null,
      location_id: matchLocation(d.suggested_location, locations, paths),
      person_id:
        people.find((p) => p.name.toLowerCase() === (d.person ?? "").toLowerCase())?.id ?? null,
      notes: d.notes,
      confidence: d.confidence,
      photoId: photo.id,
    }));
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setStep("analyzing");
    setPhotoCount(files.length);
    setProgress({ done: 0, total: files.length });

    const collected: Draft[] = [];
    const failures: number[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        collected.push(...(await processOne(files[i])));
      } catch (err) {
        failures.push(i + 1);
        console.error("photo failed", err);
      }
      setProgress({ done: i + 1, total: files.length });
    }

    if (collected.length === 0) {
      setError(
        "Couldn't read any items from those photos. Try again, or add items manually from Inventory."
      );
      setStep("capture");
      return;
    }
    if (failures.length > 0) {
      setError(`${failures.length} photo(s) couldn't be analyzed and were skipped.`);
    }
    setDrafts(collected);
    setStep("review");
  }

  function updateDraft(key: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      const supabase = supabaseBrowser();
      const valid = drafts.filter((d) => d.name.trim());
      const rows = valid.map((d) => ({
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

      const links = inserted.map((row, i) => ({
        item_id: row.id,
        photo_id: valid[i].photoId,
      }));
      const { error: linkError } = await supabase.from("item_photos").insert(links);
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
    setProgress({ done: 0, total: 0 });
    setDrafts([]);
    setPhotoCount(0);
    setDefaultLocationId(null);
    if (cameraInput.current) cameraInput.current.value = "";
    if (uploadInput.current) uploadInput.current.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-pine-800">Add by photo</h1>

      {step === "capture" && (
        <>
          <p className="text-sm text-stone-500">
            Lay items out so they&apos;re visible. Take a new photo, or upload a batch you
            already have — Claude identifies the items in each and you review before saving.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFiles([file]);
            }}
          />
          <input
            ref={uploadInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) void handleFiles(files);
            }}
          />

          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="rounded-xl bg-pine-700 px-4 py-6 text-lg font-medium text-white"
          >
            📷 Take a photo
          </button>
          <button
            type="button"
            onClick={() => uploadInput.current?.click()}
            className="rounded-xl border border-pine-700 px-4 py-5 text-lg font-medium text-pine-700"
          >
            🖼️ Upload existing photos
          </button>
        </>
      )}

      {step === "analyzing" && (
        <div className="flex flex-col items-center gap-4 py-10">
          <p className="animate-pulse text-stone-500">
            Claude is identifying your stuff…
          </p>
          {progress.total > 1 && (
            <p className="text-sm text-stone-400">
              Photo {progress.done} of {progress.total}
            </p>
          )}
        </div>
      )}

      {step === "review" && (
        <>
          <p className="text-sm text-stone-500">
            Found <strong>{drafts.length}</strong> item{drafts.length === 1 ? "" : "s"} across{" "}
            {photoCount} photo{photoCount === 1 ? "" : "s"}. Fix anything that&apos;s off, fill
            in gaps, then confirm.
          </p>
          {error && <p className="text-sm text-amber-700">{error}</p>}

          <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
            Default location (used when an item has none)
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
                  placeholder="Item name"
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
                  onChange={(e) => updateDraft(draft.key, { person_id: e.target.value || null })}
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
                  onChange={(e) => updateDraft(draft.key, { category_id: e.target.value || null })}
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
                  photoId: prev[prev.length - 1]?.photoId ?? "",
                },
              ])
            }
            className="rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500"
          >
            + Add an item Claude missed
          </button>

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
              Add more
            </button>
            <Link
              href="/inventory"
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

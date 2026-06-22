"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLookups } from "@/lib/use-lookups";
import HealthBar from "@/components/HealthBar";
import { QuantityStepper, inputClass } from "@/components/ItemForm";
import { checklistCoverage, scopedItems } from "@/lib/checklist";
import { locationPaths, type Checklist, type ChecklistItem, type Item } from "@/lib/types";

export default function ChecklistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { categories, locations, people } = useLookups();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [entries, setEntries] = useState<ChecklistItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState(1);
  const [newCategory, setNewCategory] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    (async () => {
      const [clRes, ciRes, itemsRes] = await Promise.all([
        supabase.from("checklists").select("*").eq("id", id).single(),
        supabase.from("checklist_items").select("*").eq("checklist_id", id).order("sort_order"),
        supabase.from("items").select("*"),
      ]);
      setChecklist(clRes.data as Checklist | null);
      setEntries((ciRes.data ?? []) as ChecklistItem[]);
      setItems((itemsRes.data ?? []) as Item[]);
      setLoading(false);
    })();
  }, [id]);

  const inScope = useMemo(
    () => (checklist ? scopedItems(checklist, items, locations) : []),
    [checklist, items, locations]
  );
  const coverage = useMemo(() => checklistCoverage(entries, inScope), [entries, inScope]);
  const paths = useMemo(() => locationPaths(locations), [locations]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const maxOrder = Math.max(0, ...entries.map((en) => en.sort_order));
    const { data, error } = await supabaseBrowser()
      .from("checklist_items")
      .insert({
        checklist_id: id,
        name: newName.trim(),
        target_quantity: Math.max(1, newTarget),
        category_id: newCategory,
        sort_order: maxOrder + 1,
      })
      .select()
      .single();
    if (error || !data) {
      alert(error?.message ?? "Could not add");
      return;
    }
    setEntries((prev) => [...prev, data as ChecklistItem]);
    setNewName("");
    setNewTarget(1);
    setNewCategory(null);
  }

  async function updateTarget(entryId: string, target: number) {
    setEntries((prev) =>
      prev.map((en) => (en.id === entryId ? { ...en, target_quantity: target } : en))
    );
    await supabaseBrowser()
      .from("checklist_items")
      .update({ target_quantity: target })
      .eq("id", entryId);
  }

  async function removeEntry(entryId: string) {
    setEntries((prev) => prev.filter((en) => en.id !== entryId));
    await supabaseBrowser().from("checklist_items").delete().eq("id", entryId);
  }

  async function deleteChecklist() {
    if (!confirm(`Delete checklist "${checklist?.name}"? Items in inventory are unaffected.`))
      return;
    const { error } = await supabaseBrowser().from("checklists").delete().eq("id", id);
    if (error) return alert(error.message);
    router.push("/checklists");
  }

  if (loading) return <p className="py-8 text-center text-stone-400">Loading…</p>;
  if (!checklist) return <p className="py-8 text-center text-stone-400">Checklist not found.</p>;

  const scopeBits = [
    checklist.location_id ? paths.get(checklist.location_id) : null,
    checklist.person_id ? people.find((p) => p.id === checklist.person_id)?.name : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-pine-800">{checklist.name}</h1>
        {scopeBits.length > 0 && (
          <p className="text-xs text-stone-400">Scoped to {scopeBits.join(" · ")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-stone-600">Overall</span>
          <span className="text-lg font-semibold text-pine-800">{coverage.pct}%</span>
        </div>
        <HealthBar pct={coverage.pct} />
        <span className="text-xs text-stone-400">
          {coverage.haveCapped} of {coverage.targetTotal} covered
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {coverage.perEntry.map(({ entry, have, target, matched }) => {
          const pct = Math.round((Math.min(have, target) / target) * 100);
          return (
            <li
              key={entry.id}
              className="flex flex-col gap-1.5 rounded-xl border border-stone-200 bg-white p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{entry.name}</span>
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  className="px-1 text-stone-300"
                  aria-label={`Remove ${entry.name}`}
                >
                  ✕
                </button>
              </div>
              <HealthBar pct={pct} />
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs ${have >= target ? "text-pine-700" : "text-stone-500"}`}
                >
                  have {have} / need
                </span>
                <QuantityStepper
                  value={target}
                  onChange={(n) => updateTarget(entry.id, Math.max(1, n))}
                />
              </div>
              {matched.length > 0 && (
                <p className="text-xs text-stone-400">
                  Matches: {matched.map((m) => m.name).join(", ")}
                </p>
              )}
              {matched.length === 0 && (
                <p className="text-xs text-amber-600">
                  Nothing in inventory matches this name yet.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <form
        onSubmit={addEntry}
        className="flex flex-col gap-2 rounded-xl border border-dashed border-stone-300 p-3"
      >
        <p className="text-sm font-medium text-stone-600">Add something you want here</p>
        <input
          placeholder="e.g. T-shirts"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={inputClass}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-stone-500">Target count</span>
          <QuantityStepper value={newTarget} onChange={(n) => setNewTarget(Math.max(1, n))} />
        </div>
        <select
          value={newCategory ?? ""}
          onChange={(e) => setNewCategory(e.target.value || null)}
          className={inputClass}
        >
          <option value="">Any category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-pine-700 px-3 py-2 font-medium text-white">
          Add to checklist
        </button>
      </form>

      <button
        type="button"
        onClick={deleteChecklist}
        className="rounded-lg border border-red-200 px-3 py-2.5 font-medium text-red-600"
      >
        Delete checklist
      </button>
    </div>
  );
}

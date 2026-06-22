"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLookups } from "@/lib/use-lookups";
import HealthBar from "@/components/HealthBar";
import { inputClass, LocationSelect } from "@/components/ItemForm";
import { checklistCoverage, scopedItems } from "@/lib/checklist";
import type { Checklist, ChecklistItem, Item } from "@/lib/types";

export default function ChecklistsPage() {
  const { locations, people } = useLookups();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [entries, setEntries] = useState<ChecklistItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    (async () => {
      const [clRes, ciRes, itemsRes] = await Promise.all([
        supabase.from("checklists").select("*").order("sort_order"),
        supabase.from("checklist_items").select("*").order("sort_order"),
        supabase.from("items").select("*"),
      ]);
      setChecklists((clRes.data ?? []) as Checklist[]);
      setEntries((ciRes.data ?? []) as ChecklistItem[]);
      setItems((itemsRes.data ?? []) as Item[]);
      setLoading(false);
    })();
  }, []);

  const coverages = useMemo(
    () =>
      checklists.map((cl) => {
        const inScope = scopedItems(cl, items, locations);
        const clEntries = entries.filter((e) => e.checklist_id === cl.id);
        return { checklist: cl, coverage: checklistCoverage(clEntries, inScope) };
      }),
    [checklists, entries, items, locations]
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const { data, error } = await supabaseBrowser()
      .from("checklists")
      .insert({ name: name.trim(), location_id: locationId, person_id: personId })
      .select()
      .single();
    setCreating(false);
    if (error || !data) {
      alert(error?.message ?? "Could not create checklist");
      return;
    }
    setChecklists((prev) => [...prev, data as Checklist]);
    setName("");
    setLocationId(null);
    setPersonId(null);
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-pine-800">Checklists</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-pine-700 px-3 py-1.5 text-sm font-medium text-white"
        >
          + New
        </button>
      </div>

      <p className="text-sm text-stone-500">
        Define what you want at the cabin and see how close you are. Scope a checklist to a
        room or person and it only counts what&apos;s actually there.
      </p>

      {showForm && (
        <form
          onSubmit={create}
          className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-3"
        >
          <input
            required
            placeholder="Checklist name (e.g. Keon's closet)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <label className="text-xs font-medium text-stone-500">
            Limit to a location (optional)
            <LocationSelect locations={locations} value={locationId} onChange={setLocationId} />
          </label>
          <label className="text-xs font-medium text-stone-500">
            Limit to a person (optional)
            <select
              value={personId ?? ""}
              onChange={(e) => setPersonId(e.target.value || null)}
              className={inputClass}
            >
              <option value="">Anyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-pine-700 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            Create
          </button>
        </form>
      )}

      {loading ? (
        <p className="py-8 text-center text-stone-400">Loading…</p>
      ) : coverages.length === 0 ? (
        <p className="py-8 text-center text-stone-400">No checklists yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {coverages.map(({ checklist, coverage }) => (
            <li key={checklist.id}>
              <Link
                href={`/checklists/${checklist.id}`}
                className="flex flex-col gap-1.5 rounded-xl border border-stone-200 bg-white p-3"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{checklist.name}</span>
                  <span className="text-sm text-stone-500">{coverage.pct}%</span>
                </div>
                <HealthBar pct={coverage.pct} />
                <span className="text-xs text-stone-400">
                  {coverage.haveCapped} of {coverage.targetTotal} covered ·{" "}
                  {coverage.perEntry.length} item{coverage.perEntry.length === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { inputClass } from "@/components/ItemForm";
import { locationPaths, type Item, type Trip, type TripItemWithItem } from "@/lib/types";
import { useLookups } from "@/lib/use-lookups";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { locations } = useLookups();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [tripItems, setTripItems] = useState<TripItemWithItem[]>([]);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newAction, setNewAction] = useState<"pack" | "bring_home">("pack");
  const [cabinSearch, setCabinSearch] = useState("");
  const [completing, setCompleting] = useState(false);

  const paths = useMemo(() => locationPaths(locations), [locations]);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const [tripRes, tripItemsRes, inventoryRes] = await Promise.all([
        supabase.from("trips").select("*").eq("id", id).single(),
        supabase
          .from("trip_items")
          .select("*, item:items(*)")
          .eq("trip_id", id)
          .order("created_at"),
        supabase.from("items").select("*").order("name"),
      ]);
      setTrip(tripRes.data as Trip | null);
      setTripItems((tripItemsRes.data ?? []) as TripItemWithItem[]);
      setInventory((inventoryRes.data ?? []) as Item[]);
      setLoading(false);
    })();
  }, [id]);

  async function addEntry(itemId: string | null, label: string | null) {
    const { data, error } = await supabaseBrowser()
      .from("trip_items")
      .insert({ trip_id: id, item_id: itemId, label, action: newAction })
      .select("*, item:items(*)")
      .single();
    if (error || !data) {
      alert(error?.message ?? "Could not add");
      return;
    }
    setTripItems((prev) => [...prev, data as TripItemWithItem]);
  }

  async function toggleDone(entry: TripItemWithItem) {
    const done = !entry.done;
    setTripItems((prev) =>
      prev.map((t) => (t.id === entry.id ? { ...t, done } : t))
    );
    await supabaseBrowser().from("trip_items").update({ done }).eq("id", entry.id);
  }

  async function removeEntry(entryId: string) {
    setTripItems((prev) => prev.filter((t) => t.id !== entryId));
    await supabaseBrowser().from("trip_items").delete().eq("id", entryId);
  }

  async function completeTrip() {
    if (
      !confirm(
        "Complete this trip? Checked pack items will be added to the cabin inventory and checked bring-home items will be removed/decremented."
      )
    )
      return;
    setCompleting(true);
    const supabase = supabaseBrowser();
    try {
      for (const entry of tripItems.filter((t) => t.done)) {
        if (entry.action === "pack") {
          if (entry.item_id && entry.item) {
            await supabase
              .from("items")
              .update({
                quantity: entry.item.quantity + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", entry.item_id);
          } else if (entry.label) {
            await supabase.from("items").insert({ name: entry.label, quantity: 1 });
          }
        } else if (entry.action === "bring_home" && entry.item_id && entry.item) {
          const next = entry.item.quantity - 1;
          if (next <= 0) {
            await supabase.from("items").delete().eq("id", entry.item_id);
          } else {
            await supabase
              .from("items")
              .update({ quantity: next, updated_at: new Date().toISOString() })
              .eq("id", entry.item_id);
          }
        }
      }
      await supabase.from("trips").update({ status: "done" }).eq("id", id);
      router.push("/trips");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong");
      setCompleting(false);
    }
  }

  if (loading) return <p className="py-8 text-center text-stone-400">Loading…</p>;
  if (!trip) return <p className="py-8 text-center text-stone-400">Trip not found.</p>;

  const packItems = tripItems.filter((t) => t.action === "pack");
  const bringHomeItems = tripItems.filter((t) => t.action === "bring_home");
  const filteredInventory = cabinSearch.trim()
    ? inventory.filter((i) =>
        i.name.toLowerCase().includes(cabinSearch.trim().toLowerCase())
      )
    : inventory;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-pine-800">{trip.name}</h1>
          {trip.start_date && <p className="text-xs text-stone-400">{trip.start_date}</p>}
        </div>
        <span className="rounded-full bg-pine-100 px-2 py-0.5 text-xs font-medium capitalize text-pine-800">
          {trip.status}
        </span>
      </div>

      {trip.status !== "done" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newLabel.trim()) return;
            void addEntry(null, newLabel.trim());
            setNewLabel("");
          }}
          className="flex gap-2"
        >
          <input
            placeholder={newAction === "pack" ? "Something to pack…" : "Something to bring home…"}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <select
            value={newAction}
            onChange={(e) => setNewAction(e.target.value as "pack" | "bring_home")}
            className="rounded-lg border border-stone-300 bg-white px-2 text-sm"
          >
            <option value="pack">Pack</option>
            <option value="bring_home">Bring home</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-pine-700 px-3 font-medium text-white"
          >
            Add
          </button>
        </form>
      )}

      <Checklist
        title="🧳 Pack for the cabin"
        entries={packItems}
        readOnly={trip.status === "done"}
        onToggle={toggleDone}
        onRemove={removeEntry}
      />
      <Checklist
        title="🏠 Bring back home"
        entries={bringHomeItems}
        readOnly={trip.status === "done"}
        onToggle={toggleDone}
        onRemove={removeEntry}
      />

      {trip.status !== "done" && (
        <button
          type="button"
          onClick={completeTrip}
          disabled={completing}
          className="rounded-lg border border-pine-700 px-3 py-2.5 font-medium text-pine-700 disabled:opacity-50"
        >
          {completing ? "Completing…" : "Complete trip"}
        </button>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-stone-500">
          Already at the cabin ({inventory.length} items) — don&apos;t pack these
        </h2>
        <input
          type="search"
          placeholder="Search what's there…"
          value={cabinSearch}
          onChange={(e) => setCabinSearch(e.target.value)}
          className={inputClass}
        />
        <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200 bg-white">
          {filteredInventory.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {item.name}
                  {item.quantity !== 1 && (
                    <span className="ml-1 text-xs text-stone-400">×{item.quantity}</span>
                  )}
                </p>
                {item.location_id && (
                  <p className="truncate text-xs text-stone-400">
                    {paths.get(item.location_id)}
                  </p>
                )}
              </div>
              {trip.status !== "done" && (
                <button
                  type="button"
                  onClick={() => void addEntry(item.id, item.name)}
                  className="whitespace-nowrap rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500"
                  title="Add to this trip's list (e.g. to top up or bring home)"
                >
                  + list
                </button>
              )}
            </li>
          ))}
          {filteredInventory.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-stone-400">
              Nothing matches.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Checklist({
  title,
  entries,
  readOnly,
  onToggle,
  onRemove,
}: {
  title: string;
  entries: TripItemWithItem[];
  readOnly: boolean;
  onToggle: (entry: TripItemWithItem) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-stone-500">{title}</h2>
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 px-3 py-3 text-sm text-stone-400">
          Nothing here yet.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
              <input
                type="checkbox"
                checked={entry.done}
                disabled={readOnly}
                onChange={() => onToggle(entry)}
                className="h-5 w-5 accent-pine-700"
              />
              <span
                className={`flex-1 ${entry.done ? "text-stone-400 line-through" : ""}`}
              >
                {entry.label ?? entry.item?.name ?? "(deleted item)"}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  className="px-1 text-stone-300"
                  aria-label="Remove"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

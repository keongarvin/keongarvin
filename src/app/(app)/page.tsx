"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import HealthBar from "@/components/HealthBar";
import { checklistCoverage, scopedItems } from "@/lib/checklist";
import {
  locationPaths,
  type Checklist,
  type ChecklistItem,
  type ItemWithRelations,
  type Location,
} from "@/lib/types";

function needsAttention(item: ItemWithRelations): boolean {
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const expiring = item.expiry_date !== null && new Date(item.expiry_date) <= soon;
  const low = item.restock_below !== null && item.quantity <= item.restock_below;
  return expiring || low;
}

export default function DashboardPage() {
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [entries, setEntries] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = supabaseBrowser();
    (async () => {
      const [itemsRes, locsRes, clRes, ciRes] = await Promise.all([
        supabase
          .from("items")
          .select("*, category:categories(*), location:locations(*), person:people(*), item_photos(photo:photos(*))")
          .order("name"),
        supabase.from("locations").select("*"),
        supabase.from("checklists").select("*").order("sort_order"),
        supabase.from("checklist_items").select("*").order("sort_order"),
      ]);
      setItems((itemsRes.data ?? []) as ItemWithRelations[]);
      setLocations((locsRes.data ?? []) as Location[]);
      setChecklists((clRes.data ?? []) as Checklist[]);
      setEntries((ciRes.data ?? []) as ChecklistItem[]);
      setLoading(false);
    })();
  }, []);

  const paths = useMemo(() => locationPaths(locations), [locations]);

  const stats = useMemo(() => {
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const photographed = items.filter((i) => i.item_photos.length > 0).length;
    const attention = items.filter(needsAttention);
    return { count: items.length, totalQty, photographed, attention };
  }, [items]);

  const coverages = useMemo(
    () =>
      checklists.map((cl) => {
        const inScope = scopedItems(cl, items, locations);
        const clEntries = entries.filter((e) => e.checklist_id === cl.id);
        return { checklist: cl, coverage: checklistCoverage(clEntries, inScope) };
      }),
    [checklists, entries, items, locations]
  );

  if (loading) return <p className="py-8 text-center text-stone-400">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-pine-800">Cabin at a glance</h1>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Items" value={stats.count} />
        <Stat label="Total quantity" value={stats.totalQty} />
        <Stat label="Photographed" value={stats.photographed} />
        <Stat label="Needs attention" value={stats.attention.length} highlight={stats.attention.length > 0} />
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-500">Completeness</h2>
          <Link href="/checklists" className="text-sm font-medium text-pine-700">
            Manage
          </Link>
        </div>
        {coverages.length === 0 ? (
          <Link
            href="/checklists"
            className="rounded-xl border border-dashed border-stone-300 px-3 py-4 text-center text-sm text-stone-500"
          >
            + Create a checklist (e.g. &quot;Keon&apos;s closet&quot;) to track what you have vs. need
          </Link>
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
                    {coverage.haveCapped} of {coverage.targetTotal} covered
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {stats.attention.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-stone-500">Expiring or low stock</h2>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {stats.attention.map((item) => (
              <li key={item.id}>
                <Link href={`/items/${item.id}`} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.expiry_date && (
                    <span className="whitespace-nowrap text-xs text-amber-700">
                      exp {item.expiry_date}
                    </span>
                  )}
                  {item.restock_below !== null && item.quantity <= item.restock_below && (
                    <span className="whitespace-nowrap text-xs text-red-600">
                      ×{item.quantity} low
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-stone-500">Jump in</h2>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/snap" className="rounded-xl bg-pine-700 px-3 py-4 text-center font-medium text-white">
            📷 Add by photo
          </Link>
          <Link
            href="/inventory"
            className="rounded-xl border border-stone-300 bg-white px-3 py-4 text-center font-medium text-stone-700"
          >
            📦 Browse all
          </Link>
        </div>
      </section>

      <p className="px-1 text-xs text-stone-400">
        {paths.size} locations · tap Inventory to search and filter everything.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"
      }`}
    >
      <p className="text-2xl font-semibold text-pine-800">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}

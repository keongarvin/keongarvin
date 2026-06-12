"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLookups } from "@/lib/use-lookups";
import { inputClass } from "@/components/ItemForm";
import {
  locationPaths,
  locationSubtree,
  locationTreeOrder,
  type ItemWithRelations,
  type Location,
} from "@/lib/types";

type GroupBy = "location" | "category" | "person";

function needsAttention(item: ItemWithRelations): boolean {
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const expiring =
    item.expiry_date !== null && new Date(item.expiry_date) <= soon;
  const low = item.restock_below !== null && item.quantity <= item.restock_below;
  return expiring || low;
}

export default function InventoryPage() {
  const { categories, locations, people } = useLookups();
  const [items, setItems] = useState<ItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());

  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("location");

  useEffect(() => {
    const supabase = supabaseBrowser();
    (async () => {
      const { data } = await supabase
        .from("items")
        .select(
          "*, category:categories(*), location:locations(*), person:people(*), item_photos(photo:photos(*))"
        )
        .order("name");
      const rows = (data ?? []) as ItemWithRelations[];
      setItems(rows);
      setLoading(false);

      // Signed thumbnail URL for the first photo of each photographed item.
      const wanted = rows
        .map((item) => ({ item, photo: item.item_photos[0]?.photo }))
        .filter((x) => x.photo);
      if (wanted.length > 0) {
        const { data: signed } = await supabase.storage
          .from("photos")
          .createSignedUrls(
            wanted.map((w) => w.photo!.storage_path),
            3600
          );
        if (signed) {
          const map = new Map<string, string>();
          signed.forEach((s, i) => {
            if (s.signedUrl) map.set(wanted[i].item.id, s.signedUrl);
          });
          setThumbs(map);
        }
      }
    })();
  }, []);

  const paths = useMemo(() => locationPaths(locations), [locations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const subtree = locationId ? locationSubtree(locations, locationId) : null;
    return items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q) && !(item.notes ?? "").toLowerCase().includes(q))
        return false;
      if (subtree && (!item.location_id || !subtree.has(item.location_id))) return false;
      if (categoryId && item.category_id !== categoryId) return false;
      if (personId && item.person_id !== personId) return false;
      if (attentionOnly && !needsAttention(item)) return false;
      return true;
    });
  }, [items, search, locationId, categoryId, personId, attentionOnly, locations]);

  const groups = useMemo(() => {
    const map = new Map<string, ItemWithRelations[]>();
    for (const item of filtered) {
      let key: string;
      if (groupBy === "location") {
        key = item.location_id ? paths.get(item.location_id) ?? "Unknown" : "No location";
      } else if (groupBy === "category") {
        key = item.category?.name ?? "No category";
      } else {
        key = item.person?.name ?? "—";
      }
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy, paths]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-pine-800">Inventory</h1>
        <Link
          href="/items/new"
          className="rounded-lg bg-pine-700 px-3 py-1.5 text-sm font-medium text-white"
        >
          + Add item
        </Link>
      </div>

      <input
        type="search"
        placeholder="Search items…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={inputClass}
      />

      <div className="grid grid-cols-2 gap-2">
        <LocationSelectFilter
          locations={locations}
          value={locationId}
          onChange={setLocationId}
        />
        <select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value || null)}
          className={inputClass}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={personId ?? ""}
          onChange={(e) => setPersonId(e.target.value || null)}
          className={inputClass}
        >
          <option value="">Everyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAttentionOnly((v) => !v)}
          className={`rounded-lg border px-3 py-2.5 text-sm ${
            attentionOnly
              ? "border-amber-400 bg-amber-50 font-medium text-amber-800"
              : "border-stone-300 bg-white text-stone-600"
          }`}
        >
          ⚠️ Expiring / low
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm text-stone-500">
        <span>Group by</span>
        {(["location", "category", "person"] as GroupBy[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroupBy(g)}
            className={`rounded-full px-3 py-1 capitalize ${
              groupBy === g ? "bg-pine-100 font-medium text-pine-800" : "bg-stone-100"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-stone-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-stone-400">
          {items.length === 0
            ? "Nothing cataloged yet. Add an item or snap a photo."
            : "No items match these filters."}
        </p>
      ) : (
        groups.map(([groupName, groupItems]) => (
          <section key={groupName}>
            <h2 className="mb-1 mt-2 text-sm font-semibold text-stone-500">
              {groupName}{" "}
              <span className="font-normal text-stone-400">({groupItems.length})</span>
            </h2>
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
              {groupItems.map((item) => (
                <li key={item.id}>
                  <Link href={`/items/${item.id}`} className="flex items-center gap-3 px-3 py-2.5">
                    {thumbs.has(item.id) ? (
                      <Image
                        src={thumbs.get(item.id)!}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-300">
                        📦
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {item.name}
                        {needsAttention(item) && <span className="ml-1">⚠️</span>}
                      </p>
                      <p className="truncate text-xs text-stone-400">
                        {[
                          item.location_id ? paths.get(item.location_id) : null,
                          item.person?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ") || item.category?.name || ""}
                      </p>
                    </div>
                    {item.quantity !== 1 && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                        ×{item.quantity}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function LocationSelectFilter({
  locations,
  value,
  onChange,
}: {
  locations: Location[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  // Same indented tree as the form picker but with an "All locations" label.
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={inputClass}
    >
      <option value="">All locations</option>
      {locationTreeOrder(locations).map(({ location, depth }) => (
        <option key={location.id} value={location.id}>
          {" ".repeat(depth * 3)}
          {location.name}
        </option>
      ))}
    </select>
  );
}

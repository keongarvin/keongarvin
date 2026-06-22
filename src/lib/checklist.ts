import {
  locationSubtree,
  type ChecklistItem,
  type Checklist,
  type Item,
  type Location,
} from "@/lib/types";

/** Does an inventory item satisfy a checklist entry? Case-insensitive, either
 *  direction (so entry "t-shirt" matches item "Blue t-shirt", and entry
 *  "wool ski socks" matches item "ski socks"). Short tokens only match exactly. */
export function itemMatchesEntry(itemName: string, entryName: string): boolean {
  const a = itemName.toLowerCase().trim();
  const b = entryName.toLowerCase().trim();
  if (!b) return false;
  if (a === b) return true;
  if (b.length >= 3 && a.includes(b)) return true;
  if (a.length >= 3 && b.includes(a)) return true;
  return false;
}

/** Inventory items in scope for a checklist (filtered by its location subtree
 *  and/or person, if set). */
export function scopedItems(
  checklist: Checklist,
  items: Item[],
  locations: Location[]
): Item[] {
  const subtree = checklist.location_id
    ? locationSubtree(locations, checklist.location_id)
    : null;
  return items.filter((item) => {
    if (subtree && (!item.location_id || !subtree.has(item.location_id))) return false;
    if (checklist.person_id && item.person_id !== checklist.person_id) return false;
    return true;
  });
}

export type EntryCoverage = {
  entry: ChecklistItem;
  have: number;
  target: number;
  matched: Item[];
};

export type ChecklistCoverage = {
  perEntry: EntryCoverage[];
  haveCapped: number; // sum of min(have, target)
  targetTotal: number;
  pct: number; // 0–100
};

/** Compute coverage for a checklist's entries against the in-scope inventory. */
export function checklistCoverage(
  entries: ChecklistItem[],
  inScope: Item[]
): ChecklistCoverage {
  const perEntry = entries.map((entry) => {
    const matched = inScope.filter(
      (item) =>
        itemMatchesEntry(item.name, entry.name) &&
        (entry.category_id === null || item.category_id === entry.category_id)
    );
    const have = matched.reduce((sum, item) => sum + item.quantity, 0);
    return { entry, have, target: Math.max(1, entry.target_quantity), matched };
  });

  const haveCapped = perEntry.reduce((s, e) => s + Math.min(e.have, e.target), 0);
  const targetTotal = perEntry.reduce((s, e) => s + e.target, 0);
  const pct = targetTotal === 0 ? 0 : Math.round((haveCapped / targetTotal) * 100);
  return { perEntry, haveCapped, targetTotal, pct };
}

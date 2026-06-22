export type Person = {
  id: string;
  name: string;
};

export type Category = {
  id: string;
  name: string;
  sort_order: number;
};

export type Location = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

export type Item = {
  id: string;
  name: string;
  notes: string | null;
  quantity: number;
  category_id: string | null;
  location_id: string | null;
  person_id: string | null;
  expiry_date: string | null;
  restock_below: number | null;
  created_at: string;
  updated_at: string;
};

export type Photo = {
  id: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
};

export type ItemWithRelations = Item & {
  category: Category | null;
  location: Location | null;
  person: Person | null;
  item_photos: { photo: Photo }[];
};

export type Trip = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: "planning" | "active" | "done";
  created_at: string;
};

export type TripItem = {
  id: string;
  trip_id: string;
  item_id: string | null;
  label: string | null;
  action: "pack" | "bring_home";
  done: boolean;
  created_at: string;
};

export type TripItemWithItem = TripItem & {
  item: Item | null;
};

export type Checklist = {
  id: string;
  name: string;
  location_id: string | null;
  person_id: string | null;
  sort_order: number;
  created_at: string;
};

export type ChecklistItem = {
  id: string;
  checklist_id: string;
  name: string;
  target_quantity: number;
  category_id: string | null;
  sort_order: number;
  created_at: string;
};

/** Build "Floor › Room › Area" breadcrumbs for every location. */
export function locationPaths(locations: Location[]): Map<string, string> {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const paths = new Map<string, string>();
  for (const loc of locations) {
    const parts: string[] = [];
    let cur: Location | undefined = loc;
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    paths.set(loc.id, parts.join(" › "));
  }
  return paths;
}

/** All descendant location ids of `rootId`, including itself. */
export function locationSubtree(locations: Location[], rootId: string): Set<string> {
  const children = new Map<string | null, Location[]>();
  for (const loc of locations) {
    const list = children.get(loc.parent_id) ?? [];
    list.push(loc);
    children.set(loc.parent_id, list);
  }
  const result = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    result.add(id);
    for (const child of children.get(id) ?? []) stack.push(child.id);
  }
  return result;
}

/** Locations sorted depth-first with their depth, for indented pickers. */
export function locationTreeOrder(
  locations: Location[]
): { location: Location; depth: number }[] {
  const children = new Map<string | null, Location[]>();
  for (const loc of locations) {
    const list = children.get(loc.parent_id) ?? [];
    list.push(loc);
    children.set(loc.parent_id, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }
  const out: { location: Location; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const loc of children.get(parentId) ?? []) {
      out.push({ location: loc, depth });
      walk(loc.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

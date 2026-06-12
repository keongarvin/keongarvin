"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Category, Location, Person } from "@/lib/types";

export type Lookups = {
  categories: Category[];
  locations: Location[];
  people: Person[];
  loading: boolean;
  refresh: () => void;
};

export function useLookups(): Lookups {
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();
    (async () => {
      const [cats, locs, ppl] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("locations").select("*").order("sort_order"),
        supabase.from("people").select("*").order("name"),
      ]);
      if (cancelled) return;
      setCategories((cats.data ?? []) as Category[]);
      setLocations((locs.data ?? []) as Location[]);
      setPeople((ppl.data ?? []) as Person[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { categories, locations, people, loading, refresh: () => setTick((t) => t + 1) };
}

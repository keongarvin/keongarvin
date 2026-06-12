"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLookups } from "@/lib/use-lookups";
import { inputClass } from "@/components/ItemForm";
import { locationTreeOrder } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const { categories, locations, people, loading, refresh } = useLookups();
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationParent, setNewLocationParent] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [newPerson, setNewPerson] = useState("");

  const supabase = supabaseBrowser;

  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!newLocationName.trim()) return;
    const { error } = await supabase()
      .from("locations")
      .insert({ name: newLocationName.trim(), parent_id: newLocationParent });
    if (error) return alert(error.message);
    setNewLocationName("");
    refresh();
  }

  async function deleteLocation(id: string, name: string) {
    if (!confirm(`Delete "${name}" and everything nested under it? Items there keep existing but lose their location.`))
      return;
    const { error } = await supabase().from("locations").delete().eq("id", id);
    if (error) return alert(error.message);
    refresh();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    const maxOrder = Math.max(0, ...categories.map((c) => c.sort_order));
    const { error } = await supabase()
      .from("categories")
      .insert({ name: newCategory.trim(), sort_order: maxOrder + 1 });
    if (error) return alert(error.message);
    setNewCategory("");
    refresh();
  }

  async function deleteCategory(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? Items keep existing without it.`)) return;
    const { error } = await supabase().from("categories").delete().eq("id", id);
    if (error) return alert(error.message);
    refresh();
  }

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!newPerson.trim()) return;
    const { error } = await supabase().from("people").insert({ name: newPerson.trim() });
    if (error) return alert(error.message);
    setNewPerson("");
    refresh();
  }

  async function deletePerson(id: string, name: string) {
    if (!confirm(`Remove "${name}"? Their items keep existing without an owner.`)) return;
    const { error } = await supabase().from("people").delete().eq("id", id);
    if (error) return alert(error.message);
    refresh();
  }

  async function signOut() {
    await supabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) return <p className="py-8 text-center text-stone-400">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-pine-800">Settings</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-stone-500">Locations</h2>
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {locationTreeOrder(locations).map(({ location, depth }) => (
            <li
              key={location.id}
              className="flex items-center gap-2 px-3 py-2 text-sm"
              style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
            >
              <span className="flex-1">{location.name}</span>
              <button
                type="button"
                onClick={() => deleteLocation(location.id, location.name)}
                className="px-1 text-stone-300"
                aria-label={`Delete ${location.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addLocation} className="flex gap-2">
          <input
            placeholder="New location…"
            value={newLocationName}
            onChange={(e) => setNewLocationName(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <select
            value={newLocationParent ?? ""}
            onChange={(e) => setNewLocationParent(e.target.value || null)}
            className="max-w-36 rounded-lg border border-stone-300 bg-white px-2 text-sm"
          >
            <option value="">Top level</option>
            {locationTreeOrder(locations).map(({ location, depth }) => (
              <option key={location.id} value={location.id}>
                {" ".repeat(depth * 3)}
                {location.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-pine-700 px-3 font-medium text-white">
            Add
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-stone-500">Categories</h2>
        <ul className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm shadow-sm ring-1 ring-stone-200"
            >
              {c.name}
              <button
                type="button"
                onClick={() => deleteCategory(c.id, c.name)}
                className="text-stone-300"
                aria-label={`Delete ${c.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addCategory} className="flex gap-2">
          <input
            placeholder="New category…"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className="rounded-lg bg-pine-700 px-3 font-medium text-white">
            Add
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-stone-500">People</h2>
        <ul className="flex flex-wrap gap-2">
          {people.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm shadow-sm ring-1 ring-stone-200"
            >
              {p.name}
              <button
                type="button"
                onClick={() => deletePerson(p.id, p.name)}
                className="text-stone-300"
                aria-label={`Delete ${p.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addPerson} className="flex gap-2">
          <input
            placeholder="New person…"
            value={newPerson}
            onChange={(e) => setNewPerson(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className="rounded-lg bg-pine-700 px-3 font-medium text-white">
            Add
          </button>
        </form>
      </section>

      <button
        type="button"
        onClick={signOut}
        className="rounded-lg border border-stone-300 px-3 py-2.5 font-medium text-stone-600"
      >
        Sign out
      </button>
    </div>
  );
}

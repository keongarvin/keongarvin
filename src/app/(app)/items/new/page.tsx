"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLookups } from "@/lib/use-lookups";
import ItemForm, { type ItemFormValues } from "@/components/ItemForm";

export default function NewItemPage() {
  const router = useRouter();
  const { categories, locations, people, loading } = useLookups();

  async function create(values: ItemFormValues) {
    const { error } = await supabaseBrowser().from("items").insert(values);
    if (error) throw new Error(error.message);
    router.push("/");
  }

  if (loading) return <p className="py-8 text-center text-stone-400">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-pine-800">Add item</h1>
      <ItemForm
        initial={{
          name: "",
          quantity: 1,
          category_id: null,
          location_id: null,
          person_id: people.find((p) => p.name === "Shared")?.id ?? null,
          expiry_date: null,
          restock_below: null,
          notes: null,
        }}
        categories={categories}
        locations={locations}
        people={people}
        submitLabel="Add item"
        onSubmit={create}
      />
    </div>
  );
}

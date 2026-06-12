"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useLookups } from "@/lib/use-lookups";
import ItemForm, { type ItemFormValues } from "@/components/ItemForm";
import type { ItemWithRelations } from "@/lib/types";

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { categories, locations, people, loading: lookupsLoading } = useLookups();
  const [item, setItem] = useState<ItemWithRelations | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = supabaseBrowser();
    (async () => {
      const { data } = await supabase
        .from("items")
        .select(
          "*, category:categories(*), location:locations(*), person:people(*), item_photos(photo:photos(*))"
        )
        .eq("id", id)
        .single();
      const row = data as ItemWithRelations | null;
      setItem(row);
      setLoading(false);
      if (row && row.item_photos.length > 0) {
        const { data: signed } = await supabase.storage
          .from("photos")
          .createSignedUrls(
            row.item_photos.map((ip) => ip.photo.storage_path),
            3600
          );
        setPhotoUrls((signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[]);
      }
    })();
  }, [id]);

  async function save(values: ItemFormValues) {
    const { error } = await supabaseBrowser()
      .from("items")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    router.push("/");
  }

  async function remove() {
    if (!confirm(`Delete "${item?.name}"?`)) return;
    const { error } = await supabaseBrowser().from("items").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    router.push("/");
  }

  if (loading || lookupsLoading)
    return <p className="py-8 text-center text-stone-400">Loading…</p>;
  if (!item) return <p className="py-8 text-center text-stone-400">Item not found.</p>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-pine-800">{item.name}</h1>

      {photoUrls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {photoUrls.map((url) => (
            <Image
              key={url}
              src={url}
              alt={item.name}
              width={144}
              height={144}
              unoptimized
              className="h-36 w-36 flex-shrink-0 rounded-xl object-cover"
            />
          ))}
        </div>
      )}

      <ItemForm
        initial={{
          name: item.name,
          quantity: item.quantity,
          category_id: item.category_id,
          location_id: item.location_id,
          person_id: item.person_id,
          expiry_date: item.expiry_date,
          restock_below: item.restock_below,
          notes: item.notes,
        }}
        categories={categories}
        locations={locations}
        people={people}
        submitLabel="Save changes"
        onSubmit={save}
      />

      <button
        type="button"
        onClick={remove}
        className="rounded-lg border border-red-200 px-3 py-2.5 font-medium text-red-600"
      >
        Delete item
      </button>
    </div>
  );
}

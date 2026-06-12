"use client";

import { useState } from "react";
import { locationTreeOrder, type Category, type Location, type Person } from "@/lib/types";

export type ItemFormValues = {
  name: string;
  quantity: number;
  category_id: string | null;
  location_id: string | null;
  person_id: string | null;
  expiry_date: string | null;
  restock_below: number | null;
  notes: string | null;
};

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base";

export function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-10 w-10 rounded-lg border border-stone-300 bg-white text-xl leading-none"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="min-w-8 text-center text-lg font-medium">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="h-10 w-10 rounded-lg border border-stone-300 bg-white text-xl leading-none"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

export function LocationSelect({
  locations,
  value,
  onChange,
  allowEmpty = true,
}: {
  locations: Location[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowEmpty?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={inputClass}
    >
      {allowEmpty && <option value="">No location</option>}
      {locationTreeOrder(locations).map(({ location, depth }) => (
        <option key={location.id} value={location.id}>
          {" ".repeat(depth * 3)}
          {location.name}
        </option>
      ))}
    </select>
  );
}

export default function ItemForm({
  initial,
  categories,
  locations,
  people,
  submitLabel,
  onSubmit,
}: {
  initial: ItemFormValues;
  categories: Category[];
  locations: Location[];
  people: Person[];
  submitLabel: string;
  onSubmit: (values: ItemFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ItemFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ItemFormValues>(key: K, v: ItemFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...values, name: values.name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
        Name
        <input
          required
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="flex flex-col gap-1 text-sm font-medium text-stone-600">
        Quantity
        <QuantityStepper value={values.quantity} onChange={(n) => set("quantity", n)} />
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
        Category
        <select
          value={values.category_id ?? ""}
          onChange={(e) => set("category_id", e.target.value || null)}
          className={inputClass}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
        Location
        <LocationSelect
          locations={locations}
          value={values.location_id}
          onChange={(id) => set("location_id", id)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
        Whose is it?
        <select
          value={values.person_id ?? ""}
          onChange={(e) => set("person_id", e.target.value || null)}
          className={inputClass}
        >
          <option value="">—</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          Expiry date
          <input
            type="date"
            value={values.expiry_date ?? ""}
            onChange={(e) => set("expiry_date", e.target.value || null)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          Restock below
          <input
            type="number"
            min={0}
            value={values.restock_below ?? ""}
            onChange={(e) =>
              set("restock_below", e.target.value === "" ? null : Number(e.target.value))
            }
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
        Notes
        <textarea
          rows={2}
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value || null)}
          className={inputClass}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-pine-700 px-3 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

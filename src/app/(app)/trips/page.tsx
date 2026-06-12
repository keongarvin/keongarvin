"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { inputClass } from "@/components/ItemForm";
import type { Trip } from "@/lib/types";

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser()
        .from("trips")
        .select("*")
        .order("created_at", { ascending: false });
      setTrips((data ?? []) as Trip[]);
      setLoading(false);
    })();
  }, []);

  async function createTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const { data, error } = await supabaseBrowser()
      .from("trips")
      .insert({ name: name.trim(), start_date: startDate || null })
      .select()
      .single();
    setCreating(false);
    if (error || !data) {
      alert(error?.message ?? "Could not create trip");
      return;
    }
    setTrips((prev) => [data as Trip, ...prev]);
    setName("");
    setStartDate("");
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-pine-800">Trips</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-pine-700 px-3 py-1.5 text-sm font-medium text-white"
        >
          + New trip
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={createTrip}
          className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-3"
        >
          <input
            required
            placeholder="Trip name (e.g. July 4th weekend)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-pine-700 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            Create trip
          </button>
        </form>
      )}

      {loading ? (
        <p className="py-8 text-center text-stone-400">Loading…</p>
      ) : trips.length === 0 ? (
        <p className="py-8 text-center text-stone-400">
          No trips yet. Create one to start a packing list.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link href={`/trips/${trip.id}`} className="flex items-center gap-3 px-3 py-3">
                <span className="text-lg">🧳</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{trip.name}</p>
                  {trip.start_date && (
                    <p className="text-xs text-stone-400">{trip.start_date}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    trip.status === "done"
                      ? "bg-stone-100 text-stone-500"
                      : "bg-pine-100 text-pine-800"
                  }`}
                >
                  {trip.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

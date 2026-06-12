import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Hit daily by Vercel Cron (see vercel.json) so the Supabase free-tier
// project never pauses for inactivity. The query is read-only and returns
// nothing to anonymous callers (RLS), but it counts as database activity.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error } = await supabase.from("categories").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { Detection } from "@/lib/ai/detected-item";
import { locationPaths, type Category, type Location, type Person } from "@/lib/types";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are cataloging items at a family vacation cabin from a single photo. The owners lay items out (on a bed, counter, or shelf) and photograph them so the app can inventory what is kept at the cabin.

Identify each distinct physical item in the photo:
- Merge identical items into one entry with a quantity (e.g. 4 cans of the same beer -> one entry, quantity 4).
- Use only the category names provided in the user message. If nothing fits, use "Other".
- Suggest a location only if the photo's setting clearly matches one of the known locations provided; otherwise use null.
- Set person only when there is an obvious cue (e.g. clearly sized/styled clothing belonging to one person named in the list); otherwise null.
- Skip fixtures, furniture, and background surfaces (the bed or counter the items sit on is not an item).
- Put brand, size, or flavor details in notes when legible.
- Use confidence "low" when you are unsure what an item is.`;

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { storagePath } = (await request.json()) as { storagePath?: string };
  if (!storagePath) {
    return NextResponse.json({ error: "storagePath is required" }, { status: 400 });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from("photos")
    .download(storagePath);
  if (downloadError || !file) {
    return NextResponse.json({ error: "Could not read photo" }, { status: 400 });
  }
  const imageB64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const [{ data: categories }, { data: locations }, { data: people }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("locations").select("*"),
    supabase.from("people").select("*"),
  ]);
  const categoryNames = ((categories ?? []) as Category[]).map((c) => c.name);
  const paths = [...locationPaths((locations ?? []) as Location[]).values()];
  const peopleNames = ((people ?? []) as Person[]).map((p) => p.name);

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: imageB64 },
            },
            {
              type: "text",
              text: `Categories: ${categoryNames.join(", ")}\nKnown locations: ${paths.join("; ")}\nPeople: ${peopleNames.join(", ")}`,
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(Detection) },
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json(
        { error: "Could not analyze this photo. Try again or add items manually." },
        { status: 502 }
      );
    }

    return NextResponse.json(response.parsed_output);
  } catch (err) {
    console.error("analyze-photo failed", err);
    return NextResponse.json(
      { error: "Photo analysis failed. Try again or add items manually." },
      { status: 502 }
    );
  }
}

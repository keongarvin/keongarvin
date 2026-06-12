import { z } from "zod";

export const DetectedItem = z.object({
  name: z.string(),
  category: z.string(),
  suggested_location: z.string().nullable(),
  quantity: z.number().int(),
  person: z.string().nullable(),
  notes: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const Detection = z.object({
  items: z.array(DetectedItem),
});

export type DetectedItemT = z.infer<typeof DetectedItem>;
export type DetectionT = z.infer<typeof Detection>;

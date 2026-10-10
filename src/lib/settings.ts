import { z } from "zod";
import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  defaultIdentity: "saver",
  theme: "navy",
  reduceMotion: false,
  textSize: "md",
  messagesFrom: "everyone",
  showOnline: true,
  allowCodeSearch: true,
  notify: { supports: true, responses: true, solutions: true, messages: true, help: true },
  language: "English",
  region: "India",
};

export const settingsSchema = z
  .object({
    defaultIdentity: z.enum(["saver", "revealer"]),
    theme: z.enum(["navy", "midnight"]),
    reduceMotion: z.boolean(),
    textSize: z.enum(["sm", "md", "lg"]),
    messagesFrom: z.enum(["everyone", "supporters", "none"]),
    showOnline: z.boolean(),
    allowCodeSearch: z.boolean(),
    notify: z.object({ supports: z.boolean(), responses: z.boolean(), solutions: z.boolean(), messages: z.boolean(), help: z.boolean() }).partial(),
    language: z.string().max(40),
    region: z.string().max(60),
  })
  .partial()
  .strict();

/** Merges stored (possibly partial/legacy) settings with defaults. */
export function resolveSettings(raw: unknown): Settings {
  const parsed = settingsSchema.safeParse(raw ?? {});
  const s = parsed.success ? parsed.data : {};
  return { ...DEFAULT_SETTINGS, ...s, notify: { ...DEFAULT_SETTINGS.notify, ...(s.notify ?? {}) } };
}

export const SUPPORT_LANGUAGES = ["English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Gujarati", "Punjabi", "Urdu"];

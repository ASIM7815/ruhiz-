import "server-only";
import { z } from "zod";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optText = (max: number) => z.string().trim().max(max).optional().default("");

export const CATEGORY = z.enum([
  "mental-health", "education", "student-life", "career", "relationships", "family", "technology",
  "environment", "community", "finance", "health", "self-improvement", "infrastructure",
]);
export const IDENTITY = z.enum(["saver", "revealer"]);
export const HELP_TYPE = z.enum(["knowledge", "technical", "research", "funding", "equipment", "volunteering", "local", "professional", "organization", "other"]);
export const CONTRIB_TYPE = z.enum(["experience", "evidence", "opinion", "counter", "question", "solution", "support"]);
export const STATUS = z.enum(["unsolved", "discussion", "solutions", "implementation", "solved"]);
export const SUPPORT_AREA = z.string().trim().min(2).max(40);

/**
 * Profile edits. Identity status and the revealed name/role are deliberately NOT editable here:
 * they change only through the consented reveal flow (identityReveal) and DELETE /api/me/identity.
 */
export const profilePatch = z
  .object({
    headline: z.string().trim().max(80),
    bio: z.string().trim().max(280),
    location: z.string().trim().max(80),
    expertise: z.array(z.string().trim().min(1).max(40)).max(12),
    canHelpWith: z.array(HELP_TYPE).max(10),
    avatarMediaId: z.string().uuid().nullable(),
    bannerMediaId: z.string().uuid().nullable(),
  })
  .partial()
  .strict();

/** Collapses runs of whitespace and rejects control characters. */
const cleanLine = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`)
        .refine((v) => /\p{L}/u.test(v), `${label} must contain letters`)
        .refine((v) => !/[\u0000-\u001f\u007f]/.test(v), `${label} contains invalid characters`),
    );

/** Required details for revealing an identity. `confirm` must be literally true (explicit consent). */
export const identityReveal = z
  .object({
    name: cleanLine(2, 60, "Name"),
    role: cleanLine(2, 80, "Role"),
    description: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.string().min(10, "Description must be at least 10 characters").max(280, "Description must be at most 280 characters").refine((v) => /\p{L}/u.test(v), "Description must contain letters")),
    confirm: z.literal(true, { message: "Confirm that you understand your identity will be visible to other members" }),
  })
  .strict();

export const onboarding = profilePatch.extend({ interests: z.array(CATEGORY).max(13).default([]) });

export const newPost = z
  .object({
    kind: z.enum(["photo", "video", "thought"]),
    intent: z.enum(["problem", "experience", "thought", "solution", "support", "update"]),
    category: CATEGORY,
    title: z.string().trim().max(140).optional(),
    text: text(10, 5000),
    identity: IDENTITY,
    tagArea: z.boolean().default(false),
    addresses: z.string().uuid().optional(),
    mediaIds: z.array(z.string().uuid()).max(6).default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.intent === "problem" || v.intent === "solution") && (!v.title || v.title.length < 6))
      ctx.addIssue({ code: "custom", path: ["title"], message: "A title of at least 6 characters is required" });
    if (v.kind === "thought" && v.mediaIds.length) ctx.addIssue({ code: "custom", path: ["mediaIds"], message: "Thought posts can't have media" });
    if (v.kind !== "thought" && !v.mediaIds.length) ctx.addIssue({ code: "custom", path: ["mediaIds"], message: "Add at least one file" });
    if (v.kind === "video" && v.mediaIds.length > 1) ctx.addIssue({ code: "custom", path: ["mediaIds"], message: "Only one video per post" });
  });

export const editPost = z
  .object({ title: z.string().trim().max(140).nullable().optional(), text: text(10, 5000).optional(), category: CATEGORY.optional() })
  .strict();

export const statusChange = z
  .object({ status: STATUS, note: optText(500), outcome: optText(1000) })
  .strict()
  .refine((v) => v.status !== "solved" || v.outcome.length >= 10, { path: ["outcome"], message: "Describe the outcome (at least 10 characters)" });

export const newContribution = z
  .object({
    postId: z.string().uuid().optional(),
    solutionId: z.string().uuid().optional(),
    parentId: z.string().uuid().optional(),
    type: CONTRIB_TYPE,
    text: text(3, 3000),
    source: z.string().trim().max(300).optional(),
    identity: IDENTITY,
  })
  .strict()
  .refine((v) => Boolean(v.postId) !== Boolean(v.solutionId), { message: "Choose exactly one target" });

export const newHelp = z
  .object({ type: HELP_TYPE, note: text(5, 500), availability: z.enum(["Today", "This week", "This month", "Ongoing", "One-time"]) })
  .strict();

export const newSolution = z
  .object({
    problemId: z.string().uuid(),
    title: text(8, 160),
    summary: text(20, 1000),
    approach: z.array(text(2, 300)).min(1).max(20),
    resources: z.array(text(1, 120)).max(20).default([]),
    fundingNeeded: z.number().int().min(0).max(10_000_000_000).default(0),
    skills: z.array(text(1, 80)).max(15).default([]),
    timeline: z.string().trim().max(80).default(""),
    expectedOutcome: text(10, 1000),
    evidence: z.array(text(2, 400)).max(20).default([]),
  })
  .strict();

export const newMessage = z
  .object({
    text: text(1, 4000),
    attachment: z.object({ kind: z.enum(["post", "solution"]), id: z.string().uuid() }).optional(),
  })
  .strict();

export const openConversation = z
  .object({ code: z.string().trim().min(6).max(7), context: z.string().trim().max(120).optional(), text: z.string().trim().max(4000).optional() })
  .strict();

export const newReport = z
  .object({
    target: z.enum(["post", "contribution", "solution", "user"]),
    id: z.string().trim().min(1).max(64),
    reason: z.enum(["spam", "harassment", "hate", "self-harm", "misinformation", "privacy", "other"]),
    details: z.string().trim().max(500).optional(),
  })
  .strict();

export const supportListing = z
  .object({
    listed: z.boolean(),
    areas: z.array(SUPPORT_AREA).max(12),
    description: z.string().trim().max(500),
    languages: z.array(z.string().trim().min(2).max(30)).max(10),
    hours: z.string().trim().max(80),
    approach: z.string().trim().max(200),
    availability: z.enum(["available", "busy", "away"]),
  })
  .strict()
  .refine((v) => !v.listed || v.areas.length > 0, { path: ["areas"], message: "Choose at least one area to be listed" });

export const credentialApplication = z
  .object({ credentialType: text(2, 80), issuingBody: text(2, 120), registrationNumber: text(2, 60) })
  .strict();

export const presign = z
  .object({
    purpose: z.enum(["post", "avatar", "banner"]),
    kind: z.enum(["image", "video"]),
    mime: z.string().trim().toLowerCase().max(60),
    size: z.number().int().positive(),
    alt: z.string().trim().max(200).optional().default(""),
    // Display hints measured by the browser; used only for layout, never for authorisation.
    width: z.number().int().min(1).max(20000).optional(),
    height: z.number().int().min(1).max(20000).optional(),
  })
  .strict();

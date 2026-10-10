import { z } from "zod";
import { body, route } from "@/server/http";
import { CATEGORY } from "@/server/schemas";
import { getPostsByIds, rankFeed } from "@/server/repo/posts";

const feedQuery = z
  .object({
    tab: z.enum(["for-you", "latest", "trending", "nearby", "unsolved"]),
    categories: z.array(CATEGORY).max(13).default([]),
    exclude: z.array(z.string().uuid()).max(200).default([]),
  })
  .strict();

/** Ranked home feed. POST so the client can pass ids it has already shown (stable "Load more"). */
export const POST = route({ rateLimit: { key: "feed", limit: 600, windowSec: 3600 } }, async ({ req, viewer }) => {
  const f = await body(req, feedQuery);
  const { ids, hasMore, needsLocation } = await rankFeed(viewer, f.tab, f.categories.length ? f.categories : null, f.exclude);
  return { items: await getPostsByIds(viewer, ids), hasMore, needsLocation };
});

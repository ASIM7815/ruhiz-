import { z } from "zod";
import { route } from "@/server/http";
import { q } from "@/server/db";
import { badRequest } from "@/server/errors";
import { CATEGORY } from "@/server/schemas";
import { explorePosts, getPostsByIds, type ExploreCursor } from "@/server/repo/posts";
import type { CategoryId, ExplorePage } from "@/lib/types";

const TYPE_TO_KIND = { all: null, video: "video", photo: "photo", thought: "thought" } as const;

const query = z.object({
  category: CATEGORY.nullable(),
  type: z.enum(["all", "video", "photo", "thought"]).default("all"),
  // Random per visit (the client picks it); the same seed gives the same order while paging.
  seed: z.coerce.number().int().min(0).max(4294967295),
  cursor: z.string().max(200).nullable(),
});

const cursorSchema = z.object({ k: z.number().min(-1).max(1), i: z.string().uuid(), w: z.union([z.literal(0), z.literal(1)]) }).strict();

function decodeCursor(s: string | null): ExploreCursor | null {
  if (!s) return null;
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(s, "base64url").toString("utf8")));
  } catch {
    throw badRequest("Invalid cursor.");
  }
}

/**
 * Explore: Category → content type (All / Videos / Photos / Thoughts) → randomised matching posts.
 * GET /api/explore?category=education&type=video&seed=123&cursor=…
 */
export const GET = route({ rateLimit: { key: "explore", limit: 1200, windowSec: 3600 } }, async ({ req, viewer }): Promise<ExplorePage> => {
  const sp = req.nextUrl.searchParams;
  const parsed = query.safeParse({ category: sp.get("category") || null, type: sp.get("type") ?? undefined, seed: sp.get("seed") ?? "", cursor: sp.get("cursor") });
  if (!parsed.success) throw badRequest("Invalid Explore filters.");
  const { category, type, seed } = parsed.data;
  const kind = TYPE_TO_KIND[type];

  const { ids, nextCursor } = await explorePosts(viewer, { category: category as CategoryId | null, kind, seed, cursor: decodeCursor(parsed.data.cursor) });
  // Live post counts per category for the chosen content type (categories are a fixed list of 13).
  const categories = await q<{ id: CategoryId; posts: number }>(
    `select c.id, count(p.id)::int as posts from categories c
       left join posts p on p.category_id = c.id and ($1::text is null or p.kind = $1)
      group by c.id, c.sort_order order by c.sort_order`,
    [kind],
  );
  return {
    categories,
    posts: await getPostsByIds(viewer, ids),
    nextCursor: nextCursor ? Buffer.from(JSON.stringify(nextCursor)).toString("base64url") : null,
  };
});

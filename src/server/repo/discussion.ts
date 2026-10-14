import "server-only";
import type { Availability, Contribution, ContributionType, HelpOffer, HelpType } from "@/lib/types";
import { q } from "../db";
import { accountRevealed, itemMasked, ms, toMember, toUser, userCols } from "../mappers";
import type { Viewer } from "../session";

const CONTRIB_SELECT = `
  select c.id, c.post_id, c.solution_id, c.parent_id, c.author_id, c.type, c.body, c.source, c.created_at,
         case when c.identity_mode = 'revealer' and ${accountRevealed("pr")} then 'revealer' else 'saver' end as identity_mode,
         ${userCols("pr", "a_", "c.identity_mode")},
         (select count(*) from contribution_helpful h where h.contribution_id = c.id) as helpful,
         exists(select 1 from contribution_helpful h where h.contribution_id = c.id and h.user_id = $1) as helpful_by_me,
         coalesce(tp.title, left(tp.body, 90), ts.title) as target_title
    from contributions c
    join profiles pr on pr.user_id = c.author_id
    left join posts tp on tp.id = c.post_id
    left join solutions ts on ts.id = c.solution_id`;

function toContribution(viewer: Viewer, r: Record<string, unknown>): Contribution {
  return {
    id: String(r.id),
    author: toUser(r, "a_"),
    type: r.type as ContributionType,
    text: String(r.body),
    source: (r.source as string) ?? null,
    identity: r.identity_mode as Contribution["identity"],
    createdAt: ms(r.created_at),
    helpful: Number(r.helpful),
    helpfulByMe: Boolean(r.helpful_by_me),
    parentId: (r.parent_id as string) ?? null,
    isOwner: r.author_id === viewer.id,
    canModerate: viewer.isAdmin,
    target: r.post_id
      ? { kind: "post", id: String(r.post_id), title: String(r.target_title ?? "") }
      : { kind: "solution", id: String(r.solution_id), title: String(r.target_title ?? "") },
  };
}

export async function listContributions(viewer: Viewer, target: { kind: "post" | "solution"; id: string }) {
  const col = target.kind === "post" ? "c.post_id" : "c.solution_id";
  const rows = await q(`${CONTRIB_SELECT} where ${col} = $2 order by c.created_at limit 500`, [viewer.id, target.id]);
  return rows.map((r) => toContribution(viewer, r));
}

/**
 * A person's contributions. Other people never see the ones made as Identity Saver while the
 * account is revealed: listing them on the revealed profile would de-anonymise them.
 */
export async function listContributionsByAuthor(viewer: Viewer, authorId: string, limit = 100) {
  const rows = await q(
    `${CONTRIB_SELECT} where c.author_id = $2 and (c.author_id = $1 or not ${itemMasked("pr", "c.identity_mode")}) order by c.created_at desc limit $3`,
    [viewer.id, authorId, limit],
  );
  return rows.map((r) => toContribution(viewer, r));
}

export async function getContribution(viewer: Viewer, id: string) {
  const rows = await q(`${CONTRIB_SELECT} where c.id = $2`, [viewer.id, id]);
  return rows[0] ? toContribution(viewer, rows[0]) : null;
}

const HELP_SELECT = `
  select h.id, h.post_id, h.user_id, h.type, h.note, h.availability, h.created_at, coalesce(p.title, left(p.body, 90)) as post_title,
         ${userCols("pr", "u_")}
    from help_offers h join profiles pr on pr.user_id = h.user_id join posts p on p.id = h.post_id`;

function toHelp(viewer: Viewer, r: Record<string, unknown>): HelpOffer {
  return {
    id: String(r.id),
    postId: String(r.post_id),
    postTitle: String(r.post_title ?? ""),
    user: toMember(r, "u_"),
    type: r.type as HelpType,
    note: String(r.note),
    availability: r.availability as Availability,
    createdAt: ms(r.created_at),
    isMine: r.user_id === viewer.id,
  };
}

export async function listHelp(viewer: Viewer, postId: string) {
  const rows = await q(`${HELP_SELECT} where h.post_id = $1 order by (h.user_id = $2) desc, h.created_at desc`, [postId, viewer.id]);
  return rows.map((r) => toHelp(viewer, r));
}

export async function listHelpByUser(viewer: Viewer, userId: string) {
  const rows = await q(`${HELP_SELECT} where h.user_id = $1 order by h.created_at desc limit 100`, [userId]);
  return rows.map((r) => toHelp(viewer, r));
}

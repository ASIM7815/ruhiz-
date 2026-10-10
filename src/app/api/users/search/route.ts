import { route } from "@/server/http";
import { q } from "@/server/db";
import { toUser, userCols } from "@/server/mappers";

/** People are found by unique code only. Names and emails are never searchable. */
export const GET = route({ rateLimit: { key: "search", limit: 300, windowSec: 3600 } }, async ({ req, viewer }) => {
  const code = (req.nextUrl.searchParams.get("q") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (code.length < 1) return [];
  const rows = await q(
    `select ${userCols("p", "u_")}, p.location, (select count(*) from user_supports where supported_id = p.user_id) as supporters,
            exists(select 1 from user_supports where supporter_id = $3 and supported_id = p.user_id) as supported_by_me
       from profiles p
      where (p.code like $1 || '%' or (length($1) >= 2 and p.code like '%' || $1 || '%'))
        and (p.user_id = $3 or coalesce((p.settings->>'allowCodeSearch')::boolean, true))
      order by (p.code = $1) desc, (p.code like $1 || '%') desc, supporters desc, p.code
      limit $2`,
    [code, 12, viewer.id],
  );
  return rows.map((r) => ({ ...toUser(r, "u_"), location: String(r.location), supporters: Number(r.supporters), supportedByMe: Boolean(r.supported_by_me), isMe: r.u_code === viewer.code }));
});

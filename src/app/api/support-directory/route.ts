import { route } from "@/server/http";
import { q } from "@/server/db";
import { toMember, userCols } from "@/server/mappers";
import type { SupportListing } from "@/lib/types";

/**
 * Members who chose to be listed as supporters. "Licensed professional" is shown only
 * after an administrator verified the person's credentials.
 */
export const GET = route({}, async ({ viewer }) => {
  const rows = await q(
    `select l.*, ${userCols("p", "u_")}, p.user_id = $1 as is_me,
            c.status as cred_status, c.credential_type, c.issuing_body
       from support_listings l
       join profiles p on p.user_id = l.user_id
       left join support_credentials c on c.user_id = l.user_id
      where l.listed and cardinality(l.areas) > 0
      order by case l.availability when 'available' then 0 when 'busy' then 1 else 2 end, l.updated_at desc
      limit 200`,
    [viewer.id],
  );
  return rows.map(
    (r): SupportListing => ({
      user: toMember(r, "u_"),
      professional: r.cred_status === "verified",
      credential: r.cred_status === "verified" ? `${r.credential_type} · ${r.issuing_body}` : null,
      areas: r.areas as string[],
      description: String(r.description),
      availability: r.availability as SupportListing["availability"],
      languages: r.languages as string[],
      hours: String(r.hours),
      approach: String(r.approach),
      isMe: Boolean(r.is_me),
    }),
  );
});

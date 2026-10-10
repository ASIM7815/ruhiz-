import { body, route } from "@/server/http";
import { one, q } from "@/server/db";
import { conflict } from "@/server/errors";
import { credentialApplication, supportListing } from "@/server/schemas";
import type { MySupportListing } from "@/lib/types";

async function load(userId: string): Promise<MySupportListing> {
  const l = await one<Record<string, unknown>>(`select * from support_listings where user_id = $1`, [userId]);
  const c = await one<Record<string, unknown>>(`select * from support_credentials where user_id = $1`, [userId]);
  return {
    listed: Boolean(l?.listed),
    areas: (l?.areas as string[]) ?? [],
    description: String(l?.description ?? ""),
    languages: (l?.languages as string[]) ?? [],
    hours: String(l?.hours ?? ""),
    approach: String(l?.approach ?? ""),
    availability: (l?.availability as MySupportListing["availability"]) ?? "available",
    credential: c
      ? {
          type: String(c.credential_type),
          issuingBody: String(c.issuing_body),
          registrationNumber: String(c.registration_number),
          status: c.status as "pending" | "verified" | "rejected",
          reviewNote: (c.review_note as string) ?? null,
        }
      : null,
  };
}

export const GET = route({}, async ({ viewer }) => load(viewer.id));

/** Peer supporter listing (self-declared). */
export const PUT = route({}, async ({ req, viewer }) => {
  const p = await body(req, supportListing);
  await q(
    `insert into support_listings (user_id, listed, areas, description, languages, hours, approach, availability)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (user_id) do update set listed = $2, areas = $3, description = $4, languages = $5, hours = $6, approach = $7, availability = $8`,
    [viewer.id, p.listed, p.areas, p.description, p.languages, p.hours, p.approach, p.availability],
  );
  return load(viewer.id);
});

/** Apply for licensed-professional verification. Always lands as 'pending'; only an admin can verify. */
export const POST = route({ rateLimit: { key: "credential", limit: 5, windowSec: 86400 } }, async ({ req, viewer }) => {
  const p = await body(req, credentialApplication);
  const existing = await one<{ status: string; reviewed_at: string | null }>(`select status, reviewed_at from support_credentials where user_id = $1`, [viewer.id]);
  if (existing?.status === "verified") throw conflict("Your credentials are already verified.");
  if (existing?.status === "rejected" && existing.reviewed_at && Date.now() - new Date(existing.reviewed_at).getTime() < 7 * 86_400_000)
    throw conflict("You can re-apply 7 days after a rejected application.");
  await q(
    `insert into support_credentials (user_id, credential_type, issuing_body, registration_number, status)
     values ($1, $2, $3, $4, 'pending')
     on conflict (user_id) do update set credential_type = $2, issuing_body = $3, registration_number = $4,
       status = 'pending', review_note = null, reviewed_by = null, reviewed_at = null, submitted_at = now()`,
    [viewer.id, p.credentialType, p.issuingBody, p.registrationNumber],
  );
  return load(viewer.id);
});

export const DELETE = route({}, async ({ viewer }) => {
  await q(`delete from support_credentials where user_id = $1 and status <> 'verified'`, [viewer.id]);
  return load(viewer.id);
});

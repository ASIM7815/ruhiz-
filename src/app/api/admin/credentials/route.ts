import { z } from "zod";
import { body, code6, route } from "@/server/http";
import { one, q } from "@/server/db";
import { notFound } from "@/server/errors";
import { ms } from "@/server/mappers";
import { audit } from "@/server/session";

export const GET = route({ access: "admin" }, async () => {
  const rows = await q(
    `select p.code, c.credential_type, c.issuing_body, c.registration_number, c.status, c.review_note, c.submitted_at, c.reviewed_at
       from support_credentials c join profiles p on p.user_id = c.user_id
      order by (c.status = 'pending') desc, c.submitted_at desc limit 200`,
  );
  return rows.map((r) => ({
    code: String(r.code).trim(),
    credentialType: r.credential_type,
    issuingBody: r.issuing_body,
    registrationNumber: r.registration_number,
    status: r.status,
    reviewNote: r.review_note,
    submittedAt: ms(r.submitted_at),
    reviewedAt: r.reviewed_at ? ms(r.reviewed_at) : null,
  }));
});

/** Approve or reject a licensed-professional application. */
export const PATCH = route({ access: "admin" }, async ({ req, viewer }) => {
  const p = await body(req, z.object({ code: z.string(), decision: z.enum(["verified", "rejected"]), note: z.string().trim().max(500).optional() }).strict());
  const code = code6.parse(p.code);
  const row = await one<{ user_id: string }>(`select c.user_id from support_credentials c join profiles p on p.user_id = c.user_id where p.code = $1`, [code]);
  if (!row) throw notFound("Application not found.");
  await q(`update support_credentials set status = $2, review_note = $3, reviewed_by = $4, reviewed_at = now() where user_id = $1`, [row.user_id, p.decision, p.note ?? null, viewer.id]);
  await audit(viewer, `credential_${p.decision}`, "user", row.user_id, { code, note: p.note ?? null });
  return { ok: true };
});

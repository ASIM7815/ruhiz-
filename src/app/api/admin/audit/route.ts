import { route } from "@/server/http";
import { one, q } from "@/server/db";
import { ms } from "@/server/mappers";
import { drainStorageQueue, storageConfigured } from "@/server/storage";

export const GET = route({ access: "admin" }, async () => {
  const rows = await q(`select id, admin_email, action, target_type, target_id, details, created_at from admin_audit_log order by created_at desc limit 200`);
  const gc = await one<{ n: number }>(`select count(*)::int as n from storage_gc`);
  return {
    entries: rows.map((r) => ({ id: String(r.id), admin: r.admin_email, action: r.action, targetType: r.target_type, targetId: r.target_id, details: r.details, at: ms(r.created_at) })),
    storage: { configured: storageConfigured(), pendingDeletes: gc?.n ?? 0 },
  };
});

/** Retry deleting storage objects whose rows are already gone. */
export const POST = route({ access: "admin" }, async () => drainStorageQueue(1000));

import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/session";

export const dynamic = "force-dynamic";

/** Server-side gate: non-administrators never receive the moderation UI. APIs are gated separately. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/home");
  }
  return children;
}

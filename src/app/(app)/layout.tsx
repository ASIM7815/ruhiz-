import { redirect } from "next/navigation";
import { getViewer } from "@/server/session";
import { ApiError } from "@/server/errors";
import { getMe } from "@/server/repo/profiles";
import { StoreProvider } from "@/store/store";
import { AppShell } from "@/components/shell/AppShell";

// Every page in this group needs the signed-in user, so it renders per request.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let viewer;
  try {
    viewer = await getViewer();
  } catch (e) {
    // Only an unverified email sends people back to sign in; anything else is a real
    // error and is shown by error.tsx instead of being disguised as a login problem.
    if (e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED") redirect("/sign-in?verify=1");
    throw e;
  }
  if (!viewer) redirect("/sign-in");
  const me = await getMe(viewer);
  return (
    <StoreProvider initialMe={me}>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}

import { redirect } from "next/navigation";
import { getViewer } from "@/server/session";
import { Landing } from "@/components/landing/Landing";

export const dynamic = "force-dynamic";

/**
 * Hides scroll-reveal content only once the animation script is running, and un-hides it again if
 * that script never reports ready (blocked or failed), so content is never stuck invisible.
 */
const EARLY = `(function(){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document.documentElement;d.classList.add('landing-js');setTimeout(function(){if(!window.__landingReady)d.classList.remove('landing-js')},7000)}catch(e){}})()`;

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const viewer = await getViewer().catch(() => null);
  if (viewer) redirect("/home");

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EARLY }} />
      <Landing accountDeleted={Boolean(deleted)} />
    </>
  );
}

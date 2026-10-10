"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Compass, HeartHandshake, House, MessageCircle, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useCounts, useMe, useStore } from "@/store/store";
import { Drawer } from "@/components/ui/Modal";
import { Toasts } from "@/components/ui/Primitives";
import { Header } from "./Header";
import { Sidebar, SidebarContent } from "./Sidebar";
import { RightPanelContent, RightSidebar } from "./RightSidebar";
import { ModalHost } from "./ModalHost";

const NO_RIGHT_PANEL = ["/messages", "/settings", "/admin", "/welcome"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, actions } = useStore();
  const me = useMe();
  const pathname = usePathname();
  const isMd = useMediaQuery("(min-width: 768px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isXl = useMediaQuery("(min-width: 1280px)");

  const panelAllowed = !NO_RIGHT_PANEL.some((p) => pathname.startsWith(p));
  const leftCollapsed = isLg ? state.ui.leftCollapsed : true;
  const lw = !isMd ? 0 : leftCollapsed ? 76 : 252;
  const rightColumn = isXl && panelAllowed;
  const rw = rightColumn ? (state.ui.rightCollapsed ? 60 : 340) : 0;

  useEffect(() => {
    actions.setUI({ mobileNav: false, mobileRight: false });
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div style={{ ["--lw" as string]: `${lw}px`, ["--rw" as string]: `${rw}px` }}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Header collapsed={leftCollapsed} isMd={isMd} canCollapse={isLg} showPanelToggle={!rightColumn && panelAllowed} />
      {isMd && <Sidebar collapsed={leftCollapsed} />}

      <Drawer open={state.ui.mobileNav && !isMd} onClose={() => actions.setUI({ mobileNav: false })} label="Navigation">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ruhiz-logo.png" alt="RUHIZ" className="h-8 w-auto" />
        </div>
        <div className="flex-1">
          <SidebarContent collapsed={false} onNavigate={() => actions.setUI({ mobileNav: false })} />
        </div>
      </Drawer>

      <Drawer open={state.ui.mobileRight && !rightColumn} onClose={() => actions.setUI({ mobileRight: false })} side="right" label="Trending and suggestions" className="w-[min(92vw,360px)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow">For you</span>
          <button onClick={() => actions.setUI({ mobileRight: false })} className="btn btn-ghost btn-sm">
            Close
          </button>
        </div>
        <RightPanelContent />
      </Drawer>

      <main id="main" className="min-h-screen pt-16 transition-[padding] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ paddingLeft: "var(--lw)", paddingRight: "var(--rw)" }}>
        <div className={cn("mx-auto px-3 py-5 sm:px-5 lg:px-6", isMd ? "pb-10" : "pb-24")}>
          {!me.onboarded && pathname !== "/welcome" && (
            <Link href="/welcome" className="card card-hover mx-auto mb-4 flex max-w-[760px] items-center gap-3 p-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand-ink">
                <Sparkles className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9rem] font-semibold text-ink">Finish setting up your profile</span>
                <span className="block text-[0.8rem] text-muted">Add a photo, your area and the topics you care about so RUHIZ can show you relevant problems.</span>
              </span>
              <ArrowRight className="size-4 text-brand-ink" />
            </Link>
          )}
          {children}
        </div>
      </main>

      {rightColumn && <RightSidebar collapsed={state.ui.rightCollapsed} />}
      {!isMd && <MobileNav />}
      <ModalHost />
      <Toasts />
    </div>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const { actions } = useStore();
  const counts = useCounts();
  const items = [
    { href: "/home", label: "Home", icon: House, on: pathname === "/home" },
    { href: "/explore", label: "Explore", icon: Compass, on: pathname.startsWith("/explore") },
    { href: "/support", label: "Support", icon: HeartHandshake, on: pathname.startsWith("/support") },
    { href: "/messages", label: "Messages", icon: MessageCircle, on: pathname.startsWith("/messages"), badge: counts.messages },
  ];
  return (
    <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[#040a1c]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="grid h-16 grid-cols-5">
        {items.slice(0, 2).map((i) => (
          <MobileItem key={i.href} {...i} />
        ))}
        <div className="grid place-items-center">
          <button onClick={() => actions.openModal({ type: "composer", kind: "thought" })} className="btn btn-red btn-icon size-11 rounded-full" aria-label="Create post">
            <Plus className="size-5" strokeWidth={2.5} />
          </button>
        </div>
        {items.slice(2).map((i) => (
          <MobileItem key={i.href} {...i} />
        ))}
      </div>
    </nav>
  );
}

function MobileItem({ href, label, icon: Icon, on, badge }: { href: string; label: string; icon: typeof House; on: boolean; badge?: number }) {
  return (
    <Link href={href} aria-current={on ? "page" : undefined} className={cn("relative flex flex-col items-center justify-center gap-1 text-[0.66rem] font-semibold", on ? "text-white" : "text-muted")}>
      <Icon className={cn("size-5", on && "text-brand-ink")} strokeWidth={on ? 2.3 : 1.9} />
      {label}
      {badge ? <span className="absolute right-[calc(50%-1.1rem)] top-2 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.6rem] leading-4 text-white">{badge}</span> : null}
      {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
    </Link>
  );
}

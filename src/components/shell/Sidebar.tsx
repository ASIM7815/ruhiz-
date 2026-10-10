"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, ChevronRight, Compass, FileText, HeartHandshake, House, LogOut, MessageCircle, Settings, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCounts, useMe, useStore } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
  badge?: number;
}

function NavItem({ item, collapsed, onNavigate }: { item: Item; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = item.match(pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "has-tip group relative flex h-11 items-center gap-3 rounded-[11px] border text-[0.9rem] font-medium transition-all duration-200",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "border-brand/55 bg-gradient-to-r from-brand/25 via-brand/12 to-transparent text-white shadow-[0_0_0_1px_rgba(47,123,255,.15),0_8px_26px_-10px_rgba(47,123,255,.65),inset_0_1px_0_rgba(255,255,255,.06)]"
          : "border-transparent text-ink-2 hover:bg-white/[.045] hover:text-white",
      )}
    >
      <Icon className={cn("size-[1.2rem] shrink-0 transition-colors", active ? "text-white" : "text-ink-2 group-hover:text-white")} strokeWidth={active ? 2.3 : 1.9} aria-hidden />
      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
      {item.badge ? (
        <span
          className={cn(
            "grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[0.7rem] font-bold leading-5 text-white shadow-[0_0_12px_rgba(255,46,85,.6)]",
            collapsed ? "absolute right-1.5 top-1 min-w-4 px-1 text-[0.6rem] leading-4" : "ml-auto",
          )}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
      {collapsed && <span className="tooltip left-full ml-3">{item.label}</span>}
    </Link>
  );
}

export function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { actions } = useStore();
  const me = useMe();
  const pathname = usePathname();
  const counts = useCounts();
  const onProfile = pathname === `/profile/${me.code}`;

  const primary: Item[] = [
    { href: "/home", label: "Home", icon: House, match: (p) => p === "/home" },
    { href: "/explore", label: "Explore", icon: Compass, match: (p) => p.startsWith("/explore") },
    { href: "/support", label: "Emotional Support", icon: HeartHandshake, match: (p) => p.startsWith("/support") },
    { href: "/messages", label: "Messages", icon: MessageCircle, match: (p) => p.startsWith("/messages"), badge: counts.messages },
  ];
  const secondary: Item[] = [
    { href: "/contributions", label: "My Contributions", icon: FileText, match: (p) => p.startsWith("/contributions") },
    { href: "/saved", label: "Saved", icon: Bookmark, match: (p) => p.startsWith("/saved") },
  ];

  return (
    <div className="relative flex h-full flex-col">
      <nav aria-label="Primary" className={cn("flex flex-col gap-1.5 pt-4", collapsed ? "px-3" : "px-3.5")}>
        {primary.map((i) => (
          <NavItem key={i.href} item={i} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className={cn("divider my-4", collapsed ? "mx-3" : "mx-4")} />

      <div className={cn(collapsed ? "px-3" : "px-3.5")}>
        <Link
          href={`/profile/${me.code}`}
          onClick={onNavigate}
          aria-label={collapsed ? `Your profile #${me.code}` : undefined}
          className={cn(
            "has-tip group relative flex items-center gap-3 rounded-xl border transition-all",
            collapsed ? "justify-center border-transparent p-1.5" : "p-2.5",
            !collapsed && (onProfile ? "border-brand/45 bg-brand/10" : "border-transparent hover:border-line hover:bg-white/[.035]"),
          )}
        >
          <Avatar code={me.code} src={me.avatarUrl} size={collapsed ? "md" : "lg"} online={me.settings.showOnline} ring={onProfile} />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="code-font truncate text-[0.95rem] font-bold text-white">#{me.code}</div>
                <div className="text-[0.76rem] text-muted group-hover:text-ink-2">View Profile</div>
              </div>
              <ChevronRight className="size-4.5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
            </>
          )}
          {collapsed && <span className="tooltip left-full ml-3">#{me.code} · View Profile</span>}
        </Link>
      </div>

      <nav aria-label="Your activity" className={cn("mt-3 flex flex-col gap-1.5", collapsed ? "px-3" : "px-3.5")}>
        {secondary.map((i) => (
          <NavItem key={i.href} item={i} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
        {me.isAdmin && <NavItem item={{ href: "/admin", label: "Moderation", icon: ShieldAlert, match: (p) => p.startsWith("/admin") }} collapsed={collapsed} onNavigate={onNavigate} />}
      </nav>

      <div className="min-h-6 flex-1" />

      <nav aria-label="Account" className={cn("relative z-10 flex flex-col gap-1.5 pb-5", collapsed ? "px-3" : "px-3.5")}>
        <NavItem item={{ href: "/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/settings") }} collapsed={collapsed} onNavigate={onNavigate} />
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            actions.openModal({ type: "logout" });
          }}
          aria-label={collapsed ? "Log Out" : undefined}
          className={cn(
            "has-tip group relative flex h-11 items-center gap-3 rounded-[11px] border border-transparent text-[0.9rem] font-medium text-ink-2 transition-all hover:bg-white/[.045] hover:text-white",
            collapsed ? "justify-center" : "px-3",
          )}
        >
          <LogOut className="size-[1.2rem] shrink-0" strokeWidth={1.9} aria-hidden />
          {!collapsed && <span>Log Out</span>}
          {collapsed && <span className="tooltip left-full ml-3">Log Out</span>}
        </button>
      </nav>

      {/* Brand horizon glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-64 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#ff2e55]/22 via-[#1b3a8f]/12 to-transparent" />
        <div className="absolute -bottom-16 -left-10 h-40 w-64 rounded-full bg-[#ff2e55]/30 blur-3xl" />
        <div className="absolute -bottom-10 right-0 h-32 w-40 rounded-full bg-[#2f7bff]/25 blur-3xl" />
        <svg className="absolute inset-x-0 bottom-0 h-24 w-full text-[#0b1638]/80" viewBox="0 0 300 100" preserveAspectRatio="none" fill="currentColor">
          <path d="M0 70 L40 45 L70 60 L110 30 L150 58 L190 40 L230 62 L270 38 L300 55 L300 100 L0 100 Z" />
        </svg>
      </div>
    </div>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        "no-scrollbar fixed bottom-0 left-0 top-16 z-30 border-r border-line bg-gradient-to-b from-[var(--panel)] to-[#050b22] transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
        collapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden",
      )}
      style={{ width: "var(--lw)" }}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}

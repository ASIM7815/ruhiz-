"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronsLeft, ChevronsRight, FileText, LogOut, Menu as MenuIcon, PanelRightOpen, Search, Settings, ShieldAlert, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMe, useStore } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";
import { Menu, MenuItem } from "@/components/ui/Primitives";
import { IdentityBadge } from "@/components/ui/Badges";
import { SearchBox } from "./SearchBox";
import { NotificationButton } from "./NotificationPanel";

interface Props {
  collapsed: boolean;
  isMd: boolean;
  canCollapse: boolean;
  showPanelToggle: boolean;
}

export function Header({ collapsed, isMd, canCollapse, showPanelToggle }: Props) {
  const { actions } = useStore();
  const me = useMe();
  const [mobileSearch, setMobileSearch] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-line bg-[#040a1c]/85 backdrop-blur-xl">
      <div className="flex h-full items-center">
        <div className="flex h-full shrink-0 items-center transition-[width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ width: isMd ? "var(--lw)" : "auto" }}>
          {!isMd && (
            <button onClick={() => actions.setUI({ mobileNav: true })} className="ml-2 grid size-10 place-items-center rounded-full text-ink-2 hover:bg-white/5" aria-label="Open navigation">
              <MenuIcon className="size-5" />
            </button>
          )}
          <Link href="/home" aria-label="RUHIZ home" className={cn("flex h-full items-center", collapsed && isMd ? "w-full justify-center" : "pl-5 pr-2", !isMd && "pl-1")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={collapsed && isMd ? "/brand/ruhiz-mark.png" : "/brand/ruhiz-logo.png"}
              alt="RUHIZ"
              className={cn("w-auto select-none drop-shadow-[0_4px_16px_rgba(47,123,255,.35)] transition-all", collapsed && isMd ? "h-9" : "h-[30px] sm:h-[34px]")}
              draggable={false}
            />
          </Link>
          {isMd && canCollapse && !collapsed && (
            <button
              onClick={actions.toggleLeft}
              className="has-tip relative ml-auto mr-3 grid size-8 place-items-center rounded-full border border-line-strong bg-white/[.92] text-[#0a1638] shadow-[0_4px_14px_-4px_rgba(0,0,0,.6)] transition-all hover:bg-white"
              aria-label="Collapse sidebar"
            >
              <ChevronsLeft className="size-4.5" strokeWidth={2.4} />
              <span className="tooltip left-1/2 top-full mt-2 -translate-x-1/2">Collapse sidebar</span>
            </button>
          )}
        </div>

        {isMd && canCollapse && collapsed && (
          <button
            onClick={actions.toggleLeft}
            className="has-tip relative -ml-4 grid size-8 shrink-0 place-items-center rounded-full border border-line-strong bg-white/[.92] text-[#0a1638] shadow-[0_4px_14px_-4px_rgba(0,0,0,.6)] transition-all hover:bg-white"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="size-4.5" strokeWidth={2.4} />
            <span className="tooltip left-0 top-full mt-2">Expand sidebar</span>
          </button>
        )}

        <div className="flex min-w-0 flex-1 justify-center px-3 sm:px-6">
          <SearchBox className="hidden max-w-[560px] sm:block" />
        </div>

        <div className="flex shrink-0 items-center gap-1 pr-3 sm:gap-1.5 sm:pr-5">
          <button onClick={() => setMobileSearch(true)} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-white/5 sm:hidden" aria-label="Search users by code">
            <Search className="size-5" />
          </button>
          {showPanelToggle && (
            <button onClick={() => actions.setUI({ mobileRight: true })} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-white/5 hover:text-white" aria-label="Open trending and suggestions panel">
              <PanelRightOpen className="size-5" />
            </button>
          )}
          <NotificationButton />
          <Menu
            label="Account"
            trigger={({ toggle, open }) => (
              <button onClick={toggle} aria-expanded={open} aria-label="Account menu" className={cn("ml-1 rounded-full p-0.5 transition-all", open ? "ring-2 ring-brand/60" : "hover:ring-2 hover:ring-white/15")}>
                <Avatar code={me.code} src={me.avatarUrl} size="md" online={me.settings.showOnline} />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="mb-1 flex items-center gap-3 rounded-lg bg-white/[.03] p-2.5">
                  <Avatar code={me.code} src={me.avatarUrl} size="lg" online={me.settings.showOnline} />
                  <div className="min-w-0">
                    <div className="code-font font-bold text-ink">#{me.code}</div>
                    <IdentityBadge mode={me.identity} compact />
                    <div className="text-[0.74rem] text-muted">
                      {me.supporters.toLocaleString()} Supporters · {me.supporting.toLocaleString()} Supporting
                    </div>
                  </div>
                </div>
                <MenuItem icon={UserRound} href={`/profile/${me.code}`} onClick={close}>
                  View profile
                </MenuItem>
                <MenuItem icon={FileText} href="/contributions" onClick={close}>
                  My Contributions
                </MenuItem>
                <MenuItem icon={Bookmark} href="/saved" onClick={close}>
                  Saved
                </MenuItem>
                <MenuItem icon={Settings} href="/settings" onClick={close}>
                  Settings
                </MenuItem>
                {me.isAdmin && (
                  <MenuItem icon={ShieldAlert} href="/admin" onClick={close}>
                    Moderation
                  </MenuItem>
                )}
                <div className="my-1 h-px bg-line" />
                <MenuItem
                  icon={LogOut}
                  danger
                  onClick={() => {
                    close();
                    actions.openModal({ type: "logout" });
                  }}
                >
                  Log Out
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      </div>

      {mobileSearch && (
        <div className="anim-fade fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-2 border-b border-line bg-[#040a1c] px-3 sm:hidden">
          <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
          <button onClick={() => setMobileSearch(false)} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white/5" aria-label="Close search">
            <X className="size-5" />
          </button>
        </div>
      )}
    </header>
  );
}

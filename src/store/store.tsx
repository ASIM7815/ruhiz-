"use client";

/**
 * RUHIZ client store: UI state only (sidebars, modals, toasts) plus the signed-in user.
 * All product data is fetched from /api/* with SWR; nothing important lives here.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import useSWR, { SWRConfig } from "swr";
import type { Contribution, Me, Post, PostKind, Settings, Solution, SupportListing } from "@/lib/types";
import { api, fetcher } from "@/lib/api";

export type ShareTarget = { kind: "post" | "solution" | "profile"; id: string; title: string };
export type ReportTarget = { target: "post" | "contribution" | "solution" | "user"; id: string; label: string };

export type ModalState =
  | { type: "composer"; kind: PostKind; addresses?: { id: string; title: string } }
  | { type: "editPost"; post: Post }
  | { type: "share"; target: ShareTarget }
  | { type: "help"; post: Pick<Post, "id" | "title" | "text"> }
  | { type: "propose"; problem: Pick<Post, "id" | "title" | "text"> }
  | { type: "status"; post: Post }
  | { type: "pledge"; solution: Solution }
  | { type: "people"; code: string; list: "supporters" | "supporting" }
  | { type: "editProfile" }
  | { type: "revealIdentity" }
  | { type: "supportProfile"; listing: SupportListing }
  | { type: "requestSupport"; listing: SupportListing }
  | { type: "newMessage"; code?: string }
  | { type: "report"; target: ReportTarget }
  | { type: "confirm"; title: string; text: string; confirmLabel: string; danger?: boolean; requireReason?: boolean; onConfirm: (reason: string) => Promise<void> }
  | { type: "deleteAccount" }
  | { type: "logout" }
  | null;

export interface Toast {
  id: string;
  text: string;
  tone: "info" | "success" | "error";
  action?: { label: string; href: string };
}

interface UIState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  mobileNav: boolean;
  mobileRight: boolean;
}

const UI_KEY = "ruhiz:ui:v2";

function loadUI(): Pick<UIState, "leftCollapsed" | "rightCollapsed"> {
  try {
    return { leftCollapsed: false, rightCollapsed: false, ...JSON.parse(window.localStorage.getItem(UI_KEY) || "{}") };
  } catch {
    return { leftCollapsed: false, rightCollapsed: false };
  }
}

function useStoreState(initialMe: Me) {
  const { data: me, mutate: mutateMe } = useSWR<Me>("/api/me", fetcher, { fallbackData: initialMe, revalidateOnFocus: true });
  const [ui, setUIState] = useState<UIState>({ leftCollapsed: false, rightCollapsed: false, mobileNav: false, mobileRight: false });
  const [modal, setModal] = useState<ModalState>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => setUIState((u) => ({ ...u, ...loadUI() })), []);
  useEffect(() => {
    try {
      window.localStorage.setItem(UI_KEY, JSON.stringify({ leftCollapsed: ui.leftCollapsed, rightCollapsed: ui.rightCollapsed }));
    } catch {
      /* storage unavailable */
    }
  }, [ui.leftCollapsed, ui.rightCollapsed]);

  const settings = (me ?? initialMe).settings;
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = settings.theme;
    el.dataset.text = settings.textSize;
    el.dataset.motion = settings.reduceMotion ? "reduce" : "full";
  }, [settings.theme, settings.textSize, settings.reduceMotion]);

  const actions = useMemo(() => {
    const toast = (text: string, tone: Toast["tone"] = "success", action?: Toast["action"]) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-3), { id, text, tone, action }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3600);
    };
    return {
      toast,
      dismissToast: (id: string) => setToasts((t) => t.filter((x) => x.id !== id)),
      setUI: (patch: Partial<UIState>) => setUIState((u) => ({ ...u, ...patch })),
      toggleLeft: () => setUIState((u) => ({ ...u, leftCollapsed: !u.leftCollapsed })),
      toggleRight: () => setUIState((u) => ({ ...u, rightCollapsed: !u.rightCollapsed })),
      openModal: (m: ModalState) => setModal(m),
      closeModal: () => setModal(null),
      refreshMe: () => mutateMe(),
      setMe: (next: Me) => mutateMe(next, { revalidate: false }),
      /** Saves settings on the server, applying them optimistically. */
      updateSettings: async (patch: Partial<Settings>) => {
        const current = me ?? initialMe;
        const optimistic = { ...current, settings: { ...current.settings, ...patch, notify: { ...current.settings.notify, ...(patch.notify ?? {}) } } };
        mutateMe(optimistic, { revalidate: false });
        try {
          const saved = await api<Settings>("/api/me/settings", { method: "PATCH", body: patch });
          mutateMe({ ...optimistic, settings: saved }, { revalidate: false });
        } catch (e) {
          mutateMe(current, { revalidate: false });
          toast(e instanceof Error ? e.message : "Couldn't save settings", "error");
        }
      },
    };
  }, [me, initialMe, mutateMe]);

  return { state: { me: me ?? initialMe, ui, modal, toasts }, actions };
}

type Store = ReturnType<typeof useStoreState>;
const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ initialMe, children }: { initialMe: Me; children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, shouldRetryOnError: (e) => (e as { status?: number })?.status !== 404 && (e as { status?: number })?.status !== 403, errorRetryCount: 2, dedupingInterval: 3000 }}>
      <Inner initialMe={initialMe}>{children}</Inner>
    </SWRConfig>
  );
}

function Inner({ initialMe, children }: { initialMe: Me; children: React.ReactNode }) {
  const store = useStoreState(initialMe);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

export const useMe = () => useStore().state.me;

/** Shell badge counts (unread notifications and conversations). */
export function useCounts() {
  const { data } = useSWR<{ notifications: number; messages: number }>("/api/me/counts", fetcher, { refreshInterval: 20_000 });
  return data ?? { notifications: 0, messages: 0 };
}

export type { Contribution };

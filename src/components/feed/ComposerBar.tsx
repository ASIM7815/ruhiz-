"use client";

import { Image as ImageIcon, PenLine, Video } from "lucide-react";
import type { PostKind } from "@/lib/types";
import { useMe, useStore } from "@/store/store";
import { Avatar } from "@/components/ui/Avatar";

const KINDS: { kind: PostKind; label: string; icon: typeof ImageIcon }[] = [
  { kind: "photo", label: "Photo", icon: ImageIcon },
  { kind: "video", label: "Video", icon: Video },
  { kind: "thought", label: "Thoughts", icon: PenLine },
];

/** Inline composer at the top of the feed. Opens the full composer for the chosen type. */
export function ComposerBar() {
  const { actions } = useStore();
  const me = useMe();
  const open = (kind: PostKind) => actions.openModal({ type: "composer", kind });
  return (
    <div className="card p-3.5 sm:p-4">
      <div className="flex items-center gap-3">
        <Avatar code={me.code} src={me.avatarUrl} size="lg" online={me.settings.showOnline} />
        <button
          onClick={() => open("thought")}
          className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-line bg-[#030920]/60 px-4 text-left text-[0.9rem] text-muted transition-colors hover:border-line-strong hover:text-ink-2"
        >
          <span className="truncate">Share your thoughts, photo or video...</span>
        </button>
        <div className="hidden items-center gap-0.5 sm:flex">
          {KINDS.map(({ kind, label, icon: Icon }) => (
            <button key={kind} onClick={() => open(kind)} className="has-tip relative grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-white/[.06] hover:text-white" aria-label={`Create ${label} post`}>
              <Icon className="size-5" strokeWidth={1.9} />
              <span className="tooltip left-1/2 top-full mt-1.5 -translate-x-1/2">{label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => open("thought")} className="btn btn-red hidden h-10 px-6 sm:inline-flex">
          Post
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 sm:hidden">
        {KINDS.map(({ kind, label, icon: Icon }) => (
          <button key={kind} onClick={() => open(kind)} className="btn btn-outline btn-sm">
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

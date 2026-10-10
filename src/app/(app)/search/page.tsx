"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, SearchX } from "lucide-react";
import type { UserLite } from "@/lib/types";
import { formatCount, normalizeCode } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { UserCode } from "@/components/ui/UserCode";
import { IdentityBadge } from "@/components/ui/Badges";
import { EmptyState } from "@/components/ui/Primitives";

type Result = UserLite & { supporters: number; location: string; isMe: boolean };

function Search() {
  const code = normalizeCode(useSearchParams().get("q") ?? "");
  const { data, isLoading, error } = useSWR<Result[]>(code ? `/api/users/search?q=${code}` : null);

  return (
    <div className="mx-auto max-w-[760px] space-y-4">
      <div>
        <h1 className="section-title text-[1.4rem]">
          Results for <span className="code-font text-brand-ink">#{code || "…"}</span>
        </h1>
        <p className="mt-1 text-[0.86rem] text-muted">People on RUHIZ are found by their unique code, not by name.</p>
      </div>
      {isLoading ? (
        <div className="card skeleton h-24" />
      ) : error ? (
        <p className="card p-6 text-center text-rose-300">{error.message}</p>
      ) : data?.length ? (
        <ul className="space-y-2.5">
          {data.map((u) => (
            <li key={u.code} className="card card-hover flex items-center gap-4 p-4">
              <Avatar code={u.code} src={u.avatarUrl} size="xl" link online={u.online} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <UserCode code={u.code} size="lg" verified={u.verifiedProfessional} />
                  {u.code === code && <span className="badge border-emerald-400/25 bg-emerald-500/10 text-emerald-300">Exact match</span>}
                  {u.isMe && <span className="badge border-brand/30 bg-brand/15 text-blue-200">You</span>}
                </div>
                <IdentityBadge mode={u.revealed ? "revealer" : "saver"} revealed={u.revealed ?? undefined} />
                {u.headline && <p className="mt-1 truncate text-[0.84rem] text-ink-2">{u.headline}</p>}
                <p className="text-[0.76rem] text-muted">
                  {formatCount(u.supporters)} Supporters{u.location ? ` · ${u.location}` : ""}
                </p>
              </div>
              <Link href={`/profile/${u.code}`} className="btn btn-outline btn-sm">
                Profile <ArrowRight className="size-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={SearchX}
          title="No user found"
          text={
            <>
              Nobody on RUHIZ has a code starting with <span className="code-font font-semibold text-ink">#{code}</span>. Codes are six letters and numbers, like #A1B2C3. Ask the person to copy theirs from their profile.
            </>
          }
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Search />
    </Suspense>
  );
}

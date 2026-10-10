"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { HandHeart, HeartHandshake, RotateCcw, Search, ShieldCheck } from "lucide-react";
import type { SupportListing } from "@/lib/types";
import { SUPPORT_AREAS } from "@/lib/meta";
import { normalizeCode } from "@/lib/utils";
import { useMe } from "@/store/store";
import { EmotionalSupportCard } from "@/components/support/SupportCard";
import { CrisisNote } from "@/components/support/SupportModals";
import { EmptyState, Segmented } from "@/components/ui/Primitives";

export default function SupportPage() {
  const me = useMe();
  const { data, error, isLoading, mutate } = useSWR<SupportListing[]>("/api/support-directory");
  const [areas, setAreas] = useState<string[]>([]);
  const [avail, setAvail] = useState<"all" | "available">("all");
  const [type, setType] = useState<"all" | "peer" | "professional">("all");
  const [lang, setLang] = useState("Any");
  const [q, setQ] = useState("");
  const code = normalizeCode(q);
  const all = useMemo(() => data ?? [], [data]);
  const mine = all.find((p) => p.isMe);

  const languages = useMemo(() => ["Any", ...Array.from(new Set(all.flatMap((p) => p.languages))).sort()], [all]);
  const list = all.filter(
    (p) =>
      (!areas.length || areas.some((a) => p.areas.includes(a))) &&
      (avail === "all" || p.availability === "available") &&
      (type === "all" || (type === "professional" ? p.professional : !p.professional)) &&
      (lang === "Any" || p.languages.includes(lang)) &&
      (!code || p.user.code.includes(code)),
  );
  const online = all.filter((p) => p.availability === "available").length;

  return (
    <div className="mx-auto max-w-[1000px] space-y-5">
      <section className="card relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-accent/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-brand/15 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="eyebrow !text-rose-300">Emotional Support</p>
          <h1 className="section-title mt-1.5 text-[1.6rem] leading-tight sm:text-[2rem]">You don't have to carry it alone</h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
            Find members who have volunteered to listen. Most are peers with lived experience, not clinicians. Licensed professionals are marked only after RUHIZ moderators verify their credentials.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[0.82rem] text-ink-2">
            {data && (
              <span className="inline-flex items-center gap-1.5">
                <span className="online-pulse size-2 rounded-full bg-emerald-400" /> {online} available now
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-sky-400" /> You appear only as #{me.code}
            </span>
          </div>
          <CrisisNote className="mt-4 max-w-xl" />
        </div>
      </section>

      {all.length > 0 && (
        <section className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} className="input code-font h-9 pl-9 text-[0.84rem]" placeholder="Find a supporter by code" aria-label="Find a supporter by code" />
            </div>
            <Segmented
              value={type}
              onChange={setType}
              options={[
                { id: "all", label: "All" },
                { id: "peer", label: "Peers" },
                { id: "professional", label: "Professionals" },
              ]}
            />
            <Segmented
              value={avail}
              onChange={setAvail}
              options={[
                { id: "all", label: "Any time" },
                { id: "available", label: "Available now" },
              ]}
            />
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="input h-9 w-auto text-[0.84rem]" aria-label="Language">
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l === "Any" ? "Any language" : l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORT_AREAS.map((a) => (
              <button key={a} onClick={() => setAreas((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))} data-on={areas.includes(a)} className="chip h-8 text-[0.78rem]">
                {a}
              </button>
            ))}
            {areas.length > 0 && (
              <button onClick={() => setAreas([])} className="text-[0.78rem] font-semibold text-brand-ink">
                Clear
              </button>
            )}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton h-60" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={RotateCcw} title="Couldn't load supporters" text={error.message} action={<button onClick={() => mutate()} className="btn btn-blue">Try again</button>} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="No supporters listed yet"
          text="Emotional Support is powered by members who volunteer to listen. Nobody has listed themselves yet. You can be the first, and you choose your areas and hours."
          action={
            <Link href="/settings#support" className="btn btn-red">
              Become a peer supporter
            </Link>
          }
        />
      ) : list.length ? (
        <>
          <p className="px-1 text-[0.82rem] text-muted">
            {list.length} {list.length === 1 ? "supporter" : "supporters"}
            {areas.length ? ` for ${areas.join(", ")}` : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <EmotionalSupportCard key={p.user.code} p={p} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState icon={HeartHandshake} title="No supporters match" text="Try fewer filters." />
      )}

      <section className="card flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/10 text-rose-300">
          <HandHeart className="size-6" />
        </span>
        <div className="flex-1">
          <h2 className="section-title text-[1rem]">{mine ? "You're listed as a supporter" : "Could you be there for someone?"}</h2>
          <p className="mt-0.5 text-[0.85rem] text-muted">
            {mine ? `People can reach you about ${mine.areas.join(", ")}. Change this anytime in Settings.` : "Volunteer as a peer listener for the areas you're comfortable with. Licensed professionals can apply for verification."}
          </p>
        </div>
        <Link href="/settings#support" className="btn btn-outline">
          {mine ? "Manage" : "Become a supporter"}
        </Link>
      </section>
    </div>
  );
}

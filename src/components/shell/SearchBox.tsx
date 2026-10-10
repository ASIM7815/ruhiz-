"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, Hash, Loader2, Search, SearchX, X } from "lucide-react";
import type { UserLite } from "@/lib/types";
import { cn, formatCount, normalizeCode } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

type Result = UserLite & { supporters: number; location: string };

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = window.setTimeout(() => setD(v), ms);
    return () => window.clearTimeout(t);
  }, [v, ms]);
  return d;
}

/** Global people search. RUHIZ finds people by unique code, never by name. */
export function SearchBox({ autoFocus, onDone, className }: { autoFocus?: boolean; onDone?: () => void; className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const code = normalizeCode(q);
  const debounced = useDebounced(code, 180);
  const { data: results = [], isLoading } = useSWR<Result[]>(debounced ? `/api/users/search?q=${debounced}` : null);

  useEffect(() => setActive(0), [code]);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    input.current?.blur();
    onDone?.();
    router.push(href);
  };

  const submit = () => {
    if (!code) return;
    const target = results[active];
    if (target && (target.code === code || results.length === 1)) go(`/profile/${target.code}`);
    else go(`/search?q=${code}`);
  };

  const pending = code !== debounced || isLoading;

  return (
    <div ref={wrap} className={cn("relative w-full", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          "group flex h-11 items-center gap-2.5 rounded-full border bg-[#040b22]/80 pl-4 pr-1.5 transition-all",
          open ? "border-brand/60 shadow-[0_0_0_4px_rgba(47,123,255,.14),0_10px_30px_-12px_rgba(47,123,255,.5)]" : "border-line-strong hover:border-brand/40",
        )}
      >
        <Search className="size-[1.15rem] shrink-0 text-muted" aria-hidden />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Escape") {
              setOpen(false);
              input.current?.blur();
            }
          }}
          placeholder="Search users by code (e.g. #A1B2C3)"
          aria-label="Search users by unique code"
          aria-expanded={open}
          aria-autocomplete="list"
          spellCheck={false}
          autoComplete="off"
          maxLength={8}
          className="min-w-0 flex-1 bg-transparent text-[0.9rem] text-ink placeholder:text-muted focus:outline-none"
        />
        {q ? (
          <button type="button" onClick={() => setQ("")} className="grid size-8 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-ink" aria-label="Clear search">
            <X className="size-4" />
          </button>
        ) : (
          <kbd className="mr-2 hidden rounded-md border border-line px-1.5 py-0.5 text-[0.68rem] font-semibold text-faint sm:inline">/</kbd>
        )}
      </form>

      {open && (
        <div className="anim-scale absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line-strong bg-[var(--card-solid)] shadow-[0_30px_60px_-20px_rgba(0,0,0,.95)]">
          {!code ? (
            <div className="p-4">
              <p className="eyebrow mb-2">Find people by their RUHIZ code</p>
              <p className="flex items-start gap-2 text-[0.8rem] leading-relaxed text-muted">
                <Hash className="mt-0.5 size-3.5 shrink-0 text-brand-ink" />
                Every member has a unique 6-character code, shown on their profile. Names are never searchable, so people can take part without exposing who they are.
              </p>
            </div>
          ) : pending && !results.length ? (
            <div className="flex items-center gap-2 p-4 text-[0.84rem] text-muted">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </div>
          ) : results.length ? (
            <ul role="listbox" className="p-1.5">
              {results.slice(0, 6).map((u, i) => (
                <li key={u.code} role="option" aria-selected={i === active}>
                  <button onMouseEnter={() => setActive(i)} onClick={() => go(`/profile/${u.code}`)} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left", i === active ? "bg-brand/12" : "hover:bg-white/[.04]")}>
                    <Avatar code={u.code} src={u.avatarUrl} size="md" online={u.online} />
                    <span className="min-w-0 flex-1">
                      <span className="code-font block font-semibold text-ink">
                        <span className="text-brand-ink">#{u.code.slice(0, code.length)}</span>
                        {u.code.slice(code.length)}
                      </span>
                      <span className="block truncate text-[0.78rem] text-muted">
                        {u.headline || "RUHIZ member"} · {formatCount(u.supporters)} Supporters
                      </span>
                    </span>
                    {u.code === code && <span className="badge border-emerald-400/25 bg-emerald-500/10 text-emerald-300">Exact match</span>}
                    <ArrowRight className="size-4 text-faint" />
                  </button>
                </li>
              ))}
              <li>
                <button onClick={() => go(`/search?q=${code}`)} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border-t border-line px-3 py-2.5 text-[0.82rem] font-semibold text-brand-ink hover:bg-white/[.03]">
                  See all results for <span className="code-font">#{code}</span>
                </button>
              </li>
            </ul>
          ) : (
            <div className="flex items-start gap-3 p-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-rose-300">
                <SearchX className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-ink">
                  No user with code <span className="code-font">#{code}</span>
                </p>
                <p className="mt-0.5 text-[0.8rem] text-muted">Codes are 6 characters, like #A1B2C3. Ask the person to share their code from their profile.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

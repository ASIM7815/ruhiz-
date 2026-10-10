"use client";

import { useEffect } from "react";
import { RotateCcw, WifiOff } from "lucide-react";

/** Shown when a page in the app can't load (e.g. the database or auth service is unreachable). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="card max-w-md p-8 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-line-strong bg-elev text-brand-ink">
          <WifiOff className="size-6" />
        </div>
        <h1 className="section-title mt-5 text-xl">RUHIZ couldn't load</h1>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-muted">We couldn't reach our servers just now. Your account and data are safe. Please try again in a moment.</p>
        {error.digest && <p className="code-font mt-3 text-[0.72rem] text-faint">Reference: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={reset} className="btn btn-blue">
            <RotateCcw className="size-4" /> Try again
          </button>
          <a href="/" className="btn btn-ghost">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

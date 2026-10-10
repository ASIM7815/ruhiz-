import Link from "next/link";

/** Shared frame for Sign In / Sign Up / password reset. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-12">
      <div className="pointer-events-none absolute left-1/2 top-0 size-[520px] -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]" />
      <div className="relative w-full max-w-[420px]">
        <Link href="/" className="mb-6 flex justify-center" aria-label="RUHIZ home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ruhiz-logo.png" alt="RUHIZ" className="h-10 w-auto drop-shadow-[0_4px_16px_rgba(47,123,255,.35)]" />
        </Link>
        <div className="card anim-scale p-6 sm:p-7">
          <h1 className="section-title text-[1.35rem]">{title}</h1>
          <p className="mt-1 text-[0.88rem] text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-[0.86rem] text-muted">{footer}</div>}
      </div>
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.2s2.69-6.2 6-6.2c1.88 0 3.15.8 3.87 1.5l2.64-2.55C16.83 3.2 14.63 2.2 12 2.2 6.98 2.2 2.9 6.3 2.9 12s4.08 9.8 9.1 9.8c5.25 0 8.73-3.7 8.73-8.9 0-.6-.07-1.05-.15-1.5H12z" />
    </svg>
  );
}

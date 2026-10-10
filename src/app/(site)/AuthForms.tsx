"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { GoogleIcon } from "./AuthCard";

type AuthErr = { code?: string; message?: string; status?: number } | null | undefined;

/** Only allow same-site relative redirects after sign-in (prevents open redirects). */
function safeNext(raw: string | null, fallback: string) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

const go = (path: string) => window.location.assign(path); // full load so the server sees the new session cookie

function Alert({ text, tone = "error" }: { text: string | null; tone?: "error" | "info" }) {
  if (!text) return null;
  return (
    <p role={tone === "error" ? "alert" : "status"} className={tone === "error" ? "flex items-start gap-2 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[0.84rem] text-rose-200" : "flex items-start gap-2 rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-[0.84rem] text-sky-100"}>
      {tone === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <MailCheck className="mt-0.5 size-4 shrink-0" />} {text}
    </p>
  );
}

function PasswordInput({ value, onChange, autoComplete, label = "Password", id }: { value: string; onChange: (v: string) => void; autoComplete: string; label?: string; id: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-2">{label}</span>
      <span className="relative block">
        <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required minLength={8} maxLength={128} className="input pr-10" />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  );
}

function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const { error } = await authClient.signIn.social({ provider: "google", callbackURL: `${window.location.origin}${next}` });
          if (error) {
            setError(authErrorMessage(error));
            setBusy(false);
          }
        }}
        className="btn btn-outline w-full"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />} Continue with Google
      </button>
      {error && <div className="mt-2"><Alert text={error} /></div>}
      <div className="my-5 flex items-center gap-3 text-[0.74rem] uppercase tracking-wider text-faint">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

/** Enter the 6-digit code emailed by Neon Auth. Verifying signs the user in. */
function VerifyEmail({ email, next, onBack }: { email: string; next: string; onBack: () => void }) {
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(`We sent a verification code to ${email}. It expires in 15 minutes.`);
  const [cooldown, setCooldown] = useState(30);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await authClient.emailOtp.verifyEmail({ email, otp: otp.trim() });
    if (error) {
      setError(authErrorMessage(error as AuthErr));
      setBusy(false);
      return;
    }
    if ((data as { token?: string; status?: boolean } | null) && (await authClient.getSession()).data?.user) go(next);
    else {
      setInfo("Email verified. Please sign in.");
      setBusy(false);
      onBack();
    }
  };

  const resend = async () => {
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    if (error) setError(authErrorMessage(error as AuthErr));
    else {
      setInfo(`A new code was sent to ${email}.`);
      setCooldown(30);
    }
  };

  return (
    <form onSubmit={verify} className="space-y-4">
      <Alert text={info} tone="info" />
      <label className="block">
        <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-2">Verification code</span>
        <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" autoFocus required className="input code-font text-center text-lg tracking-[0.4em]" placeholder="••••••" />
      </label>
      <Alert text={error} />
      <button type="submit" disabled={busy || otp.length < 4} className="btn btn-red btn-lg w-full">
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Verify and continue"}
      </button>
      <div className="flex items-center justify-between text-[0.82rem]">
        <button type="button" onClick={onBack} className="text-muted hover:text-ink">
          Use a different email
        </button>
        <button type="button" onClick={resend} disabled={cooldown > 0} className="font-semibold text-brand-ink disabled:text-faint">
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "verify">("form");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Your password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    // Name is required by the auth provider but never shown publicly; RUHIZ identifies people by code.
    const { data, error } = await authClient.signUp.email({ email: email.trim(), password, name: "RUHIZ member" });
    if (error) {
      setError(authErrorMessage(error as AuthErr));
      setBusy(false);
      return;
    }
    if (data?.user && !data.user.emailVerified) {
      // Neon Auth emails the code on sign-up; requesting another here would invalidate it.
      setStep("verify");
      setBusy(false);
      return;
    }
    go("/welcome");
  };

  if (step === "verify") return <VerifyEmail email={email.trim()} next="/welcome" onBack={() => setStep("form")} />;

  return (
    <>
      <GoogleButton next="/welcome" />
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-2">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} className="input" />
          <span className="mt-1 block text-[0.74rem] text-faint">Private. Used only to sign in and for account emails.</span>
        </label>
        <PasswordInput id="pw" value={password} onChange={setPassword} autoComplete="new-password" />
        <PasswordInput id="pw2" value={confirm} onChange={setConfirm} autoComplete="new-password" label="Confirm password" />
        <Alert text={error} />
        <button type="submit" disabled={busy} className="btn btn-red btn-lg w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
        </button>
        <p className="text-center text-[0.74rem] leading-relaxed text-faint">You'll get a unique code like #A1B2C3 as your public identity. You can share as Identity Saver and never reveal your name.</p>
      </form>
    </>
  );
}

export function SignInForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("verify") ? "Please verify your email address to continue." : null);
  const [step, setStep] = useState<"form" | "verify">("form");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    if (error) {
      if ((error as AuthErr)?.code === "EMAIL_NOT_VERIFIED") {
        await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "email-verification" });
        setStep("verify");
      } else setError(authErrorMessage(error as AuthErr));
      setBusy(false);
      return;
    }
    go(next);
  };

  if (step === "verify") return <VerifyEmail email={email.trim()} next={next} onBack={() => setStep("form")} />;

  return (
    <>
      <GoogleButton next={next} />
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-2">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className="input" />
        </label>
        <PasswordInput id="pw" value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="text-right">
          <Link href="/forgot-password" className="text-[0.8rem] font-semibold text-brand-ink hover:text-white">
            Forgot password?
          </Link>
        </div>
        <Alert text={error} />
        <button type="submit" disabled={busy} className="btn btn-red btn-lg w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign In"}
        </button>
      </form>
    </>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email: email.trim() });
    setBusy(false);
    // Don't reveal whether an account exists: move on unless the request itself failed.
    if (error && (error as AuthErr)?.status !== 404) return setError(authErrorMessage(error as AuthErr));
    setStep("reset");
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Your password must be at least 8 characters.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.resetPassword({ email: email.trim(), otp: otp.trim(), password });
    setBusy(false);
    if (error) return setError(authErrorMessage(error as AuthErr));
    setStep("done");
  };

  if (step === "done")
    return (
      <div className="space-y-4">
        <Alert text="Your password has been reset. You can sign in now." tone="info" />
        <Link href="/sign-in" className="btn btn-red btn-lg w-full">
          Sign In
        </Link>
      </div>
    );

  if (step === "reset")
    return (
      <form onSubmit={reset} className="space-y-4">
        <Alert text={`If an account exists for ${email}, we've emailed a reset code.`} tone="info" />
        <label className="block">
          <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-2">Reset code</span>
          <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" autoComplete="one-time-code" required className="input code-font text-center text-lg tracking-[0.4em]" />
        </label>
        <PasswordInput id="npw" value={password} onChange={setPassword} autoComplete="new-password" label="New password" />
        <Alert text={error} />
        <button type="submit" disabled={busy || otp.length < 4} className="btn btn-red btn-lg w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Reset password"}
        </button>
      </form>
    );

  return (
    <form onSubmit={request} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[0.8rem] font-semibold text-ink-2">Email</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className="input" />
      </label>
      <Alert text={error} />
      <button type="submit" disabled={busy} className="btn btn-red btn-lg w-full">
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Send reset code"}
      </button>
    </form>
  );
}

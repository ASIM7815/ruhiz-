import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/session";
import { AuthCard } from "../AuthCard";
import { SignInForm } from "../AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign In" };

export default async function SignInPage() {
  if (await getViewer().catch(() => null)) redirect("/home");
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue to RUHIZ."
      footer={
        <>
          New to RUHIZ?{" "}
          <Link href="/sign-up" className="font-semibold text-brand-ink hover:text-white">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}

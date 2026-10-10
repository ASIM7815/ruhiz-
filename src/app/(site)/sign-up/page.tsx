import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/session";
import { AuthCard } from "../AuthCard";
import { SignUpForm } from "../AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign Up" };

export default async function SignUpPage() {
  if (await getViewer().catch(() => null)) redirect("/home");
  return (
    <AuthCard
      title="Create your account"
      subtitle="Bring problems, share experiences and help others."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-brand-ink hover:text-white">
            Sign In
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}

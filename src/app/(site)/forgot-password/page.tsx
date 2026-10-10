import Link from "next/link";
import { AuthCard } from "../AuthCard";
import { ForgotPasswordForm } from "../AuthForms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a code to set a new password."
      footer={
        <Link href="/sign-in" className="font-semibold text-brand-ink hover:text-white">
          Back to Sign In
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}

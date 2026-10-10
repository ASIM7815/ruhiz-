import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="section-title mt-2 text-2xl">This page doesn't exist</h1>
      <p className="mt-2 text-muted">The link may be broken, or the page was moved.</p>
      <Link href="/" className="btn btn-blue mt-6">
        Back to Home
      </Link>
    </div>
  );
}

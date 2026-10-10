/** Runs once when the server starts (locally and on Vercel), before any request is handled. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation-node");
}

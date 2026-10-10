import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

/**
 * Node's fetch tries each resolved address for only 250 ms before giving up on it ("happy
 * eyeballs"). On high-latency or IPv6-less networks every attempt can time out, which breaks
 * Neon Auth session checks and Neon database queries. A longer per-address timeout keeps fast
 * networks fast and makes slow ones work.
 */
setDefaultAutoSelectFamilyAttemptTimeout(Number(process.env.NETWORK_ATTEMPT_TIMEOUT_MS) || 2500);

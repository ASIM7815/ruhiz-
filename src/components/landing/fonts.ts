import { Sora } from "next/font/google";

/** Display face for the public landing page only (loaded with this route, not the app). */
export const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["500", "600", "700", "800"], display: "swap" });

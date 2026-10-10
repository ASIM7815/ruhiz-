import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["500", "600", "700", "800"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "RUHIZ — Bring a problem. Find the people who can help.", template: "%s · RUHIZ" },
  description:
    "RUHIZ is a social platform built around real problems. Share experiences, bring evidence, discuss respectfully, propose solutions and move toward real-world outcomes.",
};

export const viewport: Viewport = {
  themeColor: "#040a1c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="navy" className={`${inter.variable} ${jakarta.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

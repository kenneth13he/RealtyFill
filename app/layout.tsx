// app/layout.tsx
// Root layout for the Next.js App Router. Wraps every page (intake, review, etc.)
// with shared HTML shell/providers. Loads Outfit via next/font (self-hosted at
// build time, no runtime request to Google Fonts) as the app's one typeface —
// previously the system font stack, which read as "unfinished" on the landing
// page per REMAINING_WORK.md item 20.

import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

// Geometric rather than neutral: the landing page runs very large display
// type, and Outfit holds its character at those sizes where Inter flattens out.
const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "RealtyFill",
  description: "Five Ontario lease forms, one intake form. Fill it out once, review it, download all five.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

// app/layout.tsx
// Root layout for the Next.js App Router. Wraps every page (intake, review, etc.)
// with shared HTML shell/providers. No auth logic yet — Phase 2 Step 9 (Auth)
// will likely wrap {children} here with a session provider.

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RealtyFill",
  description: "Fill out one deal intake form, generate the Ontario lease paperwork it feeds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

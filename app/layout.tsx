// app/layout.tsx
// Root layout for the Next.js App Router. Wraps every page (intake, review, etc.)
// with shared HTML shell/providers. No auth or theming logic yet — Phase 2 Step 9
// (Auth) will likely wrap {children} here with a session provider.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

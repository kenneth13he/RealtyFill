// app/opengraph-image.tsx
// The image that shows when a realtor pastes a realtyfill link into a text,
// an email or Slack. Without this the preview card renders as a blank
// rectangle with the title beside it — the exact "is this real?" signal you
// don't want when the audience is deciding whether to trust the app with
// client paperwork.
//
// Generated rather than a checked-in PNG so the wordmark and the palette stay
// tied to the same brand tokens as the rest of the app (globals.css:
// --brand-deep #14124a, --lime #c9f73d) instead of drifting the moment
// someone changes a colour.
//
// Written against node_modules/next/dist/docs/.../metadata/opengraph-image.md:
// the file convention wants `alt`, `size` and `contentType` exports plus a
// default function returning an ImageResponse. Note this renders through
// satori, not a browser — it supports a subset of CSS, and every element with
// more than one child needs an explicit `display: flex`.

import { ImageResponse } from "next/og";

export const alt = "RealtyFill — Ontario lease and sale forms, filled from one intake";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#14124a",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Renders as "realty fill" with a slight gap, and the body copy below
            has wide word spacing for the same reason: satori falls back to its
            built-in font here. Outfit isn't usable — next/font emits woff2,
            which satori can't parse, and the files only exist after a build.
            Fixing it properly means fetching an Outfit .ttf at render time,
            which would make this image fail whenever that fetch does. Not
            worth it for a preview card; revisit if the font ever ships as a
            local .ttf. */}
        <div style={{ display: "flex", alignItems: "center", fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em" }}>
          <span style={{ color: "#ffffff" }}>realty</span>
          <span style={{ color: "#c9f73d" }}>fill</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 82,
              fontWeight: 600,
              color: "#ffffff",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 940,
            }}
          >
            One intake form. Every form filled.
          </div>
          <div style={{ fontSize: 34, color: "#a9a7d4", marginTop: 28, maxWidth: 880 }}>
            Ontario lease and sale paperwork, filled from details you enter once — reviewed by you before
            anything is generated.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", width: 56, height: 6, backgroundColor: "#c9f73d" }} />
          <div style={{ fontSize: 26, color: "#a9a7d4", marginLeft: 20 }}>
            Signature fields are never auto-filled
          </div>
        </div>
      </div>
    ),
    size
  );
}

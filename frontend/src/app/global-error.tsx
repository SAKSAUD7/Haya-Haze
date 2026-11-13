"use client";

/** Last-resort error screen (the root layout itself failed), so it carries its own styles. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#FFF8F6", color: "#4A2C2A", fontFamily: "Georgia, serif" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
          <div>
            <p style={{ fontSize: 34, margin: 0 }}>Haya <span style={{ color: "#C9A84C" }}>&amp;</span> Haze</p>
            <h1 style={{ fontWeight: 500, fontSize: 40, margin: "24px 0 8px" }}>We will be right back</h1>
            <p style={{ fontFamily: "Arial, sans-serif", color: "#7B4F3A", maxWidth: 420, margin: "0 auto 24px" }}>
              The store hit an unexpected problem. Please try again in a moment.
            </p>
            <button
              onClick={reset}
              style={{ background: "#7B4F3A", color: "#FFF8F6", border: 0, borderRadius: 999, padding: "14px 30px", fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

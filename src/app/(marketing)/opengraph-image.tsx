import { ImageResponse } from "next/og";

/**
 * The card people actually see when a teacher pastes the link into a staffroom
 * group. Applies to every page in the marketing group, legal pages included.
 *
 * Painted in the dark palette regardless of the visitor's theme — a social card
 * is a fixed image with no viewer to adapt to, and dark reads better against
 * the light chrome every messaging app wraps it in. Colours are the sRGB
 * equivalents of the `--lp-*` dark tokens in `globals.css`; satori resolves no
 * CSS variables, so they have to be literals here. No custom font is loaded:
 * Geist ships woff2, which satori cannot parse, and `next/og`'s bundled default
 * is close enough at this size to not be worth shipping a TTF for.
 */

export const alt = "LessonPlay — turn a chemistry chapter into a playable lab";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 76,
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          // The same violet/cyan wash the hero sits on, flattened to two blobs.
          backgroundImage:
            "radial-gradient(900px 520px at 12% -10%, rgba(124,58,237,0.30), transparent 60%), radial-gradient(760px 460px at 96% 8%, rgba(34,211,238,0.16), transparent 62%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              backgroundColor: "#7c3aed",
            }}
          />
          <div style={{ fontSize: 27, fontWeight: 600, letterSpacing: -0.4 }}>
            LessonPlay
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              fontSize: 78,
              fontWeight: 600,
              letterSpacing: -2.4,
              lineHeight: 1.08,
            }}
          >
            <span>Your chemistry chapter,&nbsp;</span>
            <span style={{ color: "#a78bfa" }}>as a game</span>
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 30,
              lineHeight: 1.4,
              color: "#a1a1aa",
              maxWidth: 880,
            }}
          >
            Describe a lesson. Get a real, playable lab simulation you can
            reason your way through — shared as one link.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#a1a1aa",
          }}
        >
          <div style={{ display: "flex" }}>lessonplay.space</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 999,
              border: "1px solid rgba(250,250,250,0.16)",
              padding: "9px 20px",
              fontSize: 21,
              color: "#fafafa",
            }}
          >
            Chemistry · Classes 8–10 · Free beta
          </div>
        </div>
      </div>
    ),
    size,
  );
}

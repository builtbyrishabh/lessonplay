/**
 * Tiny User-Timing harness for the "home → first message" critical path.
 *
 * Both experiment branches (A: inline-optimized, B: query-param SPA) instrument
 * the SAME marks so the traces line up side by side. `submit` resets the clock;
 * every later mark logs its delta from that submit and is collected for a final
 * `lpReport()` table once the first assistant token lands.
 *
 * Read it in the browser console: each mark logs `[lp-perf] <name> +<ms>`, and
 * `first-token` prints a console.table of the whole sequence. `performance.mark`
 * is also emitted, so the marks show up on the DevTools Performance timeline.
 */

const LABELS = [
  "submit", // user hit send on the home page
  "navigate", // route push / shallow URL update issued
  "provider-mount", // ChatProvider saw the handoff and began sending
  "dispatch", // upload resolved, sendMessage fired
  "user-paint", // the user's own bubble hit the DOM
  "first-token", // the first assistant token rendered
] as const;

export type PerfLabel = (typeof LABELS)[number];

let t0: number | null = null;
let trail: { name: PerfLabel; deltaMs: number }[] = [];

export function lpMark(name: PerfLabel) {
  if (typeof performance === "undefined") return;
  const now = performance.now();
  if (name === "submit") {
    t0 = now;
    trail = [];
  }
  try {
    performance.mark(`lp:${name}`);
  } catch {
    // Marking is best-effort; never let instrumentation break the flow.
  }
  const deltaMs = t0 == null ? 0 : Math.round(now - t0);
  if (t0 != null) trail.push({ name, deltaMs });
  // eslint-disable-next-line no-console
  console.log(
    `%c[lp-perf]%c ${name} %c+${deltaMs}ms`,
    "color:#6366f1;font-weight:600",
    "color:inherit",
    "color:#10b981;font-weight:600",
  );
  if (name === "first-token") lpReport();
}

/** Dump the collected trail as a table — the whole home→first-token waterfall. */
export function lpReport() {
  if (typeof console === "undefined" || trail.length === 0) return;
  // eslint-disable-next-line no-console
  console.table(trail);
}

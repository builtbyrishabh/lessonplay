"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { RefreshIcon, SparklesIcon } from "~/lib/icons";
import { api } from "~/trpc/react";

/**
 * The published game, in an iframe.
 *
 * Points at the VERSIONED key (`versions/<n>.html`), not `current/index.html`.
 * That URL never changes content, so the CDN can cache it and no cache-buster
 * is needed — and it is what lets the picker show an older version. The
 * teacher's shareable link stays `current/`, which every publish overwrites.
 *
 * Cross-origin by construction (the game is served from R2, the app from
 * Vercel), so this can render the game but cannot read into it. Sandboxed
 * accordingly: the game is model-authored code and gets no more privilege than
 * it needs to run.
 */
export function GamePreview({
  threadId,
  isBuilding,
}: {
  threadId: string;
  isBuilding: boolean;
}) {
  const versions = api.games.list.useQuery({ threadId });
  // null means "follow the newest". Storing the CHOICE rather than the current
  // version is what lets a fresh publish move the pane forward on its own: had
  // this held a version number from the start, it would have pinned itself to
  // whatever existed on first render and silently stayed there.
  const [pinnedVersion, setPinnedVersion] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const list = versions.data ?? [];
  const latest = list[0] ?? null;
  const current =
    (pinnedVersion === null
      ? latest
      : list.find((v) => v.version === pinnedVersion)) ??
    latest;

  if (versions.isPending) {
    return (
      <Centered>
        <Spinner className="text-muted-foreground" />
      </Centered>
    );
  }

  if (!current) {
    return (
      <Centered>
        <SparklesIcon className="text-muted-foreground/60" height={20} width={20} />
        <p className="text-muted-foreground max-w-xs text-center text-sm">
          {isBuilding
            ? "Building the lab — it appears here once it passes the checks and publishes."
            : "No game published yet. Ask for a lab and it will show up here."}
        </p>
      </Centered>
    );
  }

  if (!current.url) {
    return (
      <Centered>
        <p className="text-muted-foreground max-w-xs text-center text-sm">
          Version {current.version} is saved, but no public URL is configured.
          Set <code className="font-mono text-[12px]">R2_PUBLIC_BASE_URL</code>{" "}
          to preview it.
        </p>
      </Centered>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex h-9 shrink-0 items-center gap-2 border-b px-2">
        <select
          className="bg-background text-foreground border-border h-6 rounded border px-1.5 text-[11px]"
          onChange={(e) => {
            const picked = Number(e.target.value);
            // Choosing the newest goes back to following it, rather than
            // freezing on a number that the next publish would supersede.
            setPinnedVersion(picked === latest?.version ? null : picked);
          }}
          value={current.version}
        >
          {list.map((v) => (
            <option key={v.version} value={v.version}>
              Version {v.version}
              {v.version === latest?.version ? " (latest)" : ""}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px]">
          {current.label}
        </span>
        <Button
          onClick={() => setReloadKey((k) => k + 1)}
          size="icon-sm"
          title="Reload the game"
          variant="ghost"
        >
          <RefreshIcon height={13} width={13} />
        </Button>
        <Button asChild size="sm" variant="ghost">
          <a href={current.url} rel="noopener noreferrer" target="_blank">
            Open
          </a>
        </Button>
      </div>
      <iframe
        // Remounts on demand so "reload" genuinely restarts the game rather
        // than relying on the iframe's own history.
        key={`${current.version}-${reloadKey}`}
        // The game viewport is a fixed 9:16 column (430px cap) and the game
        // paints no background outside it, so this colour IS the letterbox on
        // either side. Black reads as a stage rather than as unstyled page, and
        // holds in both themes; the frame supplies its own surface either way.
        className="min-h-0 w-full flex-1 border-0 bg-black"
        // Note the omission of allow-same-origin. Every user's game is served
        // from the SAME r2.dev origin, so with it one game could read another
        // game's localStorage; without it each preview gets an opaque origin
        // and cannot. The engine keeps session state in its reducer and touches
        // no browser storage, so nothing is given up today — but a game that
        // starts using localStorage will throw SecurityError here rather than
        // fail quietly, which is the failure we want.
        sandbox="allow-scripts allow-popups allow-forms"
        src={current.url}
        title={`Lab preview, version ${current.version}`}
      />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex h-full flex-col items-center justify-center gap-3 p-6">
      {children}
    </div>
  );
}

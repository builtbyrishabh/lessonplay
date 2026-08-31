"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Logo } from "~/components/brand/logo";
import { Button } from "~/components/ui/button";
import { CrossIcon, MenuIcon, MoonIcon, SunIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#games", label: "What you can build" },
  { href: "#gate", label: "Why it's playable" },
  { href: "#faq", label: "FAQ" },
] as const;

/** Swaps light/dark. Renders a stable placeholder until mounted so the icon
 *  never flips after hydration (the theme isn't known on the server). */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = resolvedTheme === "dark";

  return (
    <Button
      aria-label={mounted ? `Switch to ${dark ? "light" : "dark"} theme` : "Switch theme"}
      className="text-muted-foreground hover:text-foreground size-9 rounded-full"
      onClick={() => setTheme(dark ? "light" : "dark")}
      size="icon"
      variant="ghost"
    >
      {mounted && dark ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
    </Button>
  );
}

export function MarketingNav() {
  // Clerk Core 3 has no <SignedIn>/<SignedOut>; the session is a hook, and it
  // resolves after mount — so the auth slot renders a fixed-size placeholder
  // first rather than popping the whole nav sideways.
  const { isLoaded, isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A menu open over a scrollable page is a scroll trap on mobile; lock behind it.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-border/70 bg-background/80 border-b backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5 sm:px-8"
      >
        <Link
          className="focus-visible:ring-ring/50 rounded-md focus-visible:ring-3 focus-visible:outline-none"
          href="/"
        >
          <Logo className="text-foreground text-[15px] font-semibold tracking-tight" />
        </Link>

        <ul className="mx-auto hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
                href={link.href}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />

          {!isLoaded ? (
            <span aria-hidden="true" className="bg-muted h-9 w-32 rounded-full" />
          ) : isSignedIn ? (
            <Button
              asChild
              className="bg-lp-brand text-lp-on-brand h-9 rounded-full px-4 shadow-sm transition-transform hover:brightness-110 active:scale-[0.98]"
            >
              <Link href="/chats">Open the studio</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                className="hidden h-9 rounded-full px-4 sm:inline-flex"
                variant="ghost"
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button
                asChild
                className="bg-lp-brand text-lp-on-brand h-9 rounded-full px-4 shadow-sm transition-transform hover:brightness-110 active:scale-[0.98]"
              >
                <Link href="/sign-up">Start building</Link>
              </Button>
            </>
          )}

          <Button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="size-9 rounded-full md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            size="icon"
            variant="ghost"
          >
            {menuOpen ? (
              <CrossIcon className="size-4" />
            ) : (
              <MenuIcon className="size-4" />
            )}
          </Button>
        </div>
      </nav>

      {menuOpen ? (
        <div className="border-border/70 bg-background/95 border-t backdrop-blur-xl md:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col px-5 py-2 sm:px-8">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  className="text-foreground hover:bg-muted flex min-h-11 items-center rounded-lg px-2 text-[15px] font-medium"
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
            {isLoaded && !isSignedIn ? (
              <li>
                <Link
                  className="text-foreground hover:bg-muted flex min-h-11 items-center rounded-lg px-2 text-[15px] font-medium"
                  href="/sign-in"
                  onClick={() => setMenuOpen(false)}
                >
                  Sign in
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </header>
  );
}

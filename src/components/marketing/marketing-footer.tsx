import Link from "next/link";

import { Logo } from "~/components/brand/logo";
import { Container } from "~/components/marketing/section";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "What you can build", href: "#games" },
      { label: "Why it's playable", href: "#gate" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { label: "Create an account", href: "/sign-up" },
      { label: "Sign in", href: "/sign-in" },
      { label: "Open the studio", href: "/chats" },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-border/70 border-t py-14">
      <Container>
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Logo className="text-foreground text-[15px] font-semibold tracking-tight" />
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              A studio for turning science chapters into games students actually
              play. Chemistry first.
            </p>
          </div>

          <div className="flex gap-14">
            {COLUMNS.map((column) => (
              <div key={column.heading}>
                <h2 className="text-foreground text-xs font-semibold tracking-[0.12em] uppercase">
                  {column.heading}
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        href={link.href}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-border/70 text-muted-foreground mt-12 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} LessonPlay</p>
          <p>Beta — chemistry only, for now.</p>
        </div>
      </Container>
    </footer>
  );
}

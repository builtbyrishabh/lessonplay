import "~/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { TooltipProvider } from "~/components/ui/tooltip";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "LessonPlay",
  description: "Give it a chemistry chapter. Get a playable lab.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        {/* next-themes rewrites <html>'s className, so the next/font variable
            classes have to live here. `globals.css` applies `font-sans` to
            `body` for the same reason. */}
        <body
          className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange
            enableSystem
            storageKey="theme"
          >
            <TRPCReactProvider>
              <NuqsAdapter>
                <TooltipProvider delayDuration={300}>
                  {children}
                </TooltipProvider>
              </NuqsAdapter>
            </TRPCReactProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

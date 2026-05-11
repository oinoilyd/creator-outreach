import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BulkJobProvider } from "@/components/BulkJobProvider";
import { BulkJobBar } from "@/components/BulkJobBar";
import { CookieConsent } from "@/components/CookieConsent";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Newsreader — display serif used for editorial pull-quote
// headlines on the landing page and roadmap (e.g. the "Why this
// exists" pain statements). Loaded with display: swap so we don't
// block paint.
//
// Trimmed to italic 400 only (was 4 weights × 2 styles = 8 files).
// Both real usages — WhyThisExists.tsx and app/roadmap/page.tsx —
// render the serif as `italic font-normal`. The other weights were
// being preloaded but never rendered.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  weight: ["400"],
  style: ["italic"],
});

/**
 * Root metadata — drives the browser tab title, URL preview cards
 * (Slack / iMessage / Twitter / LinkedIn share unfurls), and search
 * engine snippets.
 *
 * Title uses a template so child pages can override the prefix
 * (e.g. /admin sets `Admin · Users` and the browser tab reads
 * "Admin · Users · Creator Outreach"). Pages that don't override
 * fall back to the default below.
 *
 * metadataBase is required by Next.js when relative URLs are used
 * in OG images — point it at the production domain.
 *
 * The dynamic OG image lives at app/opengraph-image.tsx and is
 * auto-detected by Next.js — no explicit `images` array needed
 * here unless you want to override per-route.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://creatoroutreach.net"),
  title: {
    default: "Creator Outreach — Find & email creators worth reaching",
    template: "%s · Creator Outreach",
  },
  description:
    "Search YouTube, Instagram, TikTok, X, and LinkedIn in parallel. Score every result against criteria you write in plain English. Reach out from one queue.",
  keywords: [
    "creator outreach",
    "creator marketing",
    "influencer outreach",
    "youtube email finder",
    "creator email tool",
    "influencer crm",
  ],
  applicationName: "Creator Outreach",
  authors: [{ name: "Creator Outreach" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://creatoroutreach.net",
    siteName: "Creator Outreach",
    title: "Creator Outreach — Find & email creators worth reaching",
    description:
      "Search creators across YouTube, IG, TikTok, X, and LinkedIn. Score every result against criteria you wrote in plain English. Reach out from one queue.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Creator Outreach",
    description:
      "Find & email creators worth reaching — across YouTube, IG, TikTok, X, and LinkedIn.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // BulkJobProvider + BulkJobBar are mounted UNCONDITIONALLY (rewritten
  // 2026-05-09). The previous version did a server-side cookie auth
  // check here to gate the provider on isAdmin — but if that check
  // ever flickered between true/false during navigation (auth race,
  // cookie blip, network hiccup), the provider tree unmounted and the
  // bar disappeared mid-job, even though the underlying loop was
  // still running.
  //
  // Why it's safe to mount globally:
  //   - The bulk-seed / bulk-enrich API routes ALREADY enforce admin-
  //     only access (return 403 to non-admins). So a non-admin clicking
  //     a hypothetical UI button would just get a rejection.
  //   - The bar renders nothing when activeJob is null — and activeJob
  //     is only ever populated by the admin-gated SeedClient/EnrichClient
  //     pages.
  //   - The provider is a thin useSyncExternalStore subscriber over a
  //     module-level store; mounting it on every route adds no measurable
  //     cost.
  //
  // Net effect: bar persists across EVERY navigation, regardless of
  // auth state, regardless of whether the destination route is admin.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <BulkJobProvider>
            {children}
            <BulkJobBar />
          </BulkJobProvider>
          <Toaster position="bottom-right" />
          {/* GDPR-style cookie banner — first-visit only, persisted
              in localStorage. Renders fixed-bottom-right so it doesn't
              block scroll or hide critical UI. */}
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}

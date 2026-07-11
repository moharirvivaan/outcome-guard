import type { Metadata } from "next";
import { Lexend, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Corporate Trust pairing: Lexend (designed for reading proficiency) for
// headings/UI, Source Sans 3 for body — both chosen for accessibility on a
// trust-critical audit tool. JetBrains Mono for data/NCT ids and quotes.
// Loaded via next/font (self-hosted, font-display: swap) — no external CDN.
const lexend = Lexend({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "outcome-guard — clinical trial outcome-switching audit",
  description:
    "Compare what a clinical trial prespecified in its registry against what its results paper actually reported — surfacing silently dropped, added, and demoted outcomes, each backed by a verbatim quote.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lexend.variable} ${sourceSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

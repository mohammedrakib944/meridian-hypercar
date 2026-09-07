import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// "BMW Type Next" is a licensed, proprietary typeface - it can't be embedded
// here. Inter is loaded as the close, freely-licensable stand-in; the actual
// --font-display CSS variable (see globals.css) still names "BMW Type Next"
// first, so a visitor who happens to have it installed system-wide gets the
// real thing, and everyone else gets Inter.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  style: ["normal"],
});

// Polished, high-contrast editorial serif, used only for the large
// headline/tagline text - everything else (labels, stats, buttons, the M4
// wordmark) stays on the sans "--font-display" stack.
const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "BMW M4 — Competition",
  description: "Performance, experienced differently.",
};

// Pinned so accidental pinch/double-tap zoom can't break the fixed,
// gesture-driven layout - this is an immersive full-screen experience, not a
// document meant to be zoomed.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black">{children}</body>
    </html>
  );
}

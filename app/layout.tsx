import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
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
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal"],
});

export const metadata: Metadata = {
  title: "BMW M4 — Competition",
  description: "Performance, experienced differently.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black">{children}</body>
    </html>
  );
}

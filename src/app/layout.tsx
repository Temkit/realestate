import type { Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#1c1917",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The [locale] layout handles html/body/head.
  // This root layout just passes through.
  return children;
}

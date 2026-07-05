import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emotie-bibliotheek",
  description:
    "Emotie-logger en dagplanner — kwadranten, kalme inzichten, tijdlijn en inbox.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Kwadrant",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icon-180.png",
    icon: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0d",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}

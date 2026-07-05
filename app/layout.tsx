import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// IBM Plex Sans/Mono voor de dagplanner-schermen (tools/planner). We zetten ze
// als CSS-variabelen op <html>; alleen de planner-UI gebruikt ze (via de
// font-plex / font-plex-mono utilities), zodat de bestaande home ongewijzigd
// blijft.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-mono",
  display: "swap",
});

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
    <html lang="nl" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

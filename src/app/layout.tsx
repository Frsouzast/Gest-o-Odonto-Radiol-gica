import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flux-X Odonto",
  description:
    "Flux-X Odonto reúne agenda, precificação, equipe e financeiro para clínicas de radiologia odontológica.",
  keywords: [
    "radiologia odontológica",
    "precificação clínica",
    "gestão financeira",
    "DRE clínica",
    "convênios odontologia",
  ],
  authors: [{ name: "Frsouzast" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Flux-X Odonto",
  },
};

export const viewport: Viewport = {
  themeColor: "#087a9d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
        <Sonner position="top-right" />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./print.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import CompareTray from "@/components/CompareTray";
import ChatWidget from "@/components/ChatWidget";
import GA4Provider from "@/components/GA4Provider";
import NavBar from "@/components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpecHouse — GSMarena for homes",
  description: "Search, compare, and score real estate properties side-by-side with noise, crime, rental yield, and investment signals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Analytics />
        <SpeedInsights />
        <GA4Provider />
        <NavBar />
        <ChatWidget />
        {children}
        <CompareTray />
      </body>
    </html>
  );
}

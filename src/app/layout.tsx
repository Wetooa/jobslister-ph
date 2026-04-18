import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "JobsPH AI",
    template: "%s · JobsPH AI",
  },
  description:
    "Scan OnlineJobs.ph, match roles to your CV with a local LLM, and track listings from one dashboard.",
  applicationName: "JobsPH Lister",
  openGraph: {
    title: "JobsPH AI",
    description:
      "Scan OnlineJobs.ph, match roles to your CV with a local LLM, and track listings from one dashboard.",
    siteName: "JobsPH Lister",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}

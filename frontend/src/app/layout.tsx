import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { CommandChrome } from "@/components/CommandChrome";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FinRadar — Market Intelligence",
  description: "Market sentiment and intelligence data platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-[#0B1020] text-gray-200">
        <CommandChrome>{children}</CommandChrome>
      </body>
    </html>
  );
}

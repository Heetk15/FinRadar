import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CommandChrome } from "@/components/CommandChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinRadar — Intelligence",
  description: "Market sentiment command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="rounded-none">
      <body className="min-h-screen rounded-none bg-zinc-950">
        <CommandChrome>{children}</CommandChrome>
      </body>
    </html>
  );
}

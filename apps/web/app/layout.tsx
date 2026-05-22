import type { Metadata, Viewport } from "next";
import { PwaRuntime } from "@/components/domain/pwa-runtime";
import "./globals.css";

export const metadata: Metadata = {
  title: "书影计划",
  description: "Personal book and movie library platform",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1f3d35",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <PwaRuntime />
        {children}
      </body>
    </html>
  );
}

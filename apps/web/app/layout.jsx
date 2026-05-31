import { Cormorant_Garamond } from "next/font/google";
import { PwaRuntime } from "@/components/domain/pwa-runtime";
import "./styles.css";

// 拉丁展示衬线（仅拉丁字形；中文按字形自动回退到宋体）。供 --font-display 用。
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-latin-serif",
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "阅迹",
  description: "建立你的私人阅迹库",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#22303f",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className={`${cormorant.variable} h-full antialiased`}>
      <body className="paper-grain min-h-full flex flex-col font-sans">
        <PwaRuntime />
        {children}
      </body>
    </html>
  );
}

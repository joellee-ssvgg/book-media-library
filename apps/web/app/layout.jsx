import { PwaRuntime } from "@/components/domain/pwa-runtime";
import "./styles.css";

export const metadata = {
  title: "阅迹",
  description: "你的私人书影记录平台",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#22303F",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <PwaRuntime />
        {children}
      </body>
    </html>
  );
}

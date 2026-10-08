import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI商业小说工厂",
  description: "私有创作、质量审核、断点恢复与投稿工作台",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon-192.png",
  },
  appleWebApp:{capable:true,title:'小说工厂',statusBarStyle:'default'},
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}

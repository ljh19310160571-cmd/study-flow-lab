import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  return {
    title: "学习行动档案｜Study Flow Lab",
    description: "集听力错因、口语语料、连续计时、待办捕捉与每日行动复盘于一体的个人学习工具。",
    openGraph: {
      title: "学习行动档案",
      description: "IELTS 专用档案 · 连续计时 · 每日行动复盘",
      type: "website",
      images: [{ url: `${baseUrl}/og-pink.png`, width: 1200, height: 630, alt: "学习行动档案" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "学习行动档案",
      description: "IELTS 专用档案 · 连续计时 · 每日行动复盘",
      images: [`${baseUrl}/og-pink.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

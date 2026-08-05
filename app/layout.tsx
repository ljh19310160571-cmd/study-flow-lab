import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  return {
    title: "听力错因档案｜IELTS Listening Lab",
    description: "按剑雅、Test、Part记录同义替换、生词词组与长句分析，并通过主动回忆完成复习。",
    openGraph: {
      title: "听力错因档案",
      description: "同义替换 · 生词词组 · 长句分析",
      type: "website",
      images: [{ url: `${baseUrl}/og-pink.png`, width: 1200, height: 630, alt: "听力错因档案" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "听力错因档案",
      description: "同义替换 · 生词词组 · 长句分析",
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

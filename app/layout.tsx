import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "아이디어 검증기 · OSINT",
  description: "제품 아이디어를 입력하면 중복 가능성·경쟁자·시장 수요를 분석해 드립니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "图研 · 计算机专业论文图表工作台",
  description: "本地运行的毕业论文图表生成工具，支持 UML 类图、ER 图、流程图、时序图、用例图、架构图、三线表和实验数据图。",
  icons: {
    icon: "/favicon.svg?v=2",
    shortcut: "/favicon.svg?v=2",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AnalysisProvider } from "@/lib/analysis-store";
import { ReducedMotionSync } from "@/lib/motion";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Growwwly — Know your SaaS before you scale it",
  description:
    "Understand your product, map your ideal customers, and see AI-generated growth signals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas text-ink" suppressHydrationWarning>
        <ReducedMotionSync />
        <AnalysisProvider>{children}</AnalysisProvider>
      </body>
    </html>
  );
}

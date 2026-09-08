import type { Metadata } from "next";
import { Big_Shoulders, Inter } from "next/font/google";
import "./globals.css";
import { AnalysisProvider } from "@/lib/analysis-store";
import { ReducedMotionSync } from "@/lib/motion";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/** The display face — very condensed, tall, editorial. Reserved for page
 * titles, hero statements, section headers and the oversized wordmark motif.
 * "Big Shoulders" is a variable font whose optical-size (`opsz`) axis moves
 * it toward the tall, condensed "Display" cut at large sizes and a more
 * moderate "Text" cut at small ones — exactly the two ends of the same
 * family Google ships as separate static fonts elsewhere. Inter (above)
 * stays the UI/body face everywhere else — the contrast between the two is
 * the point. */
const bigShoulders = Big_Shoulders({
  variable: "--font-display-src",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Growwwly — Know your SaaS before you scale it",
  description:
    "Understand your product, map your ideal customers, and see AI-generated growth signals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bigShoulders.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-canvas text-ink" suppressHydrationWarning>
        <ReducedMotionSync />
        <AnalysisProvider>{children}</AnalysisProvider>
      </body>
    </html>
  );
}

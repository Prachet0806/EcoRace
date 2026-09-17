import type { Metadata } from "next";
import "./globals.css";
import { display, tel } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "EcoRace Planner",
  description: "Decision-support platform for optimizing the F1 calendar.",
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${tel.variable}`}>
      <body>{children}</body>
    </html>
  );
}

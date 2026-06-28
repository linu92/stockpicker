import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StockPicker V2",
  description: "Premium Stock Screener & Analyzer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Force dark mode for premium feel
  return (
    <html lang="ko" className="dark h-full antialiased">
      <body className={`${inter.className} min-h-full flex bg-dark-bg text-gray-100 overflow-hidden`}>
        {/* We will inject a global Sidebar component here later, and children will be the main content area */}
        {children}
      </body>
    </html>
  );
}

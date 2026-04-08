import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sahayaa – Care, delivered naturally.",
  description: "A premium botanical wellness platform for seamless and dignified hygiene access.",
  themeColor: "#2D4A3E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col selection:bg-magenta selection:text-white">
        <div className="grain-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}

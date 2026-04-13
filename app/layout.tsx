import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cuemath AI Tutor Screener",
  description: "A 10-minute voice interview for Cuemath tutor candidates",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}

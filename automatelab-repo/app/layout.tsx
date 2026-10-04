import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutomateLab | AI Automation Blueprints & Live Course",
  description: "Get 100 production-ready Make.com blueprints for $9.99/month or join a practical $29 live AI automation course.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

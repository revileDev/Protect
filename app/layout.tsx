// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aero Lua | Secure Script Authentication & Distribution",
  description: "Advanced Lua script licensing, visual Roblox loader builder, 1s heartbeat telemetry, and modular script protection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b0c10] text-gray-100 antialiased selection:bg-blue-500/30 selection:text-blue-300">
        {children}
      </body>
    </html>
  );
}

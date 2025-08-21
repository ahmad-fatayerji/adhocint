import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: {
    template: "%s | AD HOC International s.a.r.l",
    default: "AD HOC International s.a.r.l",
  },
  description:
    "Contracting and construction solutions with quality and reliability.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[var(--background)] text-[var(--foreground)]">
        <Navbar />
        {children}
      </body>
    </html>
  );
}

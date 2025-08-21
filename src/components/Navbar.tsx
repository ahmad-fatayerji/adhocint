"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Button from "./ui/button";

const navItems = [
  { href: "#about", label: "About Us" },
  { href: "#projects", label: "Projects" },
  { href: "#contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-white/70 border-b border-black/10">
      <div className="container mx-auto px-4">
  <div className="flex h-20 items-center justify-between">
          <Link href="#" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="AD HOC Logo"
              width={84}
              height={84}
              className="w-[72px] h-[72px] md:w-[84px] md:h-[84px] rounded-sm"
              priority
            />
            <span className="font-semibold tracking-wide text-[var(--brand-blue)]">
              AD HOC International
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-sm text-foreground/80 hover:text-[var(--brand-blue)]"
              >
                {n.label}
              </a>
            ))}
            <Button size="sm">Get a Quote</Button>
          </nav>
          <button
            aria-label="Toggle Menu"
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-black/5"
            onClick={() => setOpen((v) => !v)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-black/10">
          <div className="px-4 py-2 space-y-1 bg-white/90">
            {navItems.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="block py-2 text-foreground/80"
                onClick={() => setOpen(false)}
              >
                {n.label}
              </a>
            ))}
            <div className="pt-2">
              <Button className="w-full">Get a Quote</Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

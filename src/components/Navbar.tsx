"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/#about", label: "About Us" },
  { href: "/services", label: "Services" },
  { href: "/projects", label: "Projects" },
  { href: "/#contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-white/70 border-b border-black/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-4 py-2 md:py-3">
          <Link
            href="/"
            className="flex items-center min-w-0 shrink-0 group"
            aria-label="Go to homepage"
          >
            <Image
              src="/logo.png"
              alt="AD HOC Logo"
              width={180}
              height={180}
              className="w-[110px] h-[110px] xs:w-[130px] xs:h-[130px] md:w-[150px] md:h-[150px] lg:w-[170px] lg:h-[170px] rounded-sm transition-transform group-hover:scale-[1.03]"
              priority
            />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((n) => (
              <motion.a
                key={n.href}
                href={n.href}
                className="relative px-1 py-1 text-base lg:text-lg font-medium text-foreground/80 tracking-wide"
                whileHover="hover"
                whileTap={{ y: 1 }}
                initial="rest"
                animate="rest"
              >
                <span className="relative z-10 transition-colors hover:text-[var(--brand-blue)]">
                  {n.label}
                </span>
                <motion.span
                  className="absolute left-0 -bottom-0.5 h-[3px] w-full rounded bg-[var(--brand-blue)]"
                  variants={{ rest: { scaleX: 0 }, hover: { scaleX: 1 } }}
                  style={{ originX: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              </motion.a>
            ))}
          </nav>
          <button
            aria-label={open ? "Close Menu" : "Open Menu"}
            className="md:hidden inline-flex items-center justify-center h-12 w-12 rounded-md hover:bg-black/5 active:scale-95 transition"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            ) : (
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <motion.div
        initial={false}
        animate={open ? "open" : "closed"}
        className="md:hidden"
        aria-hidden={!open}
      >
        <motion.div
          variants={{
            closed: {
              height: 0,
              opacity: 0,
              transition: { when: "afterChildren", staggerDirection: -1 },
            },
            open: {
              height: "auto",
              opacity: 1,
              transition: { when: "beforeChildren" },
            },
          }}
          className="overflow-hidden border-t border-black/10 bg-white/95 backdrop-blur-sm shadow-sm"
        >
          <motion.ul
            variants={{
              closed: {
                transition: { staggerChildren: 0.03, staggerDirection: -1 },
              },
              open: { transition: { staggerChildren: 0.06 } },
            }}
            className="px-4 py-3 flex flex-col gap-1"
          >
            {navItems.map((n) => (
              <motion.li
                key={n.href}
                variants={{
                  closed: { x: -10, opacity: 0 },
                  open: { x: 0, opacity: 1 },
                }}
              >
                <motion.a
                  href={n.href}
                  className="relative block py-2 text-lg font-medium text-foreground/80 tracking-wide"
                  whileHover="hover"
                  whileTap={{ y: 1 }}
                  initial="rest"
                  animate="rest"
                  onClick={() => setOpen(false)}
                >
                  <span className="relative z-10 transition-colors hover:text-[var(--brand-blue)]">
                    {n.label}
                  </span>
                  <motion.span
                    className="absolute left-0 -bottom-0.5 h-[3px] w-full rounded bg-[var(--brand-blue)]"
                    variants={{ rest: { scaleX: 0 }, hover: { scaleX: 1 } }}
                    style={{ originX: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                </motion.a>
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>
      </motion.div>
    </header>
  );
}

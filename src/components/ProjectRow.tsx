"use client";
import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export interface ProjectRowProps {
  title: string;
  client: string;
  year: number | string;
  description: string;
  images: { src: string; alt?: string }[];
  fit?: "cover" | "contain";
}

export default function ProjectRow({
  title,
  client,
  year,
  description,
  images,
  fit = "cover",
}: ProjectRowProps) {
  const [index, setIndex] = useState(0);
  const total = images.length;
  function prev() {
    setIndex((i) => (i - 1 + total) % total);
  }
  function next() {
    setIndex((i) => (i + 1) % total);
  }
  return (
    <div className="group relative">
      <div className="grid md:grid-cols-[190px_1fr_230px] gap-6 md:gap-10 items-stretch">
        {/* Image */}
        <div className="border border-[var(--brand-brown)]/40 bg-white rounded-sm p-2 flex items-center justify-center relative h-[190px] overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Image
                src={images[index].src}
                alt={images[index].alt || title}
                fill
                sizes="190px"
                className={
                  fit === "contain" ? "object-contain p-2" : "object-cover"
                }
                priority={false}
              />
            </motion.div>
          </AnimatePresence>
          {total > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to image ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 w-2 rounded-full border border-[var(--brand-blue)]/40 transition ${
                    i === index
                      ? "bg-[var(--brand-blue)]"
                      : "bg-[var(--brand-blue)]/20 hover:bg-[var(--brand-blue)]/40"
                  }`}
                />
              ))}
            </div>
          )}
          {total > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-full bg-white/80 hover:bg-white text-[var(--brand-blue)] shadow opacity-0 group-hover:opacity-100 transition"
                aria-label="Previous image"
              >
                ‹
              </button>
              <button
                onClick={next}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-full bg-white/80 hover:bg-white text-[var(--brand-blue)] shadow opacity-0 group-hover:opacity-100 transition"
                aria-label="Next image"
              >
                ›
              </button>
            </>
          )}
        </div>
        {/* Main text */}
        <div className="flex flex-col justify-center py-2">
          <h3 className="font-semibold text-xl text-[var(--brand-blue)] leading-snug mb-3">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-black/70 max-w-prose">
            {description}
          </p>
        </div>
        {/* Meta */}
        <div className="flex flex-col justify-center gap-4 py-2 text-sm">
          <div>
            <p className="text-[var(--brand-brown)] font-medium tracking-wide uppercase text-xs mb-1">
              Client
            </p>
            <p className="text-black/70">{client}</p>
          </div>
          <div>
            <p className="text-[var(--brand-brown)] font-medium tracking-wide uppercase text-xs mb-1">
              Year
            </p>
            <span className="inline-block px-2 py-1 rounded border border-[var(--brand-blue)]/30 bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] text-xs font-medium">
              {year}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export interface ProjectCardProps {
  title: string;
  client: string;
  year: string | number;
  description: string;
  images: { src: string; alt?: string }[];
}

export function ProjectCard({
  title,
  client,
  year,
  description,
  images,
}: ProjectCardProps) {
  const [index, setIndex] = useState(0);
  const total = images.length;

  function prev() {
    setIndex((i) => (i - 1 + total) % total);
  }
  function next() {
    setIndex((i) => (i + 1) % total);
  }

  return (
    <div className="group rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <Image
              src={images[index].src}
              alt={images[index].alt || title}
              fill
              sizes="(max-width:768px) 100vw, 33vw"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>
        {total > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-black h-9 w-9 rounded-full grid place-items-center shadow transition opacity-0 group-hover:opacity-100"
            >
              ‹
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-black h-9 w-9 rounded-full grid place-items-center shadow transition opacity-0 group-hover:opacity-100"
            >
              ›
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-2 w-2 rounded-full border border-white ${
                    i === index ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-lg leading-tight line-clamp-2">
            {title}
          </h3>
          <span className="text-xs font-medium px-2 py-1 rounded bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] border border-[var(--brand-blue)]/30">
            {year}
          </span>
        </div>
        <p className="text-xs uppercase tracking-wide text-black/60">
          Client: {client}
        </p>
        <p className="text-sm text-black/70 leading-relaxed line-clamp-4">
          {description}
        </p>
      </div>
    </div>
  );
}

export default ProjectCard;

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HorizontalCarouselProps = {
  children: ReactNode;
  /** When this value changes, scroll position resets to the start. */
  scrollResetKey?: string | number;
  className?: string;
};

export function HorizontalCarousel({
  children,
  scrollResetKey = 0,
  className,
}: HorizontalCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setCanPrev(scrollLeft > 2);
    setCanNext(maxScroll > 2 && scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    requestAnimationFrame(() => {
      requestAnimationFrame(updateArrows);
    });
  }, [scrollResetKey, updateArrows]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(() => updateArrows());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  const scrollByDir = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.min(el.clientWidth * 0.85, 360);
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute left-0 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border border-border bg-background/95 shadow-md backdrop-blur-sm disabled:opacity-30"
        aria-label="Previous"
        disabled={!canPrev}
        onClick={() => scrollByDir(-1)}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute right-0 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border border-border bg-background/95 shadow-md backdrop-blur-sm disabled:opacity-30"
        aria-label="Next"
        disabled={!canNext}
        onClick={() => scrollByDir(1)}
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </Button>
      <div
        ref={scrollerRef}
        className={cn(
          "flex gap-4 overflow-x-auto scroll-smooth px-12 py-1",
          "snap-x snap-mandatory",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Fixed-width slide for carousels (cinema, poetry, etc.). */
export const carouselSlideClassName =
  "min-w-[min(100%,20rem)] max-w-md shrink-0 snap-start sm:min-w-[22rem]";

/**
 * News carousel: fit exactly 3 full cards in the visible track on md+ (no clipped third tile).
 * Smaller breakpoints keep slightly narrower tiles for comfortable swipe.
 */
export const newsCarouselSlideClassName =
  "shrink-0 snap-start basis-[min(100%,18rem)] sm:basis-[min(100%,19rem)] md:basis-[calc((100%-2rem)/3)] md:min-w-0";

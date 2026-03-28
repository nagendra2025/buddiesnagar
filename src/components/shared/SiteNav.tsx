import Link from "next/link";

const links = [
  { href: "#hero", label: "Home" },
  { href: "#gang", label: "Our gang" },
  { href: "#spotlight", label: "Spotlight" },
  { href: "#funfact", label: "Fun fact" },
  { href: "#news", label: "News" },
  { href: "#cinema", label: "Cinema" },
  { href: "#poetry", label: "Poetry" },
  { href: "#memories", label: "Memories" },
  { href: "#suggest", label: "Ideas" },
] as const;

export default function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        <Link
          href="#hero"
          className="font-display text-lg font-semibold text-foreground"
        >
          BuddyNagar
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1 md:gap-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="min-h-11 min-w-11 px-2 py-2 text-sm text-muted-foreground hover:text-foreground md:px-3"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="h-0.5 w-full bg-primary/15" aria-hidden>
        <div
          className="h-full bg-primary transition-[width] duration-150"
          style={{ width: "var(--scroll-pct, 0%)" }}
        />
      </div>
    </header>
  );
}

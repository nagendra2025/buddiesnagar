import { cn } from "@/lib/utils";

function hueFromName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h + name.charCodeAt(i) * 17) % 360;
  }
  return h;
}

export default function AvatarFallback({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const h = hueFromName(name);
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold text-white shadow-inner",
        className,
      )}
      style={{ backgroundColor: `hsl(${h} 45% 40%)` }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}

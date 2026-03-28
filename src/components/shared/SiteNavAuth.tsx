"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function SiteNavAuth({ isSignedIn }: { isSignedIn: boolean }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.error("SiteNavAuth", "signOut failed", { message: error.message });
    }
    router.refresh();
  }

  if (!isSignedIn) {
    return (
      <Link
        href="#sign-in"
        className="min-h-11 min-w-11 rounded-md px-2 py-2 text-sm font-medium text-primary hover:underline md:px-3"
      >
        Log in
      </Link>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="min-h-11 text-sm text-muted-foreground hover:text-foreground"
      onClick={() => void signOut()}
    >
      Log out
    </Button>
  );
}

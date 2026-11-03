"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-serif text-3xl">Chorus hit a snag.</h1>
        <p className="text-[#5c5348]">The page could not finish loading. The discussion itself is still on the server.</p>
        <Button size="touch" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 text-center">
      <div>
        <p className="eyebrow mb-3">Something went wrong</p>
        <h1 className="text-5xl md:text-6xl">A small snag in the fabric</h1>
        <p className="mx-auto mt-4 max-w-md text-mocha">
          That did not load as it should. Your bag is safe. Please try again, and if it keeps happening, message us.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button href="/" variant="outline">Back to home</Button>
        </div>
        {error.digest && <p className="mt-6 text-xs text-mocha/70">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}

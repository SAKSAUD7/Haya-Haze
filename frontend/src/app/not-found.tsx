import { Monogram } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="grain -mt-[68px] flex min-h-[80vh] items-center justify-center bg-gradient-to-b from-blush to-ivory px-5 pt-[68px] text-center md:-mt-20 md:pt-20">
      <div>
        <Monogram className="mx-auto h-24 w-auto animate-[drift_9s_ease-in-out_infinite]" title="" />
        <p className="eyebrow mb-3 mt-6">Page not found</p>
        <h1 className="text-5xl md:text-7xl">This page has drifted away</h1>
        <p className="mx-auto mt-4 max-w-md text-mocha">
          The link may be old, or the piece may have sold out for good. Let us help you find something lovely instead.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/collections/all">Shop the collection</Button>
          <Button href="/" variant="outline">Back to home</Button>
        </div>
      </div>
    </div>
  );
}

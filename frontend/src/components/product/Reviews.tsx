"use client";

import { BadgeCheck, Star } from "lucide-react";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Stars } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { api, errorMessage } from "@/lib/api/client";
import { useUser } from "@/lib/hooks";
import type { ReviewSummary } from "@/lib/types";
import { cn, formatDate, media } from "@/lib/utils";

function ReviewForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const { user } = useUser();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rating) {
      toast.error("Please choose a star rating.");
      return;
    }
    const form = new FormData(event.currentTarget);
    form.set("rating", String(rating));
    const photo = form.get("photo");
    if (photo instanceof File && photo.size === 0) form.delete("photo");
    setBusy(true);
    try {
      await api(`/products/${slug}/reviews/`, { method: "POST", body: form });
      toast.success("Thank you. Your review will appear once approved.");
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 overflow-y-auto px-6 pb-7">
      <fieldset>
        <legend className="mb-2 text-sm text-mocha">Your rating</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`} aria-pressed={rating === n} className="p-1"
            >
              <Star size={30} strokeWidth={1.2} className={cn("transition-colors", (hover || rating) >= n ? "fill-gold text-gold" : "text-camel")} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-mocha">Your name
          <input name="name" required maxLength={80} defaultValue={user?.first_name ?? ""} className="field mt-1.5" autoComplete="given-name" />
        </label>
        <label className="block text-sm text-mocha">City <span className="text-xs">(optional)</span>
          <input name="location" maxLength={80} className="field mt-1.5" autoComplete="address-level2" />
        </label>
      </div>
      <label className="block text-sm text-mocha">Headline <span className="text-xs">(optional)</span>
        <input name="title" maxLength={120} className="field mt-1.5" placeholder="Sum it up in a few words" />
      </label>
      <label className="block text-sm text-mocha">Your review
        <textarea name="body" required rows={4} className="field mt-1.5 resize-none" placeholder="How does it feel? How did you style it?" />
      </label>
      <label className="block text-sm text-mocha">Add a photo <span className="text-xs">(optional, up to 5 MB)</span>
        <input name="photo" type="file" accept="image/*" className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-cream file:px-4 file:py-2 file:text-deep" />
      </label>
      <Button type="submit" full loading={busy}>Submit review</Button>
    </form>
  );
}

export function ReviewsSection({ slug, name, initial }: { slug: string; name: string; initial: ReviewSummary | null }) {
  const [writing, setWriting] = useState(false);
  const summary = initial ?? { average: "0", count: 0, breakdown: {}, reviews: [] };
  const max = Math.max(1, ...Object.values(summary.breakdown));
  return (
    <section id="reviews" className="mt-20 scroll-mt-28" aria-label="Customer reviews">
      <div className="grid gap-10 md:grid-cols-[300px_1fr] md:gap-16">
        <div>
          <p className="eyebrow mb-3">Reviews</p>
          <h2 className="text-3xl md:text-4xl">What women are saying</h2>
          {summary.count > 0 ? (
            <>
              <div className="mt-6 flex items-end gap-3">
                <span className="font-serif text-6xl leading-none text-deep">{Number(summary.average).toFixed(1)}</span>
                <span className="pb-1"><Stars value={summary.average} size={16} /><span className="block text-sm text-mocha">{summary.count} review{summary.count === 1 ? "" : "s"}</span></span>
              </div>
              <ul className="mt-5 space-y-1.5" aria-label="Rating breakdown">
                {[5, 4, 3, 2, 1].map((star) => (
                  <li key={star} className="flex items-center gap-3 text-sm text-mocha">
                    <span className="w-3">{star}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                      <span className="block h-full rounded-full bg-gold" style={{ width: `${((summary.breakdown[star] ?? 0) / max) * 100}%` }} />
                    </span>
                    <span className="w-5 text-right">{summary.breakdown[star] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-mocha">No reviews yet. Be the first to share how it feels.</p>
          )}
          <Button variant="outline" className="mt-7" onClick={() => setWriting(true)}>Write a review</Button>
        </div>

        <ul className="divide-y divide-sand/70">
          {summary.reviews.map((review) => (
            <li key={review.id} className="py-6 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <Stars value={review.rating} />
                <span className="text-xs text-mocha">{formatDate(review.created_at)}</span>
              </div>
              {review.title && <h3 className="mt-2 text-2xl">{review.title}</h3>}
              <p className="mt-1.5 text-mocha">{review.body}</p>
              {review.photo && (
                <div className="relative mt-3 h-28 w-24 overflow-hidden rounded-xl">
                  <Image src={media(review.photo)} alt={`Photo from ${review.name}`} fill sizes="96px" className="object-cover" />
                </div>
              )}
              <p className="mt-3 flex items-center gap-2 text-sm font-bold text-deep">
                {review.name}{review.location && <span className="font-normal text-mocha">· {review.location}</span>}
                {review.is_verified_buyer && (
                  <span className="flex items-center gap-1 text-xs font-normal text-success"><BadgeCheck size={14} aria-hidden /> Verified buyer</span>
                )}
              </p>
              {review.admin_reply && (
                <p className="mt-3 rounded-xl bg-cream px-4 py-3 text-sm text-deep"><b>Haya &amp; Haze:</b> {review.admin_reply}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
      <Sheet open={writing} onClose={() => setWriting(false)} side="center" title={`Review ${name}`} className="!max-w-[560px]">
        <ReviewForm slug={slug} onDone={() => setWriting(false)} />
      </Sheet>
    </section>
  );
}

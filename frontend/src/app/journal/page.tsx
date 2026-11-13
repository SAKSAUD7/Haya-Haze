import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Breadcrumbs, EmptyState, WaveDivider } from "@/components/ui/bits";
import { Reveal } from "@/components/ui/Reveal";
import { api } from "@/lib/api/server";
import { formatDate } from "@/lib/utils";

export const revalidate = 120;
export const metadata: Metadata = {
  title: "The Journal",
  description: "Hijab tutorials, styling notes, fabric care and stories from the Haya & Haze family.",
  alternates: { canonical: "/journal" },
};

export default async function JournalPage() {
  const journal = await api.journal();
  const posts = journal?.posts ?? [];
  return (
    <>
      <header className="grain -mt-[68px] bg-gradient-to-b from-blush to-ivory pt-[68px] md:-mt-20 md:pt-20">
        <div className="container-page py-12 text-center md:py-16">
          <div className="mb-8 flex justify-center"><Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Journal" }]} /></div>
          <p className="eyebrow mb-4">Stories &amp; styling</p>
          <h1 className="text-5xl md:text-7xl">{journal?.title ?? "The Journal"}</h1>
          {journal?.intro && <p className="mx-auto mt-5 max-w-xl font-display text-xl italic text-mocha">{journal.intro}</p>}
          <WaveDivider className="mx-auto mt-8 max-w-[260px]" />
        </div>
      </header>
      <div className="container-page py-12">
        {posts.length === 0 ? (
          <EmptyState title="New stories are on their way" />
        ) : (
          <ul className="grid gap-x-8 gap-y-14 md:grid-cols-3">
            {posts.map((post, i) => (
              <Reveal as="li" key={post.slug} delay={(i % 3) * 0.1}>
                <Link href={`/journal/${post.slug}`} className="group block">
                  <div className="relative aspect-[16/11] overflow-hidden rounded-[22px] bg-cream">
                    {post.cover && (
                      <Image
                        src={post.cover.url} alt="" fill sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-[1400ms] ease-[var(--ease-fabric)] group-hover:scale-105"
                      />
                    )}
                  </div>
                  <p className="eyebrow mb-2 mt-5">{post.topic_label} · {post.reading_minutes} min</p>
                  <h2 className="text-3xl transition-colors group-hover:text-mocha">{post.title}</h2>
                  <p className="mt-2 text-mocha">{post.excerpt}</p>
                  <p className="mt-3 text-sm text-mocha/80">{formatDate(post.published_at)}</p>
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

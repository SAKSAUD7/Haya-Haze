import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import Image from "next/image";

import { LookImage } from "@/components/home/Sections";
import { Breadcrumbs, WaveDivider } from "@/components/ui/bits";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { api } from "@/lib/api/server";
import type { BodyBlock, CmsPage, FaqPageData, LookbookPageData } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/** Renders StreamField body blocks. Rich text comes from the CMS editor (staff-authored). */
export function CmsBody({ blocks }: { blocks: BodyBlock[] }) {
  return (
    <div className="space-y-6 text-[1.06rem] leading-[1.8] text-mocha">
      {blocks.map((block) => {
        switch (block.type) {
          case "heading":
            return <h2 key={block.id} className="pt-4 text-3xl md:text-4xl">{block.value}</h2>;
          case "paragraph":
            return <div key={block.id} className="rich" dangerouslySetInnerHTML={{ __html: block.value }} />;
          case "image":
            return block.value ? (
              <figure key={block.id} className="overflow-hidden rounded-[22px]">
                <Image src={block.value.url} alt={block.value.alt} width={block.value.width} height={block.value.height} sizes="(max-width: 768px) 100vw, 760px" className="w-full" />
              </figure>
            ) : null;
          case "quote":
            return (
              <blockquote key={block.id} className="my-10 border-l-2 border-gold py-2 pl-6 font-display text-2xl italic leading-snug text-deep md:text-3xl">
                “{block.value.text}”
                {block.value.attribution && <footer className="mt-3 font-sans text-sm not-italic text-mocha">— {block.value.attribution}</footer>}
              </blockquote>
            );
          case "table": {
            const rows = block.value.rows.map((r) => r.split("|").map((c) => c.trim()));
            return (
              <div key={block.id} className="overflow-x-auto rounded-2xl border hairline">
                <table className="w-full text-left text-[0.95rem]">
                  {block.value.caption && <caption className="bg-cream px-4 py-3 text-left font-serif text-xl text-deep">{block.value.caption}</caption>}
                  <thead className="bg-cream/60 text-xs uppercase tracking-[0.12em] text-mocha">
                    <tr>{rows[0]?.map((cell, i) => <th key={i} scope="col" className="px-4 py-3 font-bold">{cell}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(1).map((row, i) => (
                      <tr key={i} className="border-t border-sand/70">
                        {row.map((cell, j) => <td key={j} className={j === 0 ? "px-4 py-3 font-bold text-deep" : "px-4 py-3"}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

function PageHeader({ eyebrow, title, intro, crumbs }: { eyebrow?: string; title: string; intro?: string; crumbs: { label: string; href?: string }[] }) {
  return (
    <header className="grain -mt-[68px] bg-gradient-to-b from-blush to-ivory pt-[68px] md:-mt-20 md:pt-20">
      <div className="container-page py-12 text-center md:py-16">
        <div className="mb-8 flex justify-center"><Breadcrumbs items={crumbs} /></div>
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h1 className="mx-auto max-w-3xl text-5xl md:text-7xl">{title}</h1>
        {intro && <p className="mx-auto mt-5 max-w-xl font-display text-xl italic text-mocha">{intro}</p>}
        <WaveDivider className="mx-auto mt-8 max-w-[260px]" />
      </div>
    </header>
  );
}

function Faq({ page }: { page: FaqPageData }) {
  const jsonLd = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: page.groups.flatMap((g) => g.items).map((item) => ({
      "@type": "Question", name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() },
    })),
  };
  return (
    <div className="container-page mx-auto max-w-3xl py-12">
      {page.groups.map((group) => (
        <Reveal key={group.title} as="section" className="mb-12">
          <h2 className="mb-4 text-3xl">{group.title}</h2>
          <Accordion.Root type="multiple" className="border-t hairline">
            {group.items.map((item) => (
              <Accordion.Item key={item.question} value={item.question} className="border-b hairline">
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-4 text-left text-[1.05rem] font-bold text-deep">
                    {item.question}
                    <ChevronDown size={18} strokeWidth={1.5} className="shrink-0 transition-transform duration-500 group-data-[state=open]:rotate-180" aria-hidden />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="rich pb-5 text-mocha">
                  <div dangerouslySetInnerHTML={{ __html: item.answer }} />
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </Reveal>
      ))}
      <div className="rounded-[22px] bg-cream p-8 text-center">
        <h2 className="text-3xl">Still have a question?</h2>
        <p className="mt-2 text-mocha">We reply within one working day, usually much sooner.</p>
        <div className="mt-5"><Button href="/contact">Contact us</Button></div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}

async function Lookbook({ page }: { page: LookbookPageData }) {
  const slugs = new Set(page.looks.flatMap((l) => l.hotspots.map((h) => h.product)));
  const products = (await api.products({ page_size: 60 })).results.filter((p) => slugs.has(p.slug));
  return (
    <div className="container-page grid gap-10 py-12 md:grid-cols-2">
      {page.looks.map((look, i) => (
        <Reveal key={i} delay={(i % 2) * 0.12}><LookImage look={look} products={products} priority={i < 2} /></Reveal>
      ))}
    </div>
  );
}

/** One renderer for every CMS page type; also used by draft preview. */
export function CmsPageView({ page }: { page: CmsPage }) {
  const home = { label: "Home", href: "/" };
  switch (page.type) {
    case "faqpage":
      return (<><PageHeader eyebrow="Help" title={page.title} intro={page.intro} crumbs={[home, { label: "FAQ" }]} /><Faq page={page} /></>);
    case "lookbookpage":
      return (<><PageHeader eyebrow="Shop the look" title={page.title} intro={page.intro} crumbs={[home, { label: page.title }]} /><Lookbook page={page} /></>);
    case "journalpostpage":
      return (
        <article>
          <PageHeader eyebrow={page.topic_label} title={page.title} intro={page.excerpt} crumbs={[home, { label: "Journal", href: "/journal" }, { label: page.title }]} />
          <div className="container-page mx-auto max-w-3xl py-10">
            <p className="mb-8 text-center text-sm text-mocha">{page.author} · {formatDate(page.published_at)} · {page.reading_minutes} min read</p>
            {page.cover && (
              <div className="relative mb-10 aspect-[16/10] overflow-hidden rounded-[22px]">
                <Image src={page.cover.url} alt={page.cover.alt} fill priority sizes="(max-width: 768px) 100vw, 760px" className="object-cover" />
              </div>
            )}
            <CmsBody blocks={page.body} />
            <div className="mt-12 border-t hairline pt-8 text-center"><Button variant="outline" href="/journal">More from the journal</Button></div>
          </div>
        </article>
      );
    case "contentpage":
      return (
        <>
          <PageHeader title={page.title} intro={page.intro} crumbs={[home, { label: page.title }]} />
          <div className="container-page mx-auto max-w-3xl py-12">
            <CmsBody blocks={page.body} />
            {page.updated_at && <p className="mt-12 text-sm text-mocha/80">Last updated {formatDate(page.updated_at)}</p>}
          </div>
        </>
      );
    default:
      return null;
  }
}

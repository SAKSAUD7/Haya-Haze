/**
 * Loader: a silk ribbon waving, with the monogram letters beneath it.
 * Deliberately not a root `loading.tsx`: a root loading boundary streams a 200 response
 * before `notFound()` can run, which turns missing pages into soft 404s.
 */
export function RibbonLoader() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5" role="status" aria-label="Loading">
      <svg width="150" height="60" viewBox="0 0 150 60" fill="none" aria-hidden>
        <path stroke="#C8A882" strokeWidth="2.2" strokeLinecap="round">
          <animate
            attributeName="d" dur="2.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            values="M5 30 C 30 5, 50 55, 75 30 S 120 5, 145 30;M5 30 C 30 55, 50 5, 75 30 S 120 55, 145 30;M5 30 C 30 5, 50 55, 75 30 S 120 5, 145 30"
          />
        </path>
        <path stroke="#C9A84C" strokeWidth="1" strokeLinecap="round" opacity=".6">
          <animate
            attributeName="d" dur="2.4s" begin="-0.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
            values="M5 36 C 30 14, 50 58, 75 36 S 120 14, 145 36;M5 36 C 30 58, 50 14, 75 36 S 120 58, 145 36;M5 36 C 30 14, 50 58, 75 36 S 120 14, 145 36"
          />
        </path>
      </svg>
      <p className="font-serif text-2xl tracking-[0.3em] text-mocha">h <span className="text-gold">&amp;</span> h</p>
    </div>
  );
}

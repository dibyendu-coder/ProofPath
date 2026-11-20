export function App() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 sm:px-10 lg:px-16">
        <header className="flex items-center border-b border-line py-7 sm:py-9">
          <span className="brand-mark" aria-hidden="true" />
          <span className="ml-3 text-sm font-semibold tracking-[-0.025em] sm:text-base">
            ProofPath
          </span>
        </header>

        <main className="flex flex-1 items-center py-20 sm:py-28">
          <div className="max-w-5xl">
            <h1 className="font-display text-[clamp(4rem,13vw,10rem)] leading-[0.86] font-semibold tracking-[-0.075em]">
              Proof<span className="text-accent">Path</span>
            </h1>
            <p className="mt-8 max-w-2xl text-[clamp(1.25rem,3.2vw,2.25rem)] leading-[1.25] tracking-[-0.035em] text-ink-muted sm:mt-11">
              Before you trust an opportunity, verify it.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

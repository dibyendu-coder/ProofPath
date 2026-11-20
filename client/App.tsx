import { useState } from 'react';
import { InvestigationDocument } from './components/InvestigationDocument';
import { SignalsIndex } from './components/SignalsIndex';
import { EvidenceGraph } from './components/EvidenceGraph';

const navigation = [
  ['The offer', '#investigate'],
  ['The signals', '#signals'],
  ['The evidence', '#evidence'],
  ['The decision', '#decision'],
] as const;

function Wordmark() {
  return (
    <a className="wordmark" href="/" aria-label="ProofPath home">
      <span className="brand-mark" aria-hidden="true" />
      ProofPath<span className="wordmark-period">.</span>
    </a>
  );
}

function SiteHeader({ placeholder = false }: { placeholder?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="page-width site-header__inner">
        <Wordmark />
        {!placeholder && (
          <>
            <button
              className="menu-toggle"
              type="button"
              aria-expanded={open}
              aria-controls="site-navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? 'Close' : 'Menu'}{' '}
              <span aria-hidden="true">{open ? '×' : '☰'}</span>
            </button>
            <nav
              id="site-navigation"
              className={`site-nav${open ? ' site-nav--open' : ''}`}
              aria-label="Main navigation"
            >
              {navigation.map(([label, href]) => (
                <a key={href} href={href} onClick={() => setOpen(false)}>
                  {label}
                </a>
              ))}
              <a className="site-nav__cta" href="/verify">
                About verification <span aria-hidden="true">↗</span>
              </a>
            </nav>
          </>
        )}
      </div>
    </header>
  );
}

function ChapterLabel({ number, title }: { number: string; title: string }) {
  return (
    <div className="chapter-label">
      <span>Chapter {number}</span>
      <span className="chapter-label__rule" aria-hidden="true" />
      <span>{title}</span>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <section className="hero page-width" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="eyebrow">
              <span className="eyebrow__dash" /> An investigation starts here
            </p>
            <h1 id="hero-title">
              An offer can change your life.
              <br />
              <em>So can a fake one.</em>
            </h1>
            <p className="hero__support">
              ProofPath helps you question suspicious opportunities, understand
              the warning signs, and investigate before you trust.
            </p>
            <a className="text-link" href="#investigate">
              Examine the offer <span aria-hidden="true">↘</span>
            </a>
            <div className="hero__trace" aria-hidden="true">
              <span>Case file / 001</span>
              <span>Observe before you act</span>
            </div>
          </div>
          <div
            className="hero__offer"
            id="investigate"
            aria-labelledby="offer-heading"
          >
            <ChapterLabel number="01" title="The offer" />
            <div className="hero__offer-intro">
              <h2 id="offer-heading">Read between the lines.</h2>
              <p>Select the marked phrases in this fictional offer.</p>
            </div>
            <InvestigationDocument />
          </div>
        </section>

        <section
          className="signals-section page-width"
          id="signals"
          aria-labelledby="signals-heading"
        >
          <ChapterLabel number="02" title="The signals" />
          <div className="story-grid">
            <div className="story-grid__lead">
              <h2 id="signals-heading">
                Suspicion is a question.
                <br />
                <em>Not a verdict.</em>
              </h2>
              <p>
                One detail rarely tells the whole story. A pattern gives you a
                reason to pause and verify through independent channels.
              </p>
            </div>
            <SignalsIndex />
          </div>
        </section>

        <section
          className="evidence-section"
          id="evidence"
          aria-labelledby="evidence-heading"
        >
          <div className="page-width evidence-layout">
            <div>
              <ChapterLabel number="03" title="The evidence" />
              <h2 id="evidence-heading">
                Follow what
                <br />
                can be checked.
              </h2>
              <p className="evidence-section__copy">
                A credible assessment should show its working: what the message
                claims, what an independent source confirms, and what remains
                unknown.
              </p>
            </div>
            <EvidenceGraph />
          </div>
        </section>

        <section
          className="decision-section page-width"
          id="decision"
          aria-labelledby="decision-heading"
        >
          <ChapterLabel number="04" title="The decision" />
          <div className="decision-layout">
            <h2 id="decision-heading">
              Keep the
              <br />
              <em>decision yours.</em>
            </h2>
            <div>
              <p>
                ProofPath is being built to help you examine evidence and ask
                better questions. No tool can guarantee that an opportunity is
                safe. Pause, verify with the organization directly, and decide
                with a clearer picture.
              </p>
              <a className="decision-cta" href="/verify">
                <span className="decision-cta__index">04 / Continue</span>
                <span className="decision-cta__text">See what comes next</span>
                <span className="decision-cta__arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer page-width">
        <Wordmark />
        <p>Before you trust an opportunity, verify it.</p>
        <a href="#main">Back to top ↑</a>
      </footer>
    </div>
  );
}

function VerifyPlaceholder() {
  return (
    <div className="site-shell placeholder-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader placeholder />
      <main id="main" className="placeholder page-width">
        <p className="eyebrow">
          <span className="eyebrow__dash" /> ProofPath / next chapter
        </p>
        <h1>
          Verification starts
          <br />
          <em>with a question.</em>
        </h1>
        <p>
          The verification workspace is coming in a later phase. No opportunity
          is analyzed or stored here yet. The offer on the landing page is an
          interactive fictional demonstration.
        </p>
        <a className="text-link" href="/#investigate">
          Return to the investigation <span aria-hidden="true">↗</span>
        </a>
      </main>
    </div>
  );
}

export function App() {
  return window.location.pathname.replace(/\/$/, '') === '/verify' ? (
    <VerifyPlaceholder />
  ) : (
    <LandingPage />
  );
}

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  head: () => ({
    links: [{ rel: 'canonical', href: 'https://sufra.fawwaz.dev' }],
  }),
  component: Home,
})

const CLONE_COMMAND =
  'git clone https://github.com/Fawwaz-2009/sufra && cd sufra && pnpm install && pnpm bootstrap'

const AGENT_PROMPT =
  'Deploy Sufra (https://github.com/Fawwaz-2009/sufra) to my Cloudflare account: clone it, run pnpm install and pnpm bootstrap, then walk me through the Setup wizard and adding my household as Members.'

function Home() {
  return (
    <main className="page">
      <header className="gutter">
        <nav className="nav reveal" style={{ ['--i' as never]: 0 }}>
          <a href="/" className="nav__mark" aria-label="Sufra home">
            <FlameGlyph />
            <span>Sufra</span>
          </a>
          <div className="nav__links">
            <Link to="/how-it-works" className="nav__cta">
              How it works
            </Link>
            <a
              href="https://github.com/Fawwaz-2009/sufra"
              className="nav__cta"
              rel="noopener"
            >
              GitHub ↗
            </a>
            <a href="#deploy" className="nav__cta nav__cta--primary">
              Deploy
            </a>
          </div>
        </nav>
      </header>

      {/* Hero — the product is the artwork */}
      <section className="band gutter" style={{ paddingBlockEnd: 0 }}>
        <div className="band__inner">
          <div className="hero reveal" style={{ ['--i' as never]: 1 }}>
            <p className="hero__eyebrow">Open source · Self-hosted · v0.1</p>
            <h1 className="hero__lede">
              Photo in. <em>Calories out.</em>
            </h1>
            <p className="hero__sub">
              A photo-first calorie tracker for your household, running on
              your own Cloudflare account. No subscription, no telemetry, no
              one else's servers.
            </p>
            <div className="cta-row">
              <a href="#deploy" className="btn btn--primary">
                Deploy it ↓
              </a>
              <a
                href="https://github.com/Fawwaz-2009/sufra"
                className="btn btn--ghost"
                rel="noopener"
              >
                Source on GitHub ↗
              </a>
            </div>
            <div className="hero__dev">
              <div className="hero__term">
                <span className="prompt">$</span>
                <code>git clone …/Fawwaz-2009/sufra && pnpm bootstrap</code>
                <CopyButton text={CLONE_COMMAND} />
              </div>
              <div
                className="badge-ios"
                aria-label="Native iOS app coming to the App Store"
              >
                <span className="badge-ios__top">Native iOS app</span>
                <span className="badge-ios__main">
                  Coming to the App Store
                </span>
              </div>
            </div>
          </div>

          <div className="phones reveal" style={{ ['--i' as never]: 2 }}>
            <PhoneToday />
            <PhoneMeal />
          </div>
        </div>
      </section>

      {/* Feature 1 — cuisine-first recognition */}
      <section className="band band--surface gutter">
        <div className="band__inner feature">
          <div>
            <p className="feature__kicker">Recognition</p>
            <h2 className="feature__title">It knows kabsa.</h2>
            <p className="feature__body">
              One photo and the model names the dish - <em>kabsa, fattoush,
              mansaf</em> - not "rice with chicken". Calories arrive broken
              down per food, tuned for Middle Eastern tables alongside the
              global default.
            </p>
          </div>
          <div className="feature__visual">
            <MealBreakdownMock />
          </div>
        </div>
      </section>

      {/* Feature 2 — clarification */}
      <section className="band gutter">
        <div className="band__inner feature feature--flip">
          <div>
            <p className="feature__kicker">Honesty</p>
            <h2 className="feature__title">When it's not sure, it asks.</h2>
            <p className="feature__body">
              Uncertainty becomes questions, not silent guesses. Answer the
              ones you know and the estimate re-runs with your answers folded
              in.
            </p>
          </div>
          <div className="feature__visual">
            <ImproveMock />
          </div>
        </div>
      </section>

      {/* Feature 3 — override-first */}
      <section className="band band--surface gutter">
        <div className="band__inner feature">
          <div>
            <p className="feature__kicker">Control</p>
            <h2 className="feature__title">Your number always wins.</h2>
            <p className="feature__body">
              Override any value. The AI's estimate stays as the placeholder
              underneath, so you can always put it back.
            </p>
          </div>
          <div className="feature__visual">
            <OverrideMock />
          </div>
        </div>
      </section>

      {/* Feature 4 — the household */}
      <section className="band gutter">
        <div className="band__inner feature feature--flip">
          <div>
            <p className="feature__kicker">Household</p>
            <h2 className="feature__title">One Worker. The whole family.</h2>
            <p className="feature__body">
              You hold the API key and hand out single-use password links -
              WhatsApp, iMessage, a sticky note on the fridge. No email
              server exists, so none is ever sent. Your household sees{' '}
              <em>"the food app"</em>, not a deployment.
            </p>
          </div>
          <div className="feature__visual">
            <HouseholdMock />
          </div>
        </div>
      </section>

      {/* Costs */}
      <section className="band band--surface gutter">
        <div className="band__inner costs">
          <h2 className="costs__title">What it runs on.</h2>
          <p className="costs__sub">
            The self-hoster's first question, answered before the ask.
          </p>
          <div className="costs__grid">
            <div className="cost">
              <p className="cost__head">Cloudflare</p>
              <p className="cost__value">Free tier</p>
              <p className="cost__note">
                One Worker, D1, R2. A household's meals and photos fit inside
                the free allowances - no paid plan to start.
              </p>
            </div>
            <div className="cost">
              <p className="cost__head">Inference</p>
              <p className="cost__value">Per photo, your key</p>
              <p className="cost__note">
                One vision call per estimate, on whatever OpenRouter model
                you pick. The admin view shows the spend per month, per
                Member.
              </p>
            </div>
            <div className="cost">
              <p className="cost__head">Your time</p>
              <p className="cost__value">One evening, once</p>
              <p className="cost__note">
                Deploy, run the Setup wizard, hand out links. Updates are a
                git pull and a redeploy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Deploy — the dark action band */}
      <section id="deploy" className="band band--dark gutter">
        <div className="band__inner">
          <h2 className="deploy__title">
            One evening. <em>Once.</em>
          </h2>
          <p className="deploy__sub">
            Two things you'll need: a Cloudflare account and an OpenRouter
            API key. One command provisions D1 and R2, generates a session
            secret, applies migrations, deploys. About 90 seconds.
          </p>
          <div className="deploy__grid">
            <div className="code">
              <span className="code__label">Terminal</span>
              <CopyButton text={CLONE_COMMAND} />
              <pre>
                <code>
                  <span className="prompt">$</span>git clone
                  https://github.com/Fawwaz-2009/sufra && cd sufra{`\n`}
                  <span className="prompt">$</span>pnpm install{`\n`}
                  <span className="prompt">$</span>pnpm bootstrap
                </code>
              </pre>
            </div>
            <div className="code">
              <span className="code__label">Or hand it to your coding agent</span>
              <CopyButton text={AGENT_PROMPT} />
              <pre>
                <code className="code__prose">{AGENT_PROMPT}</code>
              </pre>
            </div>
          </div>
          <p className="deploy__after">
            Open the deployed URL and the Setup wizard runs once. From there:{' '}
            <em>admin → add Member → copy the password link → hand it to
            your household.</em>
          </p>
        </div>
      </section>

      {/* The name */}
      <section className="band gutter">
        <p className="nameline">
          <strong>Sufra (سفرة)</strong> is the spread a family gathers
          around - the food, the act, the hospitality. You don't need to be
          Arab to have one. Every household has a table.
        </p>
      </section>

      <footer className="foot gutter">
        <div className="foot__inner">
          <p className="foot__line">
            Made by{' '}
            <a
              href="https://fawwaz.dev/#sufra"
              className="foot__creator"
              rel="noopener"
            >
              Fawwaz
            </a>{' '}
            between meals.
          </p>
          <div className="foot__meta">
            <a
              href="https://github.com/Fawwaz-2009/sufra"
              className="foot__github"
              rel="noopener"
            >
              github.com/Fawwaz-2009/sufra
            </a>
            <span className="dot">·</span>
            <Link to="/how-it-works" className="foot__github">
              methodology
            </Link>
            <span className="dot">·</span>
            <span>MIT</span>
            <span className="dot">·</span>
            <span>2026</span>
            <span className="dot">·</span>
            <a
              href="https://commons.wikimedia.org/wiki/File:Shakshuka_Dish.jpg"
              className="foot__github"
              rel="noopener"
            >
              shakshuka photo: Junbinhuang, CC BY 4.0
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}

/** The flat ember mark — flame in a rounded square (the photoreal basket icon stays on the app). */
function FlameGlyph() {
  return (
    <svg className="nav__glyph" viewBox="0 0 30 30" aria-hidden="true">
      <rect width="30" height="30" rx="8" fill="#E45527" />
      <path
        d="M15 6.2c2 2.8 5 5 5 8.4 0 3.2-2.2 5.6-5 5.6s-5-2.4-5-5.6c0-1.6.6-2.9 1.6-4.2.3 1.1 1 1.9 1.9 2.3-.5-2.4.2-4.6 1.5-6.5z"
        fill="#fff"
      />
    </svg>
  )
}

/** The Daylight Today screen, recreated — the ring + a photo meal card. */
function PhoneToday() {
  const r = 64
  const c = 2 * Math.PI * r
  return (
    <div className="phone phone--left" aria-hidden="true">
      <div className="phone__screen">
        <div>
          <div className="mock-title">Today</div>
        </div>
        <div className="mring">
          <svg width={150} height={150} viewBox="0 0 150 150">
            <defs>
              <linearGradient id="ember" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#E45527" />
                <stop offset="1" stopColor="#F0883F" />
              </linearGradient>
            </defs>
            <circle cx="75" cy="75" r={r} stroke="#EBE7E1" strokeWidth="12" fill="none" />
            <circle
              cx="75"
              cy="75"
              r={r}
              stroke="url(#ember)"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${c * 0.62} ${c}`}
              transform="rotate(-90 75 75)"
            />
          </svg>
          <div className="mring__center">
            <div className="mring__value">1 553</div>
            <div className="mring__label">left</div>
          </div>
        </div>
        <div className="mmacros">
          <div className="mmacro">
            <span className="mock-caps">Protein</span>
            <span className="mmacro__val">82 / 120g</span>
            <div className="mmacro__bar">
              <div className="mmacro__fill" style={{ width: '68%', background: '#45929A' }} />
            </div>
          </div>
          <div className="mmacro">
            <span className="mock-caps">Carbs</span>
            <span className="mmacro__val">140 / 240g</span>
            <div className="mmacro__bar">
              <div className="mmacro__fill" style={{ width: '58%', background: '#D99A36' }} />
            </div>
          </div>
          <div className="mmacro">
            <span className="mock-caps">Fat</span>
            <span className="mmacro__val">51 / 64g</span>
            <div className="mmacro__bar">
              <div className="mmacro__fill" style={{ width: '80%', background: '#E45527' }} />
            </div>
          </div>
        </div>
        <div className="mpill">Take photo</div>
        <div className="mcard">
          <img className="mcard__photo" src="/meals/kabsa.jpg" alt="" />
          <div className="mcard__bar">
            <div className="mcard__row">
              <span className="mcard__name">Kabsa</span>
              <span className="mcard__kcal">
                ~430 <small>kcal</small>
              </span>
            </div>
            <div className="mcard__macros">P 37g · C 49g · F 8g</div>
          </div>
        </div>
        <div className="mcard">
          <img className="mcard__photo" src="/meals/shakshuka.jpg" alt="" />
          <div className="mcard__bar">
            <div className="mcard__row">
              <span className="mcard__name">Shakshuka</span>
              <span className="mcard__kcal">
                ~460 <small>kcal</small>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The Daylight meal detail, recreated — big photo + per-food breakdown. */
function PhoneMeal() {
  return (
    <div className="phone phone--right" aria-hidden="true">
      <div className="phone__screen">
        <img
          className="mcard__photo"
          src="/meals/kabsa.jpg"
          alt=""
          style={{ height: 190, borderRadius: 22 }}
        />
        <div>
          <div className="mock-title">Kabsa</div>
          <div className="mcard__macros" style={{ marginTop: 4 }}>
            Today, 1:40 PM
          </div>
        </div>
        <div>
          <div className="mfood">
            <span className="mfood__name">Kabsa rice</span>
            <span className="mfood__qty">1 cup</span>
            <span className="mfood__kcal">240</span>
          </div>
          <div className="mfood">
            <span className="mfood__name">Chicken breast</span>
            <span className="mfood__qty">100g</span>
            <span className="mfood__kcal">165</span>
          </div>
          <div className="mfood">
            <span className="mfood__name">Daqqus salsa</span>
            <span className="mfood__qty">3 tbsp</span>
            <span className="mfood__kcal">25</span>
          </div>
          <div className="mtotal">
            <span className="mcard__name">Total</span>
            <span className="mtotal__kcal">~430</span>
          </div>
        </div>
        <div className="mpill">Improve this estimate</div>
      </div>
    </div>
  )
}

function MealBreakdownMock() {
  return (
    <div className="mock-panel" aria-hidden="true">
      <img
        className="mcard__photo"
        src="/meals/kabsa.jpg"
        alt=""
        style={{ borderRadius: 14 }}
      />
      <div>
        <div className="mock-title" style={{ fontSize: 19 }}>
          Kabsa
        </div>
      </div>
      <div>
        <div className="mfood">
          <span className="mfood__name">Kabsa rice</span>
          <span className="mfood__qty">1 cup</span>
          <span className="mfood__kcal">240</span>
        </div>
        <div className="mfood">
          <span className="mfood__name">Chicken breast</span>
          <span className="mfood__qty">100g</span>
          <span className="mfood__kcal">165</span>
        </div>
        <div className="mfood">
          <span className="mfood__name">Daqqus salsa</span>
          <span className="mfood__qty">3 tbsp</span>
          <span className="mfood__kcal">25</span>
        </div>
        <div className="mtotal">
          <span className="mcard__name">Total</span>
          <span className="mtotal__kcal">~430</span>
        </div>
      </div>
    </div>
  )
}

function ImproveMock() {
  return (
    <div className="mock-panel" aria-hidden="true">
      <span className="mock-caps">Improve this estimate</span>
      {/* Verbatim questions the model generated for the kabsa photo (meal-kabsa.json) */}
      <div className="mq">
        <p className="mq__hint">The model wasn't sure about:</p>
        <ul className="mq__list">
          <li>
            Is the amount of rice shown roughly 1 cup, or was there more
            underneath the chicken?
          </li>
          <li>
            Was the rice prepared with a significant amount of oil or
            clarified butter (ghee)?
          </li>
        </ul>
      </div>
      <div className="mtext">
        <span className="mfield__typed">
          more like 1.5 cups, and yes a little ghee
        </span>
      </div>
      <div className="mpill">Re-run the estimate</div>
    </div>
  )
}

function OverrideMock() {
  return (
    <div className="mock-panel" aria-hidden="true">
      <span className="mock-caps">Override</span>
      <div className="mfield">
        <span className="mfield__label">Calories</span>
        <div className="mfield__input">
          <span className="mfield__typed">520</span>
          <span className="mfield__ghost">AI said ~430</span>
        </div>
      </div>
      <div className="mfield">
        <span className="mfield__label">Protein</span>
        <div className="mfield__input">
          <span className="mfield__ghost">37g</span>
        </div>
      </div>
      <div className="mcard__macros">
        Clear the field and the AI's number is back.
      </div>
    </div>
  )
}

function HouseholdMock() {
  return (
    <div className="mock-panel mhouse" aria-hidden="true">
      <span className="mock-caps">Members</span>
      <div className="mavatars">
        <span className="mavatar" style={{ background: '#E45527' }}>
          F
        </span>
        <span className="mavatar" style={{ background: '#45929A' }}>
          N
        </span>
        <span className="mavatar" style={{ background: '#D99A36' }}>
          S
        </span>
        <span className="mavatar" style={{ background: '#75706A' }}>
          L
        </span>
      </div>
      <span className="mock-caps">Password link, single use</span>
      <span className="mlink">https://sufra.your.house/set-password#k7…</span>
      <div className="mcard__macros">
        Hand it over however your family already talks.
      </div>
    </div>
  )
}

/**
 * Copy-to-clipboard for the deploy command and the agent prompt. Silent
 * success: the label flips to "Copied" for two seconds, no toast.
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="code__copy"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

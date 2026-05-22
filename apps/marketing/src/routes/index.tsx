import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  head: () => ({
    links: [{ rel: 'canonical', href: 'https://sufra.fawwaz.dev' }],
  }),
  component: Home,
})

function Home() {
  return (
    <main className="page">
      <header className="gutter">
        <nav className="nav reveal" style={{ ['--i' as never]: 0 }}>
          <a href="/" className="nav__mark" aria-label="Sufra home">
            <img
              src="/sufra-mark.png"
              alt=""
              className="nav__glyph"
              width={32}
              height={32}
              aria-hidden="true"
            />
            <span>Sufra</span>
          </a>
          <div className="nav__links">
            <a href="#deploy" className="nav__cta nav__cta--primary">
              Get started ↓
            </a>
            <a
              href="https://github.com/Fawwaz-2009/sufra"
              className="nav__cta"
              rel="noopener"
            >
              Source ↗
            </a>
          </div>
        </nav>
      </header>

      <article className="article gutter">
        <section className="hero reveal" style={{ ['--i' as never]: 1 }}>
          <p className="hero__lede">
            A sufra is a table set for the people you love.{' '}
            <em>Sufra the app</em> is a photo-first calorie tracker for the
            people at yours. Open-source, deployed to your own Cloudflare
            account, never phoning home.
          </p>
          <div className="hero__meta">
            <span>v0.1 · MIT · dogfooding</span>
          </div>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 2 }}>
          <h2 className="h-section h-section--first">What it does.</h2>
          <p>
            You photograph a meal. The model recognises the dish, names it{' '}
            <em>kabsa, fattoush, mansaf</em> rather than{' '}
            <em>"rice with chicken"</em>, and returns a calorie estimate broken
            down per food, with the things it's unsure about written out as
            questions you can answer.
          </p>
          <p>
            You can override the totals directly, or refine the estimate by
            telling the model what it missed (<em>the chicken was closer to
            200g, no olive oil</em>). Days bucket on your phone's current
            timezone, so when you travel, "today" travels with you. Weights
            graph against your body, not someone else's average.
          </p>
        </section>

        <section className="reveal screens-section" style={{ ['--i' as never]: 3 }}>
          <h2 className="h-section">See it.</h2>
          <p>
            <em>Three things, in the order you'll do them.</em>
          </p>
          <div className="screens">
            <figure className="screen">
              <div className="screen__frame">
                <img
                  src="/screens/day.png"
                  alt="Day view with calorie ring showing 1553 kcal remaining, three macro bars, and two logged meals."
                  loading="lazy"
                />
              </div>
              <figcaption className="screen__caption">
                Today at a glance. What's left, what's eaten.
              </figcaption>
            </figure>
            <figure className="screen">
              <div className="screen__frame">
                <img
                  src="/screens/meal.png"
                  alt="Meal detail page for chocolate gelato. Large photo, override fields for calories and macros."
                  loading="lazy"
                />
              </div>
              <figcaption className="screen__caption">
                Override anything. The AI's number stays as a placeholder.
              </figcaption>
            </figure>
            <figure className="screen">
              <div className="screen__frame">
                <img
                  src="/screens/improve.png"
                  alt="Improve this estimate bottom sheet. The AI's specific uncertainties listed as questions, plus a freeform textarea."
                  loading="lazy"
                />
              </div>
              <figcaption className="screen__caption">
                When the AI's unsure, it tells you. Answer what you know.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 4 }}>
          <h2 className="h-section">Who it's for.</h2>
          <p>
            Two people, on purpose. The <strong>Host</strong> is you. You have
            a Cloudflare account and an evening. You deploy once, hold the API
            key, and provision accounts for the people at your table. You are
            the support team. You eat too.
          </p>
          <p>
            The <strong>Members</strong> are your household. They get a URL and
            a username. They never enter an API key, never see an admin panel.
            They sign in, take a photo, see a number, and put their phone down.
            Their mental model is <em>"the food app"</em>, not <em>"the LLM
            wrapper my partner deployed"</em>.
          </p>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 5 }}>
          <h2 className="h-section">How it works.</h2>
          <ol className="steps">
            <li>
              <span className="steps__num">1.0</span>
              <div>
                <h3 className="steps__title">Photograph.</h3>
                <p className="steps__body">
                  Default action on opening the PWA is the camera. One
                  prominent shutter, one secondary "pick from library". No
                  hunting for "log meal".
                </p>
              </div>
            </li>
            <li>
              <span className="steps__num">2.0</span>
              <div>
                <h3 className="steps__title">Estimate.</h3>
                <p className="steps__body">
                  The Worker calls your OpenRouter key with the photo. The
                  prompt is tuned for Middle Eastern, Levantine, and Gulf
                  cuisine alongside the global default. Per-food breakdown
                  arrives in ~3–5s. Photo is only written to R2 after the
                  model succeeds.
                </p>
              </div>
            </li>
            <li>
              <span className="steps__num">3.0</span>
              <div>
                <h3 className="steps__title">Clarify, if needed.</h3>
                <p className="steps__body">
                  The estimate carries a small "Improve" affordance, coloured
                  by the model's own confidence. Tap it and the model's
                  uncertainties become questions: <em>Closer to 1 cup or
                  1.5?</em> Answer the ones you know. The estimate re-runs.
                </p>
              </div>
            </li>
            <li>
              <span className="steps__num">4.0</span>
              <div>
                <h3 className="steps__title">Log, or override.</h3>
                <p className="steps__body">
                  Accept the number, or type your own (the AI value stays as
                  placeholder so you can revert). Bookmark a meal to re-log it
                  later without a photo. Move on to the rest of your day.
                </p>
              </div>
            </li>
          </ol>
          <p className="steps__more">
            <Link to="/how-it-works" className="link-cta">
              Read the methodology{' '}
              <span className="link-cta__arrow">→</span>
            </Link>
          </p>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 6 }}>
          <h2 className="h-section">The stack.</h2>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            One Worker, your data, no vendors with a seat at your table.
          </p>
          <table className="spec">
            <tbody>
              <tr>
                <th scope="row">Frontend</th>
                <td>
                  Vite + React 19 + TanStack Router + Tailwind v4
                  <span className="muted">
                    PWA. Installable from the browser, no app store.
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Backend</th>
                <td>
                  Hono on Cloudflare Workers
                  <span className="muted">
                    Single Worker serves the SPA and <code>/api/*</code>
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Database</th>
                <td>
                  Cloudflare D1 (SQLite) via Drizzle
                  <span className="muted">
                    Your D1, your rows. Migrations checked in.
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Storage</th>
                <td>
                  Cloudflare R2
                  <span className="muted">
                    Meal photos, accessed via authenticated Worker routes.
                    Never a public bucket.
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Inference</th>
                <td>
                  OpenRouter (your key)
                  <span className="muted">
                    Pick any vision model OpenRouter routes to. You pay for
                    what your household uses, not a per-seat subscription.
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Auth</th>
                <td>
                  better-auth, scrypt, no email
                  <span className="muted">
                    Host-provisioned accounts via single-use password links.
                    No magic-link emails, no SMTP server to run.
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">License</th>
                <td>
                  MIT
                  <span className="muted">
                    Fork it. Run it. Modify it. Charge your relatives nothing.
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section
          id="deploy"
          className="reveal"
          style={{ ['--i' as never]: 7 }}
        >
          <h2 className="h-section">Deploy it.</h2>
          <p>
            Two things you'll need: a Cloudflare account, and an OpenRouter
            API key. That's the whole list.
          </p>

          <p
            className="aside"
            style={{ marginTop: 'var(--space-xl)' }}
          >
            One command walks you through the rest. It provisions D1 and R2 in
            your account, generates a session secret, applies migrations,
            deploys. About 90 seconds.
          </p>

          <div
            className="code"
            style={{ marginBlock: 'var(--space-lg) var(--space-md)' }}
          >
            <span className="code__label">Terminal</span>
            <pre>
              <code>
                <span className="prompt">$</span>git clone
                https://github.com/Fawwaz-2009/sufra && cd sufra{`\n`}
                <span className="prompt">$</span>pnpm install{`\n`}
                <span className="prompt">$</span>pnpm bootstrap
              </code>
            </pre>
          </div>

          <p>
            Open the deployed URL. The Setup wizard runs once. Name your
            Sufra, pick a username and password. From there:{' '}
            <em>admin → add Member → copy the password link → hand it to your
            household.</em> WhatsApp, iMessage, a sticky note on the fridge.
            No email is ever sent because there is no email server to send it.
          </p>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 8 }}>
          <h2 className="h-section">What isn't here.</h2>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            Negative space matters. v1 ships without these on purpose.
          </p>
          <ul className="absent">
            <li>
              Social features. No streaks visible to anyone but the Member
              themselves.
            </li>
            <li>Telemetry, analytics, anything that phones home.</li>
            <li>
              Native iOS or Android apps. PWA only. Add to Home Screen and
              live there.
            </li>
            <li>Email infrastructure. Notifications. Magic links.</li>
            <li>
              Ads, surveillance, anyone monetising what your household eats.
            </li>
          </ul>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 9 }}>
          <h2 className="h-section">About the name.</h2>
          <p>
            <em>Sufra (سفرة)</em> is the Arabic word for the dining table, but
            it means more than the furniture. A sufra is the spread of food
            laid out, the act of gathering, the hospitality of feeding the
            people you love.
          </p>
          <p>
            The app is named after it because it exists to help you stay{' '}
            <em>at</em> the sufra: to keep showing up at the table, while
            staying aware of what you're eating. Middle Eastern cuisine is a
            first-class citizen in the food recognition, not an afterthought.
            You don't need to be Arab to have a sufra. Every household has a
            table.
          </p>
        </section>
      </article>

      <footer className="foot gutter">
        <div className="foot__inner">
          <p className="foot__line">
            Sufra · a photo-first calorie tracker for households. Built on
            Cloudflare Workers, D1, and R2. Inference via OpenRouter, host's
            key, host's bill. MIT licensed. No telemetry. No email. v0.1, in
            dogfood. Made by{' '}
            <a
              href="https://fawwaz.dev/sufra"
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
            <span>MIT</span>
            <span className="dot">·</span>
            <span>2026</span>
          </div>
        </div>
      </footer>
    </main>
  )
}

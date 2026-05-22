import { createFileRoute, Link } from '@tanstack/react-router'

const SITE_URL = 'https://sufra.fawwaz.dev'
const PAGE_URL = `${SITE_URL}/how-it-works`
const TITLE = 'How Sufra works. The math behind your numbers.'
const DESCRIPTION =
  'The methodology behind Sufra: Mifflin-St Jeor for BMR, activity multipliers, the calorie-shift approximation, and the macro split. Written out so you can check it.'

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
} as const

export const Route = createFileRoute('/how-it-works')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:url', content: PAGE_URL },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: PAGE_URL }],
  }),
  component: HowItWorks,
})

function HowItWorks() {
  return (
    <main className="page">
      <header className="gutter">
        <nav className="nav reveal" style={{ ['--i' as never]: 0 }}>
          <Link to="/" className="nav__mark" aria-label="Sufra home">
            <img
              src="/sufra-mark.png"
              alt=""
              className="nav__glyph"
              width={32}
              height={32}
              aria-hidden="true"
            />
            <span>Sufra</span>
          </Link>
          <div className="nav__links">
            <Link
              to="/"
              hash="deploy"
              className="nav__cta nav__cta--primary"
            >
              Get started ↓
            </Link>
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
            <em>How it works.</em> The math behind your numbers, written out
            so you can check it.
          </p>
          <div className="hero__meta">
            <Link to="/" className="hiw__back">
              ← Back to Sufra
            </Link>
          </div>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 2 }}>
          <h2 className="h-section h-section--first">
            Your BMR (Mifflin-St Jeor).
          </h2>
          <p>
            BMR (Basal Metabolic Rate) is roughly the energy your body would
            burn over 24 hours at complete rest. We use the Mifflin-St Jeor
            equation
            <Sup n={1} />, the most accurate widely-used formula for healthy
            adults.
          </p>
          <div
            className="code"
            style={{ marginBlock: 'var(--space-md)' }}
          >
            <span className="code__label">Formula</span>
            <pre>
              <code>
                Male:&nbsp;&nbsp;&nbsp; BMR = 10·weight(kg) +
                6.25·height(cm) − 5·age + 5{'\n'}
                Female:&nbsp; BMR = 10·weight(kg) + 6.25·height(cm) − 5·age
                − 161
              </code>
            </pre>
          </div>
          <p>
            We store your birthday, not your age, so we recompute age every
            time we run the formula. Your numbers stay correct as years pass
            without you having to edit anything.
          </p>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 3 }}>
          <h2 className="h-section">Activity multiplier.</h2>
          <p>
            Your BMR is what your body spends at rest. Real life moves around;
            we multiply your BMR by a factor based on your typical activity.
          </p>
          <ul className="hiw__list">
            <li>
              <strong>Sedentary,</strong> little or no exercise: ×
              {ACTIVITY_MULTIPLIERS.sedentary}
            </li>
            <li>
              <strong>Light,</strong> 1–3 days/week: ×
              {ACTIVITY_MULTIPLIERS.light}
            </li>
            <li>
              <strong>Moderate,</strong> 3–5 days/week: ×
              {ACTIVITY_MULTIPLIERS.moderate}
            </li>
            <li>
              <strong>Active,</strong> 6–7 days/week: ×
              {ACTIVITY_MULTIPLIERS.active}
            </li>
          </ul>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 4 }}>
          <h2 className="h-section">Maintenance.</h2>
          <p>
            <em>Maintenance = BMR × activity multiplier.</em> That's roughly
            how many calories you'd eat to neither gain nor lose weight.
          </p>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 5 }}>
          <h2 className="h-section">Daily target.</h2>
          <p>
            Your target is your maintenance, shifted up or down based on your
            goal weight and how fast you want to get there. We use the
            "1&nbsp;kg of body weight ≈ 7,700&nbsp;kcal" approximation
            <Sup n={2} /> and divide across seven days.
          </p>
          <div
            className="code"
            style={{ marginBlock: 'var(--space-md)' }}
          >
            <span className="code__label">Formula</span>
            <pre>
              <code>
                direction = sign(goal_weight − current_weight){'\n'}
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                // −1 lose, &nbsp;0 maintain, &nbsp;+1 gain{'\n'}
                {'\n'}
                target = maintenance + direction × weekly_rate × 1100
              </code>
            </pre>
          </div>
          <p>
            If you're maintaining, the second term is zero. Your target equals
            your maintenance.
          </p>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 6 }}>
          <h2 className="h-section">Protein, carbs, fat.</h2>
          <p>
            Once we know your daily target, we split it into protein, carbs,
            and fat.
          </p>
          <ul className="hiw__list">
            <li>Protein: 25% of target ÷ 4 kcal/g</li>
            <li>Carbs: 50% of target ÷ 4 kcal/g</li>
            <li>Fat: 25% of target ÷ 9 kcal/g</li>
          </ul>
          <p>
            These percentages sit mid-range within the U.S. Institute of
            Medicine's Acceptable Macronutrient Distribution Ranges (AMDR)
            <Sup n={3} />, broadly accepted defaults for healthy adults. We
            don't let you set per-macro grams in v1 to keep the math one-way:
            edit your inputs, see your numbers update.
          </p>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 7 }}>
          <h2 className="h-section">When your goals change.</h2>
          <p>
            Edits to your Profile take effect{' '}
            <strong>starting tomorrow at midnight</strong> in your local
            timezone. Today's plan is sealed from the moment the day begins.
            Your calorie target doesn't shift mid-day when you make a change.
          </p>
          <p>
            Past days keep the target you were under at the time. You can
            swipe back to any prior day and see how you did against{' '}
            <em>that day's</em> goal, not today's. Editing your profile
            updates today and forward only; it never rewrites history.
          </p>
          <p>
            The one exception is your very first profile during onboarding,
            which applies right away. You're starting from nothing, there's no
            plan to seal.
          </p>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 8 }}>
          <h2 className="h-section">Correcting a wrong weight.</h2>
          <p>
            On the Progress tab, tap any dot on the weight chart to delete
            that entry. Useful if you typed the wrong number. Deleting a dot
            removes it from the chart only.
          </p>
          <p>
            If the deleted weight was the latest one you logged, your future
            plan corrects itself automatically the next time you log a weight.
            But past daily targets stay as they were. You were aiming at that
            number on that day, even if the input was wrong. We don't rewrite
            history; we let you fix what's still in motion.
          </p>
        </section>

        <section className="reveal" style={{ ['--i' as never]: 9 }}>
          <h2 className="h-section">Calibration over time.</h2>
          <p className="aside">
            <em>Coming soon.</em> The Mifflin-St Jeor formula is a strong
            starting point, but real metabolism varies. After ~4 weeks of
            weight and meal data, Sufra will compare your projected vs. actual
            progress and suggest an updated maintenance number if the two have
            drifted apart. This calibration will always require your
            confirmation. We never silently move your target.
          </p>
        </section>

        <section
          id="references"
          className="reveal"
          style={{ ['--i' as never]: 10 }}
        >
          <h2 className="h-section">References.</h2>
          <ol className="hiw__refs">
            <li>
              Mifflin, M.D. et al. (1990).{' '}
              <em>
                A new predictive equation for resting energy expenditure in
                healthy individuals.
              </em>{' '}
              American Journal of Clinical Nutrition, 51(2), 241–247.
            </li>
            <li>
              Wishnofsky, M. (1958).{' '}
              <em>Caloric equivalents of gained or lost weight.</em> American
              Journal of Clinical Nutrition, 6(5), 542–546. The 7,700 kcal/kg
              figure is a widely-used approximation and is known to be more
              accurate as a rule-of-thumb than an exact constant.
            </li>
            <li>
              Institute of Medicine (2005).{' '}
              <em>
                Dietary Reference Intakes for Energy, Carbohydrate, Fiber,
                Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids.
              </em>{' '}
              National Academies Press.
            </li>
          </ol>
          <p
            className="aside"
            style={{ marginTop: 'var(--space-xl)' }}
          >
            For specific goals or medical conditions, talk to a registered
            dietitian. Sufra makes choices legible; it doesn't make
            recommendations.
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

function Sup({ n }: { n: number }) {
  return (
    <sup className="hiw__sup">
      <a href="#references">{n}</a>
    </sup>
  )
}

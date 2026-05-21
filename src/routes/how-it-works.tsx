import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowLeft } from "@phosphor-icons/react"

import { BottomNav } from "@/components/bottom-nav"
import { ACTIVITY_MULTIPLIERS } from "../../worker/profile/isomorphic/derive"

// Static methodology page. Excluded from the onboarding gate (see __root.tsx)
// so it can be linked from the wizard's ⓘ icons and from anywhere a Member
// wants to verify the math.

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorks,
})

function HowItWorks() {
  const router = useRouter()
  // Browser-history back so the destination depends on entry point —
  // Profile → How → back lands on Profile; Day Summary ⓘ → How → back
  // lands on the Day view. Falls back to / if there's no history (e.g.
  // someone opens the page in a fresh tab).
  const goBack = () => {
    if (window.history.length > 1) {
      router.history.back()
    } else {
      void router.navigate({ to: "/" })
    }
  }
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background px-6 pt-6 pb-24">
      <header className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="-ms-2 inline-flex size-9 items-center justify-center rounded-md hover:bg-foreground/5"
        >
          <ArrowLeft className="size-5" weight="bold" />
        </button>
        <h1 className="font-heading text-xl font-semibold">How does this work?</h1>
      </header>

      <main className="flex flex-col gap-8 text-sm leading-relaxed">
        <Section id="bmr-mifflin" title="Your BMR (Mifflin-St Jeor)">
          <p>
            BMR — Basal Metabolic Rate — is roughly the energy your body would
            burn over 24 hours at complete rest. We use the Mifflin-St Jeor
            equation
            <Sup n={1} />, the most accurate widely-used formula for healthy
            adults:
          </p>
          <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`Male:    BMR = 10·weight(kg) + 6.25·height(cm) − 5·age + 5
Female:  BMR = 10·weight(kg) + 6.25·height(cm) − 5·age − 161`}
          </pre>
          <p>
            We store your birthday — not your age — so we recompute age every
            time we run the formula. Your numbers stay correct as years pass
            without you having to edit anything.
          </p>
        </Section>

        <Section id="activity-multipliers" title="Activity multiplier">
          <p>
            Your BMR is what your body spends at rest. Real life moves around;
            we multiply your BMR by a factor based on your typical activity:
          </p>
          <ul className="my-2 ms-4 list-disc text-xs tabular-nums">
            <li>Sedentary — little or no exercise: ×{ACTIVITY_MULTIPLIERS.sedentary}</li>
            <li>Light — 1–3 days/week: ×{ACTIVITY_MULTIPLIERS.light}</li>
            <li>Moderate — 3–5 days/week: ×{ACTIVITY_MULTIPLIERS.moderate}</li>
            <li>Active — 6–7 days/week: ×{ACTIVITY_MULTIPLIERS.active}</li>
          </ul>
        </Section>

        <Section id="maintenance" title="Maintenance">
          <p>
            <em>Maintenance = BMR × activity multiplier.</em> That's roughly
            how many calories you'd eat to neither gain nor lose weight.
          </p>
        </Section>

        <Section id="daily-target" title="Daily target">
          <p>
            Your target is your maintenance, shifted up or down based on your
            goal weight and how fast you want to get there. We use the
            "1&nbsp;kg of body weight ≈ 7,700&nbsp;kcal" approximation
            <Sup n={2} /> and divide across seven days:
          </p>
          <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`direction = sign(goal_weight − current_weight)
            // −1 lose,  0 maintain,  +1 gain

target = maintenance + direction × weekly_rate × 1100`}
          </pre>
          <p>
            If you're maintaining, the second term is zero — your target
            equals your maintenance.
          </p>
        </Section>

        <Section id="macro-split" title="Protein, carbs, fat">
          <p>
            Once we know your daily target, we split it into protein, carbs,
            and fat:
          </p>
          <ul className="my-2 ms-4 list-disc text-xs">
            <li>Protein: 25% of target ÷ 4 kcal/g</li>
            <li>Carbs: 50% of target ÷ 4 kcal/g</li>
            <li>Fat: 25% of target ÷ 9 kcal/g</li>
          </ul>
          <p>
            These percentages sit mid-range within the U.S. Institute of
            Medicine's Acceptable Macronutrient Distribution Ranges (AMDR)
            <Sup n={3} /> — broadly accepted defaults for healthy adults. We
            don't let you set per-macro grams in v1 to keep the math one-way:
            edit your inputs, see your numbers update.
          </p>
        </Section>

        <Section id="when-numbers-change" title="When your goals change">
          <p>
            Edits to your Profile take effect <strong>starting tomorrow at
            midnight</strong> in your local timezone. Today's plan is sealed
            from the moment the day begins — your calorie target doesn't shift
            mid-day when you make a change.
          </p>
          <p className="mt-2">
            Past days keep the target you were under at the time. You can
            swipe back to any prior day and see how you did against{" "}
            <em>that day's</em> goal — not today's. Editing your profile
            updates today and forward only; it never rewrites history.
          </p>
          <p className="mt-2">
            The one exception is your very first profile during onboarding,
            which applies right away — you're starting from nothing, there's
            no plan to seal.
          </p>
        </Section>

        <Section id="weight-corrections" title="Correcting a wrong weight">
          <p>
            On the Progress tab, tap any dot on the weight chart to delete
            that entry — useful if you typed the wrong number. Deleting a dot
            removes it from the chart only.
          </p>
          <p className="mt-2">
            If the deleted weight was the latest one you logged, your future
            plan corrects itself automatically the next time you log a weight.
            But past daily targets stay as they were — you were aiming at
            that number on that day, even if the input was wrong. We don't
            rewrite history; we let you fix what's still in motion.
          </p>
        </Section>

        <Section id="calibration-over-time" title="Calibration over time (coming soon)">
          <p>
            The Mifflin-St Jeor formula is a strong starting point, but real
            metabolism varies. After ~4 weeks of weight and meal data, Sufra
            will compare your projected vs. actual progress and suggest an
            updated maintenance number if the two have drifted apart. This
            calibration will always require your confirmation — we never
            silently move your target.
          </p>
        </Section>

        <Section id="references" title="References">
          <ol className="my-2 ms-4 list-decimal space-y-2 text-xs leading-relaxed">
            <li>
              Mifflin, M.D. et al. (1990). <em>A new predictive equation for
              resting energy expenditure in healthy individuals.</em> American
              Journal of Clinical Nutrition, 51(2), 241–247.
            </li>
            <li>
              Wishnofsky, M. (1958). <em>Caloric equivalents of gained or lost
              weight.</em> American Journal of Clinical Nutrition, 6(5),
              542–546. The 7,700 kcal/kg figure is a widely-used approximation
              and is known to be more accurate as a rule-of-thumb than an
              exact constant.
            </li>
            <li>
              Institute of Medicine (2005). <em>Dietary Reference Intakes for
              Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol,
              Protein, and Amino Acids.</em> National Academies Press.
            </li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            For specific goals or medical conditions, talk to a registered
            dietitian. Sufra makes choices legible — it doesn't make
            recommendations.
          </p>
        </Section>
      </main>
      <BottomNav />
    </div>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="font-heading mb-2 text-base font-semibold">{title}</h2>
      <div className="text-muted-foreground">{children}</div>
    </section>
  )
}

function Sup({ n }: { n: number }) {
  return (
    <sup>
      <a
        href={`#references`}
        className="ms-0.5 text-foreground underline decoration-dotted underline-offset-2"
      >
        {n}
      </a>
    </sup>
  )
}

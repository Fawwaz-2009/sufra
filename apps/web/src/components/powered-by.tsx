// Small "Built with Sufra" attribution.
//
// Shown on the surfaces where a non-Member visitor (or a friend at another
// Sufra instance) could reasonably stumble onto Sufra and click through to
// learn about the project — login, set-password redemption, and the
// Profile page (where every signed-in Member ends up at some point).
//
// Not strictly an SEO mechanism — it's an organic-visitor funnel. Each
// deployed instance carries a tiny breadcrumb back to the project home;
// curious people follow it.
//
// To remove from your instance: don't render <PoweredBy /> on any page.
export function PoweredBy() {
  return (
    <footer className="mt-6 flex flex-col items-center gap-1 text-xs text-muted-foreground">
      <p>
        Built with{" "}
        <a
          href="https://sufra.fawwaz.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
        >
          Sufra
        </a>
        {" · "}
        <a
          href="https://github.com/Fawwaz-2009/sufra"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-primary"
        >
          source
        </a>
      </p>
    </footer>
  )
}

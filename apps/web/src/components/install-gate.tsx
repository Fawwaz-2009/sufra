import { useEffect, useState } from "react"
import { DotsThreeVertical, Export } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  detectPlatform,
  hasInstallPrompt,
  subscribeToInstallPrompt,
  triggerInstallPrompt,
  type Platform,
} from "@/lib/standalone"

// Sufra is a household-daily app. If a Member has to open Chrome and type a
// URL each time, they won't use it. The gate makes installation the path
// of least resistance — it sits in front of the app whenever a mobile user
// is in browser mode, and gives platform-correct instructions.
//
// The gate is calm and respectful, not aggressive. It assumes the user
// wants Sufra; it just shows them how to make it native.

interface InstallGateProps {
  // Optional username to display on the post-install handoff screen
  // (set after a fresh password redemption — see set-password.$token.tsx).
  postSetupUsername?: string
}

export function InstallGate({ postSetupUsername }: InstallGateProps) {
  const [platform] = useState<Platform>(() => detectPlatform())

  return (
    <div className="flex min-h-svh flex-col bg-background px-6 py-10 sm:py-16">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8">
        <Header postSetupUsername={postSetupUsername} />
        {platform === "ios" && <IosSteps />}
        {platform === "android" && <AndroidSteps />}
        {platform === "desktop" && <DesktopMessage />}
        <Footnote postSetupUsername={postSetupUsername} />
      </div>
    </div>
  )
}

function Header({ postSetupUsername }: { postSetupUsername?: string }) {
  return (
    <header className="flex flex-col items-center gap-5 text-center">
      <img
        src="/favicon.png"
        alt=""
        aria-hidden="true"
        className="size-20 rounded-2xl shadow-sm"
        width={80}
        height={80}
      />
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {postSetupUsername
            ? `Almost there, ${postSetupUsername}.`
            : "Add Sufra to your home screen"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {postSetupUsername
            ? "Sufra lives on your phone like a regular app. One more step, then you're in."
            : "Sufra works as an app on your phone, not a tab in your browser. Add it to your home screen to keep going."}
        </p>
      </div>
    </header>
  )
}

function IosSteps() {
  return (
    <ol className="flex flex-col gap-4">
      <Step n={1}>
        <span>Tap the</span>
        <ShareIcon />
        <span>
          <strong className="font-medium">Share</strong> button in your browser bar
        </span>
      </Step>
      <Step n={2}>
        Scroll down and tap{" "}
        <strong className="font-medium">Add to Home Screen</strong>
      </Step>
      <Step n={3}>
        Tap <strong className="font-medium">Add</strong> in the top-right corner
      </Step>
    </ol>
  )
}

function AndroidSteps() {
  const [available, setAvailable] = useState<boolean>(hasInstallPrompt())
  const [status, setStatus] = useState<"idle" | "prompting" | "dismissed">(
    "idle",
  )

  useEffect(
    () => subscribeToInstallPrompt(() => setAvailable(hasInstallPrompt())),
    [],
  )

  const onInstall = async () => {
    setStatus("prompting")
    const outcome = await triggerInstallPrompt()
    if (outcome === "dismissed") setStatus("dismissed")
    else setStatus("idle")
    // On "accepted", the next page load will be in standalone mode and the
    // gate naturally falls away. No further action needed.
  }

  if (available) {
    return (
      <div className="flex flex-col gap-4">
        <Button onClick={onInstall} size="lg" className="w-full">
          {status === "prompting" ? "Installing…" : "Install Sufra"}
        </Button>
        {status === "dismissed" && (
          <p className="text-center text-xs text-muted-foreground">
            No problem. Tap Install again whenever you're ready — or use the
            menu steps below.
          </p>
        )}
        <details className="text-center text-xs text-muted-foreground">
          <summary className="cursor-pointer">Or install from the menu</summary>
          <div className="mt-4">
            <AndroidManualSteps />
          </div>
        </details>
      </div>
    )
  }

  return <AndroidManualSteps />
}

function AndroidManualSteps() {
  return (
    <ol className="flex flex-col gap-4 text-start">
      <Step n={1}>
        Tap the
        <MenuIcon />
        <span>
          <strong className="font-medium">menu</strong> in the browser's top
          corner
        </span>
      </Step>
      <Step n={2}>
        Tap <strong className="font-medium">Install app</strong> (or{" "}
        <strong className="font-medium">Add to Home screen</strong>)
      </Step>
      <Step n={3}>
        Confirm with <strong className="font-medium">Install</strong>
      </Step>
    </ol>
  )
}

function DesktopMessage() {
  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card px-5 py-6">
      <p className="text-sm">
        Sufra is built for your phone. The capture flow, the meal cards, the
        bottom nav — all designed for a hand.
      </p>
      <p className="text-sm text-muted-foreground">
        On a desktop browser, you can still install it as a windowed app —
        click the install icon in your address bar, or use the browser menu.
        But the experience is much better on your phone.
      </p>
      <p className="text-xs text-muted-foreground">
        Working on Sufra itself?{" "}
        <a href="?bypass=1" className="underline">
          Use a dev bypass
        </a>{" "}
        to access the browser version directly.
      </p>
    </div>
  )
}

function Footnote({ postSetupUsername }: { postSetupUsername?: string }) {
  if (postSetupUsername) {
    return (
      <p className="mx-auto max-w-xs text-center text-xs text-muted-foreground">
        After installing, tap the new{" "}
        <strong className="font-medium">Sufra</strong> icon. Sign in with{" "}
        <strong className="font-medium">{postSetupUsername}</strong> and the
        password you just set.
      </p>
    )
  }
  return (
    <p className="mx-auto max-w-xs text-center text-xs text-muted-foreground">
      Already installed? Open Sufra from your home screen — not the browser.
    </p>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {n}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 pt-0.5 text-sm">
        {children}
      </span>
    </li>
  )
}

function ShareIcon() {
  // iOS Share glyph approximation. Phosphor's Export is closest to the
  // square-with-up-arrow that ships on both Safari and Chrome iOS.
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-md border border-border bg-card text-primary">
      <Export size={14} weight="bold" />
    </span>
  )
}

function MenuIcon() {
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-md border border-border bg-card text-foreground">
      <DotsThreeVertical size={14} weight="bold" />
    </span>
  )
}

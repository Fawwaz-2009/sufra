// PWA installation + standalone detection.
//
// Sufra forces installation for mobile members — see the InstallGate
// component for the takeover UI. This module is the detection layer: where
// is the user, are they already inside the PWA, and on Android can we offer
// a 1-tap install?

const BYPASS_KEY = "sufra:install-bypass"
const USERNAME_HINT_KEY = "sufra:username-hint"

export type Platform = "ios" | "android" | "desktop"

// On iOS, the Share button lives in different places per browser, and
// in-app browsers (WhatsApp, Instagram, etc.) don't support installation
// at all. This is *the* critical detection for Sufra: a Member's first
// touch is a password link pasted into WhatsApp; tapping it opens
// WhatsApp's in-app webview, which can't A2HS. We detect that and tell
// the user to open in Safari/Chrome instead.
export type IosBrowser =
  | "safari"
  | "chrome"
  | "firefox"
  | "edge"
  | "in-app"
  | "unknown"

export function detectIosBrowser(): IosBrowser {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent
  // In-app browsers first — these UAs often also contain Safari/Mobile
  // markers, so we have to check them before the Safari branch.
  if (/FB_IAB|FBAN|FBAV|Instagram|WhatsApp|Line\/|MicroMessenger/i.test(ua)) {
    return "in-app"
  }
  if (/CriOS\//.test(ua)) return "chrome"
  if (/FxiOS\//.test(ua)) return "firefox"
  if (/EdgiOS\//.test(ua)) return "edge"
  // Safari proper: has Version/ + Mobile/ + Safari/, no third-party marker.
  if (
    /Safari\//.test(ua) &&
    /Version\//.test(ua) &&
    /Mobile\//.test(ua)
  ) {
    return "safari"
  }
  return "unknown"
}

// Detect whether the current page is running as an installed PWA.
// iOS Safari uses navigator.standalone; everything else uses display-mode.
// Both signals are checked since the platform mix is heterogeneous in 2026
// (Chrome iOS PWAs as of 16.4, Edge Android, Firefox Android, etc.).
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  // iOS (Safari + Chrome iOS pre-16.4 fallback)
  if ((window.navigator as { standalone?: boolean }).standalone === true) {
    return true
  }
  // Everything else
  if (
    window.matchMedia &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return true
  }
  return false
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop"
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return "ios"
  if (/Android/i.test(ua)) return "android"
  // iPadOS 13+ reports as Mac in UA — disambiguate via touch.
  if (
    /Macintosh/.test(ua) &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  ) {
    return "ios"
  }
  return "desktop"
}

export function isMobile(): boolean {
  const p = detectPlatform()
  return p === "ios" || p === "android"
}

// Dev escape hatch — never gates these contexts:
//   - localhost / 127.0.0.1
//   - Private LAN IPs (10.x, 192.168.x, 172.16-31.x) — for phone-on-LAN
//     dogfooding via `vite --host`
//   - `?bypass=1` query param (sticky — sets localStorage on first hit so
//     subsequent navigations without the param still bypass)
export function isDevBypass(): boolean {
  if (typeof window === "undefined") return false

  // Sticky flag from a prior ?bypass=1
  try {
    if (window.localStorage.getItem(BYPASS_KEY) === "1") return true
  } catch {
    // localStorage may be unavailable in some embed contexts
  }

  const { hostname, search } = window.location

  // Query param sets the sticky flag and bypasses immediately
  if (/[?&]bypass=1\b/.test(search)) {
    try {
      window.localStorage.setItem(BYPASS_KEY, "1")
    } catch {
      // ignore
    }
    return true
  }

  // Loopback
  if (hostname === "localhost" || hostname === "127.0.0.1") return true

  // RFC 1918 private ranges — common for `vite --host` LAN dogfooding
  if (/^10\./.test(hostname)) return true
  if (/^192\.168\./.test(hostname)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)) return true

  return false
}

// --- beforeinstallprompt capture (Android Chrome / Edge / Samsung) ---
//
// Browsers that support beforeinstallprompt fire it once per page load
// when the PWA meets installability criteria. We must preventDefault() to
// keep the event for later, and store it so the gate's "Install" button
// can call .prompt() in response to a user gesture.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferredPrompt: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const fn of listeners) fn()
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferredPrompt = e as InstallPromptEvent
    notify()
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    notify()
  })
}

export function hasInstallPrompt(): boolean {
  return deferredPrompt !== null
}

export function subscribeToInstallPrompt(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export async function triggerInstallPrompt(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  if (!deferredPrompt) return "unavailable"
  const evt = deferredPrompt
  await evt.prompt()
  const choice = await evt.userChoice
  deferredPrompt = null
  notify()
  return choice.outcome
}

// --- Username hint stash (cross-context survival is best-effort) ---
//
// When a Member redeems a password link in the browser, we stash their
// username so the PWA's /login screen can pre-fill it after install.
// localStorage doesn't always carry from browser → PWA on iOS (separate
// webview contexts), but on Android it does. Soft-fail: if the hint is
// gone, the Member knows their username regardless.

export function setUsernameHint(username: string): void {
  try {
    window.localStorage.setItem(USERNAME_HINT_KEY, username)
  } catch {
    // ignore
  }
}

export function readUsernameHint(): string | null {
  try {
    return window.localStorage.getItem(USERNAME_HINT_KEY)
  } catch {
    return null
  }
}

export function clearUsernameHint(): void {
  try {
    window.localStorage.removeItem(USERNAME_HINT_KEY)
  } catch {
    // ignore
  }
}

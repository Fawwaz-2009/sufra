import { toast } from "sonner"

export const PASSWORD_LINK_TOAST_MS = 6000

// Build and copy the share message; toast confirms with the 24h TTL surfaced
// per the design — Host pastes anywhere (WhatsApp, iMessage, group chat).
export async function copyPasswordLinkMessage(username: string, token: string) {
  const url = `${window.location.origin}/set-password/${token}`
  const message = `Hi ${username}, here's your link to join Sufra:\n${url}`
  const copied = await copyText(message)
  if (copied) {
    toast.success(
      `Password link copied. Expires in 24h. Send it to ${username}.`,
      { duration: PASSWORD_LINK_TOAST_MS }
    )
  } else {
    toast.message("Couldn't access clipboard.", {
      description: message,
      duration: 20000,
    })
  }
}

// Modern Clipboard API requires a secure context (HTTPS / localhost). When
// dogfooding the dev server from a phone over LAN IP, the page is plain HTTP
// and the modern API throws. Fall through to the legacy execCommand path —
// deprecated but still supported across mobile browsers — so the host can
// actually copy the link during local testing.
async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to legacy path
    }
  }
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.top = "0"
  textarea.style.left = "0"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand("copy")
  } catch {
    ok = false
  }
  document.body.removeChild(textarea)
  return ok
}

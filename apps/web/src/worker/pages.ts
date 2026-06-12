/**
 * The post-SPA static surface (ADR 0021) — everything the Worker serves besides `/api/*`:
 *
 *  - `/.well-known/apple-app-site-association` — the Universal-Links file. Apple's CDN fetches it
 *    at app install; it binds this domain's `/set-password/*` paths to the store app, so a tapped
 *    Password link opens the app's native redemption screen (PRD §10 #19). Self-hosted backends
 *    serve it too — their domain just isn't in the store app's entitlement, so they fall through
 *    to the page below (the accepted asymmetry, ADR 0021).
 *  - `/set-password/<token>` — the minimal NO-APP fallback: a single static HTML form, vanilla JS
 *    against the public password-links endpoints (ADR 0016). The token's only power stays "set a
 *    password once"; on success the page points at the app.
 *  - `/` — redirect to the marketing site. Everything else: 404.
 *
 * Deliberately not an SPA, not a template engine — one exported handler, two literals.
 */

const MARKETING_URL = "https://sufra.fawwaz.dev"

/** TeamID.bundleID of the store app (the EAS/ASC identity). */
const APPLE_APP_ID = "UP3J588KGY.com.fawwaz2009.sufra"

const AASA = JSON.stringify({
  applinks: {
    apps: [],
    details: [{ appID: APPLE_APP_ID, components: [{ "/": "/set-password/*" }], paths: ["/set-password/*"] }]
  }
})

export const serveFallback = (request: Request): Response => {
  const { pathname } = new URL(request.url)
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("not found", { status: 404 })

  if (pathname === "/.well-known/apple-app-site-association") {
    return new Response(AASA, { headers: { "content-type": "application/json" } })
  }
  if (/^\/set-password\/[^/]+$/.test(pathname)) {
    return new Response(SET_PASSWORD_HTML, { headers: { "content-type": "text/html; charset=utf-8" } })
  }
  if (pathname === "/") return Response.redirect(MARKETING_URL, 302)
  return new Response("not found", { status: 404 })
}

/**
 * The token rides the URL path; the page reads it client-side (`location.pathname`) so the HTML
 * stays one static string. Flow mirrors the native screen: GET show → form → POST redeem → "open
 * the app" hand-off. An invalid/expired token is a uniform 404 (ADR 0013/0016) → the friendly
 * dead-link state.
 */
const SET_PASSWORD_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Join Sufra</title>
<style>
  body { margin: 0; font-family: -apple-system, system-ui, sans-serif; background: #F6E8D5; color: #1c1917;
         display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  main { width: min(92vw, 24rem); background: #fff; border-radius: 1.25rem; padding: 2rem;
         box-shadow: 0 8px 30px rgb(0 0 0 / 0.08); }
  h1 { font-size: 1.35rem; margin: 0 0 0.5rem; }
  p { color: #57534e; font-size: 0.95rem; line-height: 1.5; }
  input { width: 100%; box-sizing: border-box; font-size: 1.05rem; padding: 0.8rem 1rem; margin-top: 0.75rem;
          border: 1px solid #e7e5e4; border-radius: 0.85rem; background: #fafaf9; }
  button { width: 100%; margin-top: 1rem; padding: 0.85rem; font-size: 1rem; font-weight: 600;
           color: #fff; background: #E45527; border: 0; border-radius: 999px; cursor: pointer; }
  button:disabled { opacity: 0.5; }
  .err { color: #b91c1c; font-size: 0.9rem; min-height: 1.2rem; margin: 0.5rem 0 0; }
  .hide { display: none; }
</style>
</head>
<body>
<main>
  <div id="loading"><p>Checking your link…</p></div>

  <div id="invalid" class="hide">
    <h1>This link isn't valid anymore</h1>
    <p>It may have been used already or expired (links are valid for 24 hours). Ask your Host for a new one.</p>
  </div>

  <form id="form" class="hide">
    <h1 id="welcome"></h1>
    <p>Choose a password to finish setting up your account.</p>
    <input id="pw" type="password" placeholder="Password (6+ characters)" autocomplete="new-password" minlength="6" required>
    <input id="pw2" type="password" placeholder="Confirm password" autocomplete="new-password" minlength="6" required>
    <p class="err" id="err"></p>
    <button id="submit" type="submit">Set password</button>
  </form>

  <div id="done" class="hide">
    <h1>You're in!</h1>
    <p id="doneCopy"></p>
  </div>
</main>
<script>
  var token = location.pathname.split("/").pop();
  var api = location.origin + "/api/password-links/" + encodeURIComponent(token);
  var $ = function (id) { return document.getElementById(id); };
  function show(id) {
    ["loading", "invalid", "form", "done"].forEach(function (s) { $(s).classList.toggle("hide", s !== id); });
  }

  var username = "";
  fetch(api).then(function (r) {
    if (!r.ok) throw new Error();
    return r.json();
  }).then(function (link) {
    username = link.username;
    $("welcome").textContent = "Welcome to the " + link.familyName + " Sufra, " + link.username + "!";
    show("form");
  }).catch(function () { show("invalid"); });

  $("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = $("pw").value, pw2 = $("pw2").value;
    if (pw.length < 6) { $("err").textContent = "Password must be at least 6 characters."; return; }
    if (pw !== pw2) { $("err").textContent = "Passwords don't match."; return; }
    $("err").textContent = "";
    $("submit").disabled = true;
    fetch(api + "/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw })
    }).then(function (r) {
      if (!r.ok) throw new Error();
      $("doneCopy").textContent = "Your password is set. Open the Sufra app, connect to " +
        location.origin + ", and sign in as " + username + ".";
      show("done");
    }).catch(function () {
      $("submit").disabled = false;
      $("err").textContent = "Something went wrong. Try again.";
    });
  });
</script>
</body>
</html>`

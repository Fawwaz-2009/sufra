import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'

// Canonical site URL. When the staged-domain strategy graduates Sufra to
// its own TLD, only this constant needs to change. See
// docs/discovery-strategy.md for the full backlink/SEO plan.
const SITE_URL = 'https://sufra.fawwaz.dev'
const OG_IMAGE = `${SITE_URL}/og.png`
const TITLE = 'Sufra — a photo-first calorie tracker for the people at your table'
const DESCRIPTION =
  'Open-source, photo-first calorie tracker for households. Runs on your own Cloudflare account; calls your own OpenRouter key. No SaaS, no email server, no subscriptions.'

// Schema.org SoftwareApplication markup. Helps search engines understand
// what Sufra is and surface it correctly in software listings.
const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Sufra',
  description: DESCRIPTION,
  url: SITE_URL,
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web (PWA), iOS, Android',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  license: 'https://opensource.org/licenses/MIT',
  isAccessibleForFree: true,
  creator: {
    '@type': 'Person',
    name: 'Fawwaz Alharbi',
    url: 'https://fawwaz.dev',
  },
  codeRepository: 'https://github.com/Fawwaz-2009/sufra',
  programmingLanguage: ['TypeScript', 'React'],
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      // Theme color matches the app's pure-white paper; browsers tint
      // their chrome to match on mobile.
      { name: 'theme-color', content: '#ffffff' },

      // Core SEO
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'author', content: 'Fawwaz Alharbi' },

      // Open Graph (Facebook, WhatsApp, iMessage, Slack, Discord, LinkedIn)
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:site_name', content: 'Sufra' },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      {
        property: 'og:image:alt',
        content:
          'Sufra — a photo-first calorie tracker for the people at your table',
      },
      { property: 'og:locale', content: 'en_US' },

      // Twitter / X card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'canonical', href: SITE_URL },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON_LD,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

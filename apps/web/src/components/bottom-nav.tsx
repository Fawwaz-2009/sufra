import { forwardRef, type ComponentPropsWithoutRef, type ComponentType } from "react"
import { useQuery } from "@tanstack/react-query"
import { TrendingUp, House, Shield, User } from "lucide-react"
import { createLink } from "@tanstack/react-router"

import { meQueryOptions } from "@/client/me"
import { cn } from "@/lib/utils"

type IconComp = ComponentType<{
  className?: string
  strokeWidth?: number
}>

type NavItemBaseProps = ComponentPropsWithoutRef<"a"> & {
  icon: IconComp
  label: string
  active?: boolean
}

// Active tabs get a slightly heavier stroke + `fill-current` so the icon
// reads as "selected" without needing a separate filled glyph. Lucide
// doesn't ship filled variants like Phosphor did, so we lean on CSS.
const NavItemBase = forwardRef<HTMLAnchorElement, NavItemBaseProps>(
  ({ icon: Icon, label, active, className, ...rest }, ref) => (
    <a
      ref={ref}
      className={cn(
        "group flex flex-1 flex-col items-center gap-0.5 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
        active && "text-foreground",
        className
      )}
      {...rest}
    >
      <Icon
        className={cn("size-5", active && "fill-current")}
        strokeWidth={active ? 2.25 : 2}
      />
      <span>{label}</span>
    </a>
  )
)
NavItemBase.displayName = "NavItemBase"

const NavItem = createLink(NavItemBase)

export function BottomNav() {
  // `/me` is primed by the route gate on every tab this nav renders on; read role from it (no extra fetch).
  const { data: me } = useQuery(meQueryOptions())
  const isHost = me?.role === "host"

  return (
    // Bottom padding clears the iPhone home-indicator safe area. `pb-3`
    // alone (12px) is too tight on devices with a home-indicator zone
    // (~34px), so we max() against it. The same rule applies to Android
    // gesture-bar devices that report a non-zero safe-area-inset-bottom.
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md justify-center px-3"
      style={{
        paddingBottom:
          "max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.25rem))",
      }}
    >
      <div className="pointer-events-auto flex w-full items-center justify-around rounded-full bg-card/95 px-2 py-1.5 shadow-lg ring-1 ring-foreground/10 backdrop-blur">
        <NavItem
          to="/"
          activeOptions={{ exact: true }}
          activeProps={{ active: true }}
          icon={House}
          label="Today"
        />
        <NavItem
          to="/progress"
          activeProps={{ active: true }}
          icon={TrendingUp}
          label="Progress"
        />
        <NavItem
          to="/profile"
          activeProps={{ active: true }}
          icon={User}
          label="Profile"
        />
        {isHost && (
          <NavItem
            to="/admin"
            activeProps={{ active: true }}
            icon={Shield}
            label="Admin"
          />
        )}
      </div>
    </nav>
  )
}

import { forwardRef, type ComponentPropsWithoutRef, type ComponentType } from "react"
import { House, Shield } from "@phosphor-icons/react"
import { createLink } from "@tanstack/react-router"

import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

type IconComp = ComponentType<{
  className?: string
  weight?: "bold" | "fill"
}>

type NavItemBaseProps = ComponentPropsWithoutRef<"a"> & {
  icon: IconComp
  label: string
  active?: boolean
}

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
      <Icon className="size-5" weight={active ? "fill" : "bold"} />
      <span>{label}</span>
    </a>
  )
)
NavItemBase.displayName = "NavItemBase"

const NavItem = createLink(NavItemBase)

export function BottomNav() {
  const { session } = useAuth()
  const isHost = session?.user.role === "host"

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md justify-center px-3 pb-3">
      <div className="pointer-events-auto flex w-full items-center justify-around rounded-full bg-card/95 px-2 py-1.5 shadow-lg ring-1 ring-foreground/10 backdrop-blur">
        <NavItem
          to="/"
          activeOptions={{ exact: true }}
          activeProps={{ active: true }}
          icon={House}
          label="Today"
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

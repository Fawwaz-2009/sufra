import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: "/login" })
    return { session: context.session }
  },
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const { session } = Route.useRouteContext()

  const signOut = async () => {
    await authClient.signOut()
    await navigate({ to: "/login" })
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Signed in</h1>
          <p>
            Welcome, <span className="font-mono">{session.user.username}</span>{" "}
            <span className="text-muted-foreground">({session.user.role})</span>
          </p>
        </div>
        <Button onClick={signOut} variant="outline" className="w-fit">
          Sign out
        </Button>
        <p className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </p>
      </div>
    </div>
  )
}

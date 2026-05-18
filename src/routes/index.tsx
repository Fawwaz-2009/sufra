import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await api.api.health.$get()
      if (!res.ok) throw new Error("health check failed")
      return res.json()
    },
  })

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Project ready!</h1>
          <p>You may now add components and start building.</p>
          <p>We&apos;ve already added the button component for you.</p>
          <Button className="mt-2">Button</Button>
        </div>

        <div className="rounded border p-3 font-mono text-xs">
          <div className="mb-1 font-semibold not-italic">/api/health</div>
          {health.isPending && <div>loading…</div>}
          {health.isError && (
            <div className="text-red-600">error: {health.error.message}</div>
          )}
          {health.data && (
            <pre className="overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(health.data, null, 2)}
            </pre>
          )}
        </div>

        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>
      </div>
    </div>
  )
}

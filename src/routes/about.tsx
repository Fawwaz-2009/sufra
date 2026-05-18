import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/about")({
  component: About,
})

function About() {
  return (
    <div className="p-6 text-sm leading-loose">
      <h1 className="font-medium">About</h1>
      <p>Routing placeholder — proves TanStack Router is wired.</p>
    </div>
  )
}

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PoweredBy } from "@/components/powered-by"
import { authClient } from "@/lib/auth-client"
import { useAuth } from "@/lib/auth-context"
import { clearUsernameHint, readUsernameHint } from "@/lib/standalone"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

const schema = z.object({
  username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
})

type FormValues = z.infer<typeof schema>

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.session) throw redirect({ to: "/" })
  },
  component: LoginPage,
})

function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Pre-fill the username if it survived from a recent password-link
  // redemption. Best-effort: localStorage may not carry from browser to
  // installed PWA on iOS, in which case the field renders empty.
  const [usernameHint] = useState<string | null>(() => readUsernameHint())

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { username: usernameHint ?? "", password: "" },
  })

  useEffect(() => {
    if (usernameHint) setValue("username", usernameHint)
  }, [usernameHint, setValue])

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null)
    const result = await authClient.signIn.username({
      username: values.username,
      password: values.password,
    })
    if (result.error) {
      setSubmitError("Username or password is incorrect.")
      return
    }
    // Clear the hint — it's a single-use bridge across the browser → PWA
    // handoff, not a persistent preference.
    clearUsernameHint()
    await auth.refresh()
    void navigate({ to: "/" })
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sufra</CardTitle>
          <CardDescription>
            Sign in with the credentials you were given.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                autoFocus
                {...register("username")}
              />
              {errors.username && (
                <p className="text-xs text-destructive">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {submitError && (
              <p className="text-xs text-destructive">{submitError}</p>
            )}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>

            <p className="text-xs text-muted-foreground">
              Forgot? Ask whoever set up the app for a new password.
            </p>
          </form>
        </CardContent>
      </Card>
      <PoweredBy />
    </div>
  )
}

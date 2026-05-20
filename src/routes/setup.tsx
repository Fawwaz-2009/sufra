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
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

const schema = z
  .object({
    username: z
      .string()
      .min(3, "At least 3 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore only"),
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  })

type FormValues = z.infer<typeof schema>

export const Route = createFileRoute("/setup")({
  beforeLoad: ({ context }) => {
    if (!context.needsSetup) {
      throw redirect({ to: context.session ? "/" : "/login" })
    }
  },
  component: SetupPage,
})

function SetupPage() {
  const auth = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: standardSchemaResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null)
    const res = await api.api.setup.$post({
      json: { username: values.username, password: values.password },
    })
    if (!res.ok) {
      setSubmitError("Something went wrong. Try again.")
      return
    }
    await auth.refresh()
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Welcome to Sufra</CardTitle>
          <CardDescription>
            First, create the host account. You'll be the only person who can
            add or remove users.
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
                autoComplete="new-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...register("confirm")}
              />
              {errors.confirm && (
                <p className="text-xs text-destructive">
                  {errors.confirm.message}
                </p>
              )}
            </div>

            {submitError && (
              <p className="text-xs text-destructive">{submitError}</p>
            )}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create host"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

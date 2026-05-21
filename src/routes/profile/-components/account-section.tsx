import { useNavigate } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { SectionCard } from "./section-card"

export function AccountSection({ username }: { username: string }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const handleSignOut = async () => {
    await auth.signOut()
    void navigate({ to: "/login" })
  }
  return (
    <SectionCard label="Account">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-muted-foreground">Username</span>
        <span className="text-sm">{username}</span>
      </div>
      <div className="px-4 py-3">
        <Button variant="outline" onClick={handleSignOut} className="w-full">
          Sign out
        </Button>
      </div>
    </SectionCard>
  )
}

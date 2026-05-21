export interface AppEnv extends Env {
  OPENROUTER_API_KEY: string
}

export type AuthedSession = { user: { id: string; role?: string | null } }

export type AppEnvCtx = {
  Bindings: AppEnv
  Variables: { session: AuthedSession }
}

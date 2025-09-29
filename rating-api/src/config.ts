export interface AppConfig {
  port: number
}

export const loadConfig = (): AppConfig => {
  const port = Number(process.env.PORT) || 4000
  return { port }
}

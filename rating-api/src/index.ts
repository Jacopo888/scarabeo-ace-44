import express from 'express'
import cors from 'cors'
import { registerRoutes } from './router'
import { errorMiddleware } from './error'
import { loadConfig } from './config'

export const app = express()
const { port } = loadConfig()

app.use(cors())
app.use(express.json())

registerRoutes(app)

// Error middleware last
app.use(errorMiddleware)

// Avoid listening when running tests (Vitest sets VITEST)
if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`rating-api listening on port ${port}`)
  })
}

export default app

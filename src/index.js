import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import passport from 'passport'
import authRouter from './routes/auth.js'
import tasksRouter from './routes/tasks.js'

const app  = express()
const PORT = process.env.PORT || 3001

// ── Middleware ────────────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(passport.initialize())

// ── Routes ────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'forge-api' }))

app.use('/auth',   authRouter)
app.use('/tasks',  tasksRouter)

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada' }))

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Erro interno do servidor' })
})

app.listen(PORT, () => {
  console.log(`🔥 Forge API rodando na porta ${PORT}`)
})

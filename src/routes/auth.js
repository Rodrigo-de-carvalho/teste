import { Router } from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { signToken } from '../lib/jwt.js'
import prisma from '../lib/prisma.js'

const router = Router()

// ── Passport Google Strategy ──────────────────────────────────────────────
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email  = profile.emails?.[0]?.value
      const avatar = profile.photos?.[0]?.value

      let user = await prisma.user.findUnique({ where: { googleId: profile.id } })

      if (!user) {
        user = await prisma.user.create({
          data: {
            googleId: profile.id,
            email:    email || '',
            name:     profile.displayName,
            avatar,
          },
        })
      } else {
        // Update avatar/name in case they changed
        user = await prisma.user.update({
          where: { id: user.id },
          data:  { name: profile.displayName, avatar },
        })
      }

      done(null, user)
    } catch (err) {
      done(err)
    }
  }
))

// ── Routes ────────────────────────────────────────────────────────────────

// Redirect to Google
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
)

// Google callback → gera JWT → redireciona pro frontend
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth` }),
  (req, res) => {
    const token = signToken({ userId: req.user.id })
    // Redireciona para o frontend com o token na URL (frontend salva no localStorage)
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`)
  }
)

// Retorna dados do usuário logado
router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado' })

    const { verifyToken } = await import('../lib/jwt.js')
    const payload = verifyToken(header.slice(7))
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, avatar: true, xp: true, level: true, streak: true, totalFocusSec: true, todayFocusSec: true, focusTaskId: true }
    })
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })
    res.json(user)
  } catch {
    res.status(401).json({ error: 'Token inválido' })
  }
})

// Atualiza dados do usuário (XP, streak, focus time, focusTaskId)
router.patch('/me', async (req, res) => {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado' })

    const { verifyToken } = await import('../lib/jwt.js')
    const payload = verifyToken(header.slice(7))

    const allowed = ['xp', 'level', 'streak', 'totalFocusSec', 'todayFocusSec', 'focusTaskId', 'lastActiveDate']
    const data = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key]
    }

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data,
      select: { id: true, name: true, email: true, avatar: true, xp: true, level: true, streak: true, totalFocusSec: true, todayFocusSec: true, focusTaskId: true }
    })
    res.json(user)
  } catch {
    res.status(401).json({ error: 'Token inválido' })
  }
})

export default router

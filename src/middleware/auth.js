import { verifyToken } from '../lib/jwt.js'
import prisma from '../lib/prisma.js'

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autenticado' })
    }

    const token = header.slice(7)
    const payload = verifyToken(token)

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' })

    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}

import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'forge-dev-secret-change-in-prod'
const EXPIRES = '30d'

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES })
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET)
}

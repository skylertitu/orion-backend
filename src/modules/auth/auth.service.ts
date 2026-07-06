import db from '../../database/db.js'
import { genId } from '../../lib/id.js'
import { hashPassword, comparePassword } from '../../lib/password.js'

export interface AuthUser {
  id: string
  name: string
  username: string
  email: string
  role: string
}

export interface AuthResult {
  user: AuthUser
  token: string
}

export class AuthService {
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  async register({ name, username, email, password }: { name: string; username: string; email: string; password: string }): Promise<AuthResult> {
    const normalizedName = name.trim()
    const normalizedUsername = username.trim()
    const normalizedEmail = this.normalizeEmail(email)

    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(normalizedEmail, normalizedUsername)
    if (existing) {
      throw Object.assign(new Error('El correo o usuario ya esta registrado'), { status: 400, expose: true })
    }

    const id = genId()
    const now = new Date().toISOString()
    const hash = await hashPassword(password)

    db.prepare('INSERT INTO users (id, name, username, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, normalizedName, normalizedUsername, normalizedEmail, hash, 'student', now)

    const token = genId()
    db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)').run(token, id, now)

    return {
      user: { id, name: normalizedName, username: normalizedUsername, email: normalizedEmail, role: 'student' },
      token
    }
  }

  async login({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const normalizedEmail = this.normalizeEmail(email)
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as any
    if (!user) {
      console.warn(`[Auth] Login fallido: usuario no encontrado (${normalizedEmail})`)
      throw Object.assign(new Error('Correo o contraseña incorrectos'), { status: 401, expose: true })
    }

    const valid = await comparePassword(password, user.password_hash)
    if (!valid) {
      console.warn(`[Auth] Login fallido: contraseña incorrecta (${normalizedEmail})`)
      throw Object.assign(new Error('Correo o contraseña incorrectos'), { status: 401, expose: true })
    }

    const token = genId()
    const now = new Date().toISOString()
    db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)').run(token, user.id, now)

    return {
      user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role },
      token
    }
  }

  getMe(user: AuthUser): AuthUser {
    return user
  }

  logout(token: string): { ok: boolean } {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return { ok: true }
  }
}

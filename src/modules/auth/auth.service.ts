import db from '../../database/db.js'
import { genId } from '../../common/utils/id.js'
import { hashPassword, comparePassword } from '../../common/utils/password.js'
import { isConfigured, supabaseUrl, supabaseAnonKey } from '../../common/config/supabase.js'

export interface AuthUser {
  id: string; name: string; username: string; email: string; role: string
}

export interface AuthResult {
  user: AuthUser
  token: string
}

export class AuthService {
  async register({ name, username, email, password }: { name: string; username: string; email: string; password: string }): Promise<AuthResult> {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username)
    if (existing) {
      throw Object.assign(new Error('El correo o usuario ya está registrado'), { status: 400, expose: true })
    }

    const id = genId()
    const now = new Date().toISOString()
    const hash = await hashPassword(password)

    db.prepare('INSERT INTO users (id, name, username, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, name, username, email, hash, 'student', now)

    const token = genId()
    db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)').run(token, id, now)

    return { user: { id, name, username, email, role: 'student' }, token }
  }

  async login({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
    if (!user) {
      throw Object.assign(new Error('Correo o contraseña incorrectos'), { status: 401, expose: true })
    }

    const valid = await comparePassword(password, user.password_hash)
    if (!valid) {
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

  getSupabaseConfig(): { configured: boolean; supabaseUrl: string | undefined; supabaseAnonKey: string | undefined } {
    return { configured: isConfigured, supabaseUrl, supabaseAnonKey }
  }
}

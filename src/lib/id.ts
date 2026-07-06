import { randomBytes } from 'crypto'

export function genId(): string {
  return randomBytes(16).toString('hex')
}

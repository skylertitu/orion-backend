import type { Express } from 'express'
import type { Server } from 'http'

let app: Express | null = null

export async function getApp(): Promise<Express> {
  if (!app) {
    await seedTestData()
    const { createApp } = await import('../src/app.module.js')
    app = createApp()
  }
  return app
}

async function seedTestData(): Promise<void> {
  const seed = (await import('../src/database/seed.js')).default
  await seed()
}

export function startServer(app: Express): Promise<Server> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
}

export function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
  })
}

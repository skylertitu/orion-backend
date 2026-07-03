import { createApp } from './app.module.js'
import seedData from './database/seed.js'

function logStartup(message: string): void {
  console.log(`[Bootstrap] ${message}`)
}

process.on('unhandledRejection', (err) => {
  console.error('[Bootstrap] ERROR Unhandled Rejection:', err)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  console.error('[Bootstrap] ERROR Uncaught Exception:', err)
  process.exit(1)
})

logStartup('Inicializando base de datos...')
await seedData()

const PORT = Number.parseInt(process.env.PORT as string, 10) || 3008
const app = createApp()

const server = app.listen(PORT, () => {
  logStartup(`Backend corriendo en http://localhost:${PORT}`)
  logStartup('Base de datos: src/data/apptrading.db')
  logStartup(`API: http://localhost:${PORT}/api`)
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Bootstrap] ERROR Puerto ${PORT} ya esta en uso`)
  } else {
    console.error('[Bootstrap] ERROR Error del servidor:', err)
  }
  process.exit(1)
})

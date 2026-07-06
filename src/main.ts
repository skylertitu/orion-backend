import { createApp } from './app.module.js'
import seedData from './database/seed.js'

function logStartup(message: string): void {
  console.log(`[Bootstrap] ${message}`)
}

function logError(context: string, err: unknown): void {
  const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err)
  console.error(`\n❌ [ERROR] ${context}: ${msg}\n`)
}

process.on('unhandledRejection', (reason) => {
  logError('Unhandled Rejection', reason)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  logError('Uncaught Exception', err)
  process.exit(1)
})

try {
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
      logError('Puerto en uso', `El puerto ${PORT} ya esta siendo usado por otro proceso`)
    } else {
      logError('Error del servidor', err)
    }
    process.exit(1)
  })
} catch (err) {
  logError('Inicializacion', err)
  process.exit(1)
}

import { createApp } from './app.module.js'
import seedData from './database/seed.js'

await seedData()

const PORT = parseInt(process.env.PORT as string) || 3008
const app = createApp()

app.listen(PORT, () => {
  console.log(`\n  🔧 Backend corriendo en http://localhost:${PORT}`)
  console.log(`  📁 Base de datos: src/data/apptrading.db`)
  console.log(`  🌐 API: http://localhost:${PORT}/api\n`)
})

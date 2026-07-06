import { mkdirSync } from 'fs'
import { resolve } from 'path'

const TEST_DIR = resolve('test', 'tmp-db')
const TEST_DB_PATH = resolve(TEST_DIR, 'apptrading.db')

process.env.DB_DIR = TEST_DIR
process.env.DB_PATH = TEST_DB_PATH

mkdirSync(TEST_DIR, { recursive: true })

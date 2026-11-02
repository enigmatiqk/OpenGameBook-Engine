// Post-build script - Copy serve scripts to dist/
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')

console.log('')
console.log('Post-build tasks...')

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

const files = ['serve.sh', 'serve.ps1']

for (const file of files) {
  const src = join(__dirname, file)
  const dest = join(distDir, file)
  if (existsSync(src)) {
    copyFileSync(src, dest)
    console.log(`[OK] ${file} copied to dist/`)
  }
}

console.log('Post-build tasks completed')
console.log('')

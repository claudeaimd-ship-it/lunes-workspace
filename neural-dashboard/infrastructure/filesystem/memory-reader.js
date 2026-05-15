// Adaptador: lee archivos de memoria del workspace

import fs from 'fs'
import path from 'path'

const HOME = process.env.HOME
const MEMORY_DIR = path.join(HOME, '.openclaw/workspace/memory')

export class MemoryReader {
  readAll() {
    const memories = []
    try {
      const files = fs.readdirSync(MEMORY_DIR)
      files
        .filter(f => f.endsWith('.md'))
        .forEach(file => {
          const content = fs.readFileSync(path.join(MEMORY_DIR, file), 'utf-8')
          const lines = content.split('\n').filter(l => l.trim())
          memories.push({
            file,
            summary: lines.slice(0, 10).join('\n').substring(0, 200),
            lines: lines.length
          })
        })
    } catch (e) { /* sin memoria */ }
    return memories
  }
}

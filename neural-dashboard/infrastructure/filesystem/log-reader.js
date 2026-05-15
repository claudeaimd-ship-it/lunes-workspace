// Adaptador: lee logs del sistema de archivos

import fs from 'fs'
import path from 'path'

const HOME = process.env.HOME
const LOG_DIR = path.join(HOME, '.openclaw/logs')

export class LogReader {
  readRecentLogs(maxPerFile = 50) {
    const logs = {}
    try {
      const files = fs.readdirSync(LOG_DIR)
      files
        .filter(f => f.endsWith('.log') || f.endsWith('.jsonl'))
        .forEach(file => {
          const filePath = path.join(LOG_DIR, file)
          const content = fs.readFileSync(filePath, 'utf-8')
          const lines = content.split('\n').filter(l => l.trim())
          logs[file] = lines.slice(-maxPerFile).map(l => ({
            timestamp: new Date(),
            text: l.substring(0, 300)
          }))
        })
    } catch (e) { /* sin logs */ }
    return logs
  }
}

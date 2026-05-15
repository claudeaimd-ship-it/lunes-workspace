// Adaptador: implementa SessionRepository leyendo sessions.json de OpenClaw

import fs from 'fs'
import path from 'path'
import { SessionRepository } from '../../domain/ports/session-repository.js'

const HOME = process.env.HOME
const SESSION_STORE = path.join(HOME, '.openclaw/agents/main/sessions/sessions.json')

export class SessionJsonRepository extends SessionRepository {
  async getAll() {
    if (!fs.existsSync(SESSION_STORE)) return []

    const raw = fs.readFileSync(SESSION_STORE, 'utf-8')
    const data = JSON.parse(raw)

    if (Array.isArray(data)) return data
    if (data.sessions) return data.sessions

    // Formato: { 'agent:main:...': { ... }, ... }
    return Object.entries(data).map(([key, val]) => ({
      key,
      ...val,
      updatedAt: val.updatedAt || 0
    }))
  }
}

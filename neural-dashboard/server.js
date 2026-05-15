// server.js — Punto de entrada: cablea dependencias e inicia
// Adaptado a arquitectura hexagonal

import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import chokidar from 'chokidar'
import path from 'path'
import { execSync } from 'child_process'

// ─── Importar puertos ───
import { SessionJsonRepository } from './infrastructure/database/session-json-repository.js'
import { IdentityFromFile } from './infrastructure/filesystem/identity-from-file.js'
import { LogReader } from './infrastructure/filesystem/log-reader.js'
import { MemoryReader } from './infrastructure/filesystem/memory-reader.js'

// ─── Importar casos de uso ───
import { BuildAgentNetwork } from './application/use-cases/build-agent-network.js'

// ─── Importar adaptadores ───
import { setupSocketHandler } from './adapters/web/socket-handler.js'

// ─── Config ───
const PORT = 3456
const HOME = process.env.HOME
const SESSION_STORE = path.join(HOME, '.openclaw/agents/main/sessions/sessions.json')

// ─── Inicializar dependencias (inyección manual) ───
const sessionRepository = new SessionJsonRepository()
const identityReader = new IdentityFromFile()
const logReader = new LogReader()
const memoryReader = new MemoryReader()
const buildAgentNetwork = new BuildAgentNetwork({ sessionRepository, identityReader })

// ─── Express + Socket.io ───
const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.static('public'))

// ─── Estado en memoria ───
let currentState = {
  agents: [],
  connections: [],
  logs: {},
  memories: [],
  timestamp: Date.now()
}

// ─── Función que construye el estado (invocada en cada poll) ───
async function refreshState() {
  try {
    const { agents, connections } = await buildAgentNetwork.execute()
    const logs = logReader.readRecentLogs()
    const memories = memoryReader.readAll()

    currentState = { agents, connections, logs, memories, timestamp: Date.now() }

    io.emit('agents_update', currentState)

    if (agents.length > 0) {
      const totalSessions = agents.reduce((s, a) => s + a.sessionCount, 0)
      console.log(`[${new Date().toLocaleTimeString()}] ✓ ${agents.length} agente(s), ${totalSessions} sesiones`)
    }
  } catch (e) {
    console.error('Poll error:', e.message)
  }
}

function getNetworkData() {
  return currentState
}

// ─── Configurar Socket.io ───
setupSocketHandler(io, getNetworkData)

// ─── Polling ───
setInterval(refreshState, 10000)
setTimeout(refreshState, 1000)

// ─── Watch sessions file ───
try {
  chokidar.watch(SESSION_STORE, { persistent: true }).on('change', () => {
    console.log('Sessions changed, polling...')
    setTimeout(refreshState, 500)
  })
} catch(e) {
  console.log('Watch not available, relying on polling')
}

// ─── Arrancar ───
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🧠 Neural Dashboard running at http://0.0.0.0:${PORT}`)
  console.log(`   Open in browser: http://localhost:${PORT}`)
  try {
    const ip = execSync("hostname -I | awk '{print $1}'", { encoding: 'utf-8' }).trim()
    console.log(`   LAN access:      http://${ip}:${PORT}`)
  } catch(e) {}
})

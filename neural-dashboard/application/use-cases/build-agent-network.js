// Caso de uso: Construye la red de agentes a partir de sesiones
// Orquesta: toma sesiones del repositorio, las agrupa por agente, devuelve la red

import { Agent } from '../../domain/entities/agent.js'
import { Session } from '../../domain/entities/session.js'

export class BuildAgentNetwork {
  constructor({ sessionRepository, identityReader }) {
    this.sessionRepository = sessionRepository
    this.identityReader = identityReader
  }

  async execute() {
    const rawSessions = await this.sessionRepository.getAll()
    const identity = this.identityReader.readAgentIdentity()

    // Agrupar sesiones por agentId (parts[1] de la key)
    const grouped = new Map()

    for (const s of rawSessions) {
      const key = s.key || s.sessionKey || 'unknown'
      const parts = key.split(':')
      const agentId = parts.length >= 2 ? parts[1] : 'main'
      const userId = parts.length >= 5 ? parts[4] : null

      if (!grouped.has(agentId)) {
        grouped.set(agentId, {
          agentId,
          sessions: [],
          channels: new Set(),
          totalTokens: 0,
          lastActive: 0,
          status: 'idle'
        })
      }

      const entry = grouped.get(agentId)
      const session = new Session({
        key,
        sessionId: s.sessionId,
        userId,
        userName: this._getUserName(userId),
        channel: parts.length >= 3 ? parts[2] : 'unknown',
        lastActive: new Date(s.updatedAt || 0),
        tokensUsed: s.totalTokens || 0,
        model: s.model || 'unknown',
        status: s.abortedLastRun ? 'error' : s.status
      })

      entry.sessions.push(session)
      entry.channels.add(session.channel)
      entry.totalTokens += session.tokensUsed
      entry.lastActive = Math.max(entry.lastActive, s.updatedAt || 0)

      const st = s.abortedLastRun ? 'error' : s.status === 'running' ? 'active' : 'idle'
      if (st === 'active' || st === 'error') entry.status = st
    }

    // Construir agentes
    const agents = Array.from(grouped.values()).map(g => new Agent({
      agentId: g.agentId,
      name: identity.name,
      emoji: identity.emoji,
      status: g.status,
      channels: Array.from(g.channels),
      sessions: g.sessions,
      totalTokens: g.totalTokens,
      lastActive: g.lastActive
    }))

    // Construir conexiones entre agentes
    const connections = []
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const sharedChannels = agents[i].channels.filter(
          c => agents[j].channels.includes(c)
        )
        const strength = Math.min(
          (agents[i].totalTokens + agents[j].totalTokens) / 1000,
          1
        )
        connections.push({
          source: agents[i].agentId,
          target: agents[j].agentId,
          type: sharedChannels.length > 0 ? 'same-channel' : 'same-host',
          strength
        })
      }
    }

    return { agents, connections }
  }

  _getUserName(userId) {
    if (!userId) return 'System'
    // El adaptador inyectará userName más adelante si es necesario
    return userId
  }
}

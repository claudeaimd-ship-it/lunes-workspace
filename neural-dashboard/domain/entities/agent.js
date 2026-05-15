// Entidad: Agente
// Domain puro — solo datos y lógica de negocio

export class Agent {
  constructor({ agentId, name, emoji, status, channels, sessions, totalTokens, lastActive }) {
    this.agentId = agentId
    this.name = name
    this.emoji = emoji
    this.status = status        // 'active' | 'idle' | 'error'
    this.channels = channels
    this.sessions = sessions    // Session[]
    this.totalTokens = totalTokens
    this.lastActive = lastActive
  }

  get sessionCount() {
    return this.sessions.length
  }

  get uniqueUsers() {
    const users = new Set(this.sessions.map(s => s.userName))
    return Array.from(users)
  }
}

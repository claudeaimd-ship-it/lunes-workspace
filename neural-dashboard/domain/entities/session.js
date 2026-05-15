// Entidad: Sesión de un agente
// Domain puro

export class Session {
  constructor({ key, sessionId, userId, userName, channel, lastActive, tokensUsed, model, status }) {
    this.key = key
    this.sessionId = sessionId
    this.userId = userId
    this.userName = userName
    this.channel = channel
    this.lastActive = lastActive || new Date()
    this.tokensUsed = tokensUsed || 0
    this.model = model || 'unknown'
    this.status = status || 'active'
  }
}

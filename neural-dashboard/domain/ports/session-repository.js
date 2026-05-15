// Puerto: define el contrato para obtener sesiones
// Domain puro — no sabe de Express, Socket.io, archivos ni nada externo

export class SessionRepository {
  async getAll() {
    throw new Error('SessionRepository.getAll() must be implemented by adapter')
  }
}

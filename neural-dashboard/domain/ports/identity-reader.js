// Puerto: lee la identidad del agente
// Domain puro — no sabe de dónde vienen los datos

export class IdentityReader {
  readAgentIdentity() {
    throw new Error('IdentityReader.readAgentIdentity() must be implemented by adapter')
  }
}

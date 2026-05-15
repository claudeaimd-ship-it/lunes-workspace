// Adaptador web: maneja conexiones Socket.io
// Solo esto cambia si migras de Socket.io a otra cosa

export function setupSocketHandler(io, getNetworkData) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Enviar estado actual al conectar
    socket.emit('agents_update', getNetworkData())

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })
}

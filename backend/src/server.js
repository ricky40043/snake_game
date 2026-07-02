const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const path = require('path')
const config = require('./config')
const healthRouter = require('./routes/health')
const { registerSocketHandlers } = require('./sockets/index')

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
  },
  // Real-time game input should not silently fall back to HTTP polling.
  // If WebSocket is unavailable, fail fast instead of feeling delayed.
  transports: ['websocket'],
})

app.use(cors({ origin: config.corsOrigins }))
app.use(express.json())
app.use('/api', healthRouter)

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../../frontend/dist')
  app.use(express.static(staticPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'))
  })
}

registerSocketHandlers(io)

server.listen(config.port, '0.0.0.0', () => {
  console.log(`Server running on port ${config.port} [${process.env.NODE_ENV || 'development'}]`)
})

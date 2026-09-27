const http = require('node:http')
const express = require('express')
const { WebSocket, WebSocketServer } = require('ws')

const port = Number(process.env.PORT || 3000)
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'

const app = express()
const server = http.createServer(app)
const browserClients = new Set()
const webSocketServer = new WebSocketServer({ noServer: true })

let audioSource = null

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    audioSource: audioSource?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected',
    clients: browserClients.size,
  })
})

function originAllowed(request) {
  return allowedOrigin === '*' || request.headers.origin === allowedOrigin
}

function broadcastAudio(chunk) {
  for (const client of browserClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(chunk, { binary: true })
    }
  }
}

server.on('upgrade', (request, socket, head) => {
  if (!['/audio', '/source'].includes(request.url) ||
      (request.url === '/audio' && !originAllowed(request))) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    socket.destroy()
    return
  }

  webSocketServer.handleUpgrade(request, socket, head, (client) => {
    webSocketServer.emit('connection', client, request)
  })
})

webSocketServer.on('connection', (client, request) => {
  if (request.url === '/source') {
    audioSource?.close()
    audioSource = client
    console.log('C++ audio engine connected')

    client.on('message', (data, isBinary) => {
      if (isBinary || Buffer.isBuffer(data)) {
        broadcastAudio(data)
      }
    })

    client.on('close', () => {
      if (audioSource === client) {
        audioSource = null
      }
      console.log('C++ audio engine disconnected')
    })
    return
  }

  browserClients.add(client)
  console.log(`Browser audio client connected (${browserClients.size})`)

  client.on('close', () => {
    browserClients.delete(client)
    console.log(`Browser audio client disconnected (${browserClients.size})`)
  })

  client.on('error', () => {
    browserClients.delete(client)
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Audio relay listening on port ${port}`)
  console.log(`Browser WebSocket endpoint: ws://0.0.0.0:${port}/audio`)
  console.log(`Engine WebSocket endpoint: ws://0.0.0.0:${port}/source`)
})

function shutdown() {
  audioSource?.close()
  for (const client of browserClients) {
    client.close()
  }
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
import { useEffect, useRef, useState } from 'react'
import './App.css'

const websocketUrl = import.meta.env.VITE_AUDIO_RELAY_URL || 'ws://192.168.29.216:3000/audio'

function App() {
  const [status, setStatus] = useState('Idle')
  const [isConnected, setIsConnected] = useState(false)
  const [packets, setPackets] = useState(0)
  const [samples, setSamples] = useState(0)
  const socketRef = useRef(null)
  const audioContextRef = useRef(null)
  const nextStartTimeRef = useRef(0)
  const messageQueueRef = useRef(Promise.resolve())

  const playPcmChunk = async (data) => {
    const audioContext = audioContextRef.current
    if (!audioContext || data.byteLength < 2) {
      return
    }

    const view = new DataView(data)
    const sampleCount = Math.floor(data.byteLength / 2)
    const buffer = audioContext.createBuffer(1, sampleCount, 44100)
    const channel = buffer.getChannelData(0)

    for (let index = 0; index < sampleCount; index += 1) {
      channel[index] = view.getInt16(index * 2, true) / 32768
    }

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(audioContext.destination)

    const startTime = Math.max(audioContext.currentTime + 0.05, nextStartTimeRef.current)
    source.start(startTime)
    nextStartTimeRef.current = startTime + buffer.duration
    setPackets((value) => value + 1)
    setSamples((value) => value + sampleCount)
  }

  const connect = () => {
    if (socketRef.current) {
      return
    }

    const audioContext = new AudioContext({ sampleRate: 44100 })
    audioContext.resume()
    audioContextRef.current = audioContext
    const socket = new WebSocket(websocketUrl)
    socket.binaryType = 'arraybuffer'
    socketRef.current = socket
    setIsConnected(true)
    setStatus('Connecting')

    socket.onopen = () => setStatus('Connected, waiting for audio')
    socket.onmessage = (event) => {
      messageQueueRef.current = messageQueueRef.current
        .then(() => playPcmChunk(event.data))
        .catch(() => setStatus('Playback error'))
    }
    socket.onerror = () => setStatus('Connection error')
    socket.onclose = () => {
      socketRef.current = null
      setIsConnected(false)
      setStatus('Disconnected')
    }
  }

  const disconnect = () => {
    socketRef.current?.close()
    socketRef.current = null
    setIsConnected(false)
    audioContextRef.current?.close()
    audioContextRef.current = null
    nextStartTimeRef.current = 0
    setStatus('Disconnected')
  }

  useEffect(() => disconnect, [])

  return (
    <main className="receiver-shell">
      <header className="topbar">
        <span className="eyebrow">LOCAL AUDIO LINK</span>
        <span className={`status status-${status.toLowerCase().replaceAll(' ', '-')}`}>
          <span className="status-dot" />
          {status}
        </span>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <p className="kicker">PCM / 44.1 KHZ / MONO</p>
          <h1>Live room<br /><em>receiver</em></h1>
          <p className="lede">Listen to the PortAudio stream from this machine in real time.</p>
          <div className="controls">
            <button type="button" className="primary-button" onClick={connect} disabled={isConnected}>
              <span className="button-mark">↗</span> Connect stream
            </button>
            <button type="button" className="secondary-button" onClick={disconnect} disabled={!isConnected}>
              Disconnect
            </button>
          </div>
        </div>
        <div className="signal-art" aria-hidden="true">
          <div className="signal-ring ring-one" />
          <div className="signal-ring ring-two" />
          <div className="signal-ring ring-three" />
          <div className="signal-core"><span /></div>
          <span className="signal-label">LISTENING<br />LOCALHOST</span>
        </div>
      </section>

      <section className="metrics" aria-label="Stream metrics">
        <div><span>Endpoint</span><strong>{websocketUrl}</strong></div>
        <div><span>Packets received</span><strong>{packets.toLocaleString()}</strong></div>
        <div><span>Samples received</span><strong>{samples.toLocaleString()}</strong></div>
      </section>
    </main>
  )
}

export default App

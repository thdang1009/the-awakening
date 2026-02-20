// ---------------------------------------------------------------------------
// Streamer Mode — Twitch IRC chat integration
// Connects anonymously and dispatches viewer commands to the game.
// ---------------------------------------------------------------------------

export type StreamerCommand = 'spawn' | 'buff' | 'boss' | 'heal' | 'chaos'

export interface CommandEvent {
  username: string
  command: StreamerCommand
}

export type CommandHandler = (event: CommandEvent) => void

const KNOWN_COMMANDS: StreamerCommand[] = ['spawn', 'buff', 'boss', 'heal', 'chaos']

/** Per-command cooldown so a single viewer can't spam one command */
const CMD_COOLDOWN_MS = 15_000  // 15 seconds

export class StreamerMode {
  private ws: WebSocket | null = null
  private channel = ''
  private _connected = false

  /** Timestamp (Date.now()) of the last use of each command */
  private cmdLastUsed = new Map<string, number>()

  private _statusHandler?: (connected: boolean) => void

  /** Called for every valid, cooldown-cleared command */
  onCommand?: CommandHandler

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Open an anonymous Twitch IRC connection to the given channel */
  connect(channel: string): void {
    this.disconnect()
    this.channel = channel.toLowerCase().replace(/^#/, '')

    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443')
    this.ws = ws

    ws.onopen = () => {
      ws.send('PASS justinfan99999')
      ws.send('NICK justinfan99999')
      ws.send(`JOIN #${this.channel}`)
    }

    ws.onmessage = (e) => this.handleRaw(e.data as string)

    ws.onclose = () => {
      this._connected = false
      this._statusHandler?.(false)
    }

    ws.onerror = () => {
      this._connected = false
      this._statusHandler?.(false)
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.onclose = null   // prevent status callback re-entry
      this.ws.close()
      this.ws = null
    }
    this._connected = false
  }

  get isConnected(): boolean { return this._connected }

  /** Subscribe to connection status changes */
  onStatusChange(fn: (connected: boolean) => void): void {
    this._statusHandler = fn
  }

  /** Simulate a viewer command locally (bypasses cooldown — useful for testing) */
  simulate(cmd: StreamerCommand): void {
    this.dispatch({ username: 'TestViewer', command: cmd })
  }

  // -------------------------------------------------------------------------
  // Internal message handling
  // -------------------------------------------------------------------------

  private handleRaw(raw: string): void {
    for (const line of raw.split('\r\n')) {
      if (!line) continue

      // Keep-alive
      if (line.startsWith('PING')) {
        this.ws?.send('PONG :tmi.twitch.tv')
        continue
      }

      // Detect successful channel join
      if (line.includes(`JOIN #${this.channel}`)) {
        this._connected = true
        this._statusHandler?.(true)
        continue
      }

      // Parse standard chat message
      // :username!username@username.tmi.twitch.tv PRIVMSG #channel :text
      const match = line.match(/^:(\w+)!\w+@\w+\.tmi\.twitch\.tv PRIVMSG #\w+ :(.+)$/)
      if (!match) continue

      const username = match[1]
      const text     = match[2].trim().toLowerCase()

      const cmd = KNOWN_COMMANDS.find(c => text === `!${c}`)
      if (!cmd) continue

      // Per-command cooldown check
      const now  = Date.now()
      const last = this.cmdLastUsed.get(cmd) ?? 0
      if (now - last < CMD_COOLDOWN_MS) continue

      this.cmdLastUsed.set(cmd, now)
      this.dispatch({ username, command: cmd })
    }
  }

  /** Resolve !chaos → random real command, then fire onCommand */
  private dispatch(event: CommandEvent): void {
    if (event.command === 'chaos') {
      const pool: StreamerCommand[] = ['spawn', 'buff', 'boss', 'heal']
      const resolved = pool[Math.floor(Math.random() * pool.length)]
      this.onCommand?.({ username: event.username, command: resolved })
    } else {
      this.onCommand?.(event)
    }
  }
}

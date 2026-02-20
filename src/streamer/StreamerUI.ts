// ---------------------------------------------------------------------------
// Streamer UI
//   • DOM panel  — channel setup, test buttons, collapsed by default
//   • PixiJS feed — scrolling in-game notifications of viewer commands
// ---------------------------------------------------------------------------

import { Application, Container, Text, TextStyle } from 'pixi.js'
import type { StreamerMode, StreamerCommand, CommandEvent } from './StreamerMode'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants'

// ─── Visual mapping ──────────────────────────────────────────────────────────

const CMD_COLOR: Record<StreamerCommand, string> = {
  spawn: '#ff8822',
  buff:  '#22ffaa',
  boss:  '#ff3333',
  heal:  '#44ff88',
  chaos: '#cc44ff',
}

const CMD_DESC: Record<StreamerCommand, string> = {
  spawn: 'spawned a mini-wave!',
  buff:  'doubled fire rate! (10s)',
  boss:  'unleashed a BOSS!',
  heal:  'healed the Nexus!',
  chaos: 'triggered CHAOS!',
}

// ─── Feed entry ──────────────────────────────────────────────────────────────

interface FeedEntry {
  text: Text
  timer: number   // seconds until removed
}

// ─────────────────────────────────────────────────────────────────────────────

export class StreamerUI {
  private readonly mode: StreamerMode
  private readonly feedContainer: Container
  private readonly feedEntries: FeedEntry[] = []
  private readonly domPanel: HTMLDivElement

  private statusEl!: HTMLElement
  private channelInput!: HTMLInputElement
  private connectBtn!: HTMLButtonElement

  private _onCommand?: (evt: CommandEvent) => void

  constructor(app: Application, mode: StreamerMode) {
    this.mode = mode

    // PixiJS scrolling feed (bottom-right, always on top of game, below skill tree)
    this.feedContainer = new Container()
    this.feedContainer.x = CANVAS_WIDTH - 290
    this.feedContainer.y = CANVAS_HEIGHT - 220
    ;(this.feedContainer as unknown as { zIndex: number }).zIndex = 50
    app.stage.addChild(this.feedContainer)

    // DOM panel
    this.domPanel = this.buildDomPanel()
    document.body.appendChild(this.domPanel)

    // Wire mode callbacks
    mode.onCommand = (evt) => {
      this.addFeedEntry(evt)
      this._onCommand?.(evt)
    }

    mode.onStatusChange((connected) => this.updateStatus(connected))
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Set a callback that fires whenever a viewer command is received */
  onCommand(fn: (evt: CommandEvent) => void): void {
    this._onCommand = fn
  }

  /** Called every frame from Game update (even while paused) */
  animate(dt: number): void {
    for (let i = this.feedEntries.length - 1; i >= 0; i--) {
      const entry = this.feedEntries[i]
      entry.timer -= dt
      if (entry.timer <= 0) {
        this.feedContainer.removeChild(entry.text)
        this.feedEntries.splice(i, 1)
      } else if (entry.timer < 1) {
        entry.text.alpha = entry.timer   // fade out last second
      }
    }
    // Stack entries bottom-to-top
    for (let i = 0; i < this.feedEntries.length; i++) {
      this.feedEntries[i].text.y = (this.feedEntries.length - 1 - i) * 22
    }
  }

  destroy(): void {
    this.domPanel.remove()
  }

  // -------------------------------------------------------------------------
  // Feed
  // -------------------------------------------------------------------------

  private addFeedEntry(evt: CommandEvent): void {
    const color = CMD_COLOR[evt.command] ?? '#ffffff'
    const desc  = CMD_DESC[evt.command]  ?? evt.command
    const t = new Text(
      `${evt.username}: ${desc}`,
      new TextStyle({
        fill: color,
        fontSize: 13,
        fontFamily: 'monospace',
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowDistance: 1,
      }),
    )
    t.alpha = 1
    this.feedContainer.addChild(t)
    this.feedEntries.push({ text: t, timer: 5 })

    // Cap at 8 visible entries
    if (this.feedEntries.length > 8) {
      const oldest = this.feedEntries.shift()!
      this.feedContainer.removeChild(oldest.text)
    }
  }

  // -------------------------------------------------------------------------
  // DOM panel
  // -------------------------------------------------------------------------

  private updateStatus(connected: boolean): void {
    this.statusEl.textContent = connected
      ? `Connected to #${this.channelInput.value.trim()}`
      : 'Disconnected'
    this.statusEl.style.color  = connected ? '#44ff88' : '#ff6666'
    this.connectBtn.textContent = connected ? 'Disconnect' : 'Connect'
  }

  private buildDomPanel(): HTMLDivElement {
    const panel = document.createElement('div')
    panel.style.cssText = `
      position: fixed; bottom: 60px; right: 10px;
      background: rgba(8, 8, 28, 0.94);
      border: 1px solid #334466;
      border-radius: 8px;
      padding: 10px 12px;
      font-family: monospace;
      font-size: 12px;
      color: #aabbcc;
      min-width: 230px;
      z-index: 9999;
      user-select: none;
    `

    // ── Header row ──
    const headerRow = document.createElement('div')
    headerRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;'

    const titleEl = document.createElement('span')
    titleEl.style.cssText = 'font-weight: bold; color: #aaccff; font-size: 13px;'
    titleEl.textContent = 'Streamer Mode'

    const toggleBtn = document.createElement('button')
    toggleBtn.textContent = '▶'
    toggleBtn.title = 'Expand / collapse'
    toggleBtn.style.cssText = 'background: none; border: none; color: #8899cc; cursor: pointer; font-size: 11px; padding: 0 2px;'
    headerRow.append(titleEl, toggleBtn)
    panel.appendChild(headerRow)

    // ── Body (collapsed by default) ──
    const body = document.createElement('div')
    body.style.display = 'none'
    panel.appendChild(body)

    toggleBtn.addEventListener('click', () => {
      const open = body.style.display !== 'none'
      body.style.display = open ? 'none' : 'block'
      toggleBtn.textContent = open ? '▶' : '▼'
    })

    // Status
    this.statusEl = document.createElement('div')
    this.statusEl.style.cssText = 'margin-bottom: 8px; font-size: 11px; color: #ff6666;'
    this.statusEl.textContent = 'Disconnected'

    // Channel row
    const channelRow = document.createElement('div')
    channelRow.style.cssText = 'display: flex; gap: 5px; margin-bottom: 8px;'

    this.channelInput = document.createElement('input')
    this.channelInput.placeholder = 'channel name'
    this.channelInput.style.cssText = `
      flex: 1; background: #0a0a1e; border: 1px solid #334466;
      color: #fff; padding: 3px 6px; border-radius: 4px;
      font-family: monospace; font-size: 11px;
    `

    this.connectBtn = document.createElement('button')
    this.connectBtn.textContent = 'Connect'
    this.connectBtn.style.cssText = `
      background: #1a2244; border: 1px solid #3355aa; color: #aaccff;
      padding: 3px 8px; border-radius: 4px; cursor: pointer;
      font-family: monospace; font-size: 11px;
    `
    this.connectBtn.addEventListener('click', () => {
      if (this.mode.isConnected) {
        this.mode.disconnect()
        this.updateStatus(false)
      } else {
        const ch = this.channelInput.value.trim()
        if (ch) this.mode.connect(ch)
      }
    })

    channelRow.append(this.channelInput, this.connectBtn)

    // Test buttons
    const testLabel = document.createElement('div')
    testLabel.style.cssText = 'color: #556677; font-size: 10px; margin-bottom: 4px;'
    testLabel.textContent = 'TEST (local):'

    const testRow = document.createElement('div')
    testRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 8px;'

    const cmds: StreamerCommand[] = ['spawn', 'buff', 'boss', 'heal', 'chaos']
    for (const cmd of cmds) {
      const btn = document.createElement('button')
      btn.textContent = `!${cmd}`
      btn.style.cssText = `
        background: #0d0d22; border: 1px solid #334466;
        color: ${CMD_COLOR[cmd]};
        padding: 2px 7px; border-radius: 3px; cursor: pointer;
        font-family: monospace; font-size: 10px;
      `
      btn.addEventListener('click', () => this.mode.simulate(cmd))
      testRow.appendChild(btn)
    }

    // Help text
    const help = document.createElement('div')
    help.style.cssText = 'font-size: 10px; color: #445566; line-height: 1.6;'
    help.innerHTML = `
      !spawn — extra enemies now<br>
      !buff  — 2× fire rate (10 s)<br>
      !boss  — unleash a boss<br>
      !heal  — restore 30% HP<br>
      !chaos — random effect<br>
      <span style="color:#334455">(15 s cooldown per command)</span>
    `

    body.append(this.statusEl, channelRow, testLabel, testRow, help)

    return panel
  }
}

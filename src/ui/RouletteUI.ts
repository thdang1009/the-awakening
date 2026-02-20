// ---------------------------------------------------------------------------
// RouletteUI — Golden Chest slot-machine overlay (Phase 3)
// ---------------------------------------------------------------------------
// Single reel spins and slows to a stop, revealing 1 Passive Catalyst
// (List 4) reward.  Auto-collects after a pause so the player can read it.
// ---------------------------------------------------------------------------

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { Application } from 'pixi.js'
import { GameWorld } from '../ecs/world'
import { COLLECTIBLES, type Collectible } from './LevelUpUI'

// ---------------------------------------------------------------------------
// Timing & layout
// ---------------------------------------------------------------------------
const STOP_TIME     = 3.2    // reel stops at this elapsed time (seconds)
const COLLECT_DELAY = 5.5    // auto-collect after this total elapsed
const CYCLE_RATE    = 8      // items cycled per second at full spin speed
const CYCLE_SLOW    = 3      // reduced cycle rate during wind-down phase
const SLOW_START    = 2.0    // when the reel starts slowing down

const REEL_W   = 360
const REEL_H   = 200
const ORIGIN_X = (1280 - REEL_W) / 2
const ORIGIN_Y = (720  - REEL_H) / 2 + 20

// ---------------------------------------------------------------------------

interface ReelState {
  cyclePos:  number     // fractional index into COLLECTIBLES for display
  stopped:   boolean
  target:    Collectible
}

export class RouletteUI {
  private readonly container: Container
  private isOpen = false

  // live state
  private reel:     ReelState | null = null
  private elapsed   = 0
  private winner:   Collectible | null = null
  private collected = false
  private onDone:   (() => void) | null = null
  private world:    GameWorld | null = null

  // pixi objects updated each animate() tick
  private reelBg!:      Graphics
  private reelNameTxt!: Text
  private resultBanner!: Text
  private flashTimer  = 0
  private countdownTxt!: Text

  constructor(app: Application) {
    this.container = new Container()
    this.container.visible = false
    app.stage.addChild(this.container)
  }

  get visible(): boolean { return this.isOpen }

  show(world: GameWorld, onDone: () => void): void {
    this.world     = world
    this.onDone    = onDone
    this.isOpen    = true
    this.elapsed   = 0
    this.collected = false
    this.flashTimer = 0
    this.container.visible = true
    this.container.removeChildren()

    // Winner is always from List 4: Passive Catalysts
    const catalysts = COLLECTIBLES.filter(it => it.category === 'catalyst')
    const pool      = catalysts.length > 0 ? catalysts : COLLECTIBLES
    this.winner     = pool[Math.floor(Math.random() * pool.length)]

    this.reel = {
      cyclePos: Math.random() * COLLECTIBLES.length,
      stopped:  false,
      target:   this.winner,
    }

    this.buildLayout()
  }

  // ---------------------------------------------------------------------------
  // Build static chrome
  // ---------------------------------------------------------------------------

  private buildLayout(): void {
    // Dark backdrop
    const overlay = new Graphics()
    overlay.beginFill(0x000000, 0.80)
    overlay.drawRect(0, 0, 1280, 720)
    overlay.endFill()
    this.container.addChild(overlay)

    // Decorative outer panel
    const panelW = REEL_W + 80
    const panelH = REEL_H + 200
    const panelX = (1280 - panelW) / 2
    const panelY = ORIGIN_Y - 90
    const panel  = new Graphics()
    panel.lineStyle(3, 0xffd700, 1)
    panel.beginFill(0x08091a, 0.97)
    panel.drawRoundedRect(panelX, panelY, panelW, panelH, 18)
    panel.endFill()
    this.container.addChild(panel)

    // Corner stars
    const corners: [number, number][] = [
      [panelX + 18, panelY + 18],
      [panelX + panelW - 18, panelY + 18],
      [panelX + 18, panelY + panelH - 18],
      [panelX + panelW - 18, panelY + panelH - 18],
    ]
    for (const [sx, sy] of corners) {
      const star = new Text('★', new TextStyle({ fill: '#ffd700', fontSize: 20 }))
      star.anchor.set(0.5)
      star.x = sx; star.y = sy
      this.container.addChild(star)
    }

    // Header
    const header = new Text('✦  GOLDEN CHEST  ✦', new TextStyle({
      fill: '#ffd700', fontSize: 30, fontFamily: 'monospace', fontWeight: 'bold',
      dropShadow: true, dropShadowColor: '#ff8800', dropShadowDistance: 4,
    }))
    header.anchor.set(0.5, 0)
    header.x = 640; header.y = panelY + 20
    this.container.addChild(header)

    const sub = new Text('— Passive Catalyst —', new TextStyle({
      fill: '#aa7700', fontSize: 14, fontFamily: 'monospace',
    }))
    sub.anchor.set(0.5, 0); sub.x = 640; sub.y = panelY + 58
    this.container.addChild(sub)

    // Reel divider line
    const line = new Graphics()
    line.lineStyle(1, 0x334466, 0.6)
    line.moveTo(panelX + 20, ORIGIN_Y - 14)
    line.lineTo(panelX + panelW - 20, ORIGIN_Y - 14)
    this.container.addChild(line)

    // Reel card (mutable each tick)
    const reelCard = new Container()
    reelCard.x = ORIGIN_X
    reelCard.y = ORIGIN_Y
    this.container.addChild(reelCard)

    this.reelBg = new Graphics()
    reelCard.addChild(this.reelBg)

    // Category badge
    const catBadge = new Text('● PASSIVE CATALYST', new TextStyle({
      fill: '#00ccff', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    catBadge.x = 14; catBadge.y = 14
    reelCard.addChild(catBadge)

    this.reelNameTxt = new Text('', new TextStyle({
      fill: '#ffffff', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
      wordWrap: true, wordWrapWidth: REEL_W - 28, align: 'center',
    }))
    this.reelNameTxt.anchor.set(0.5)
    this.reelNameTxt.x = REEL_W / 2; this.reelNameTxt.y = REEL_H / 2 + 10
    reelCard.addChild(this.reelNameTxt)

    // Result banner (hidden until reel stops)
    this.resultBanner = new Text('', new TextStyle({
      fill: '#ffd700', fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
      dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 3,
    }))
    this.resultBanner.anchor.set(0.5, 0)
    this.resultBanner.x = 640
    this.resultBanner.y = panelY + panelH - 72
    this.container.addChild(this.resultBanner)

    // Countdown hint
    this.countdownTxt = new Text('', new TextStyle({
      fill: '#556677', fontSize: 12, fontFamily: 'monospace',
    }))
    this.countdownTxt.anchor.set(0.5, 0)
    this.countdownTxt.x = 640
    this.countdownTxt.y = panelY + panelH - 40
    this.container.addChild(this.countdownTxt)
  }

  // ---------------------------------------------------------------------------
  // Per-frame update — called even while game is paused
  // ---------------------------------------------------------------------------

  animate(dt: number): void {
    if (!this.isOpen || !this.reel) return
    this.elapsed += dt

    const reel = this.reel

    // Spin / wind-down logic
    if (!reel.stopped) {
      // Interpolate from full speed down to slow speed as we approach STOP_TIME
      const slowFrac = Math.max(0, Math.min(1, (this.elapsed - SLOW_START) / (STOP_TIME - SLOW_START)))
      const rate     = CYCLE_RATE * (1 - slowFrac) + CYCLE_SLOW * slowFrac
      reel.cyclePos += rate * dt

      if (this.elapsed >= STOP_TIME) {
        reel.stopped  = true
        reel.cyclePos = Math.round(reel.cyclePos) // snap to integer
      }
    }

    // Which item to display
    const item = reel.stopped
      ? reel.target
      : COLLECTIBLES[Math.floor(reel.cyclePos) % COLLECTIBLES.length]

    // Redraw reel card background
    const borderColor = reel.stopped ? item.color : 0x334466
    const borderAlpha = reel.stopped ? 1.0 : 0.5
    this.reelBg.clear()
    this.reelBg.lineStyle(3, borderColor, borderAlpha)
    this.reelBg.beginFill(reel.stopped ? 0x0d1526 : 0x090e1a, 0.97)
    this.reelBg.drawRoundedRect(0, 0, REEL_W, REEL_H, 14)
    this.reelBg.endFill()

    if (!reel.stopped) {
      // Spinning shimmer effect
      const flash = Math.sin(this.elapsed * 25) * 0.5 + 0.5
      this.reelBg.lineStyle(1, 0x667799, flash * 0.35)
      this.reelBg.drawRoundedRect(5, 5, REEL_W - 10, REEL_H - 10, 11)
    } else {
      // Glow ring
      this.reelBg.lineStyle(2, item.color, 0.4)
      this.reelBg.drawRoundedRect(5, 5, REEL_W - 10, REEL_H - 10, 11)
    }

    this.reelNameTxt.text            = item.name
    this.reelNameTxt.style.fill      = reel.stopped ? '#ffffff' : '#778899'
    this.reelNameTxt.style.fontSize  = reel.stopped ? 22 : 18

    // Pulse glow on winner reel after it stops
    if (reel.stopped) {
      this.flashTimer += dt
      const pulse = Math.sin(this.flashTimer * 7) * 0.5 + 0.5
      this.reelBg.alpha = 0.75 + pulse * 0.25
    }

    // Show result banner shortly after stop
    if (this.elapsed > STOP_TIME + 0.4 && this.winner) {
      this.resultBanner.text = `YOU GOT:  ${this.winner.name}!`
    }

    // Countdown to auto-collect
    if (this.elapsed > STOP_TIME + 0.5) {
      const remaining = Math.max(0, COLLECT_DELAY - this.elapsed)
      this.countdownTxt.text = remaining > 0
        ? `auto-collecting in ${remaining.toFixed(1)}s…`
        : ''
    }

    // Auto-collect
    if (!this.collected && this.elapsed >= COLLECT_DELAY && this.winner && this.world) {
      this.collected = true
      this.winner.apply(this.world)
      this.close()
    }
  }

  // ---------------------------------------------------------------------------

  private close(): void {
    this.isOpen = false
    this.container.visible = false
    this.reel   = null
    this.winner = null
    this.onDone?.()
    this.onDone = null
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

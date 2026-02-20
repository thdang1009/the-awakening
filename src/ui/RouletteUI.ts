// ---------------------------------------------------------------------------
// RouletteUI — Golden Chest slot-machine overlay (Phase 3)
// ---------------------------------------------------------------------------
// 3 reels spin and stop one by one.  The middle reel (index 1) determines
// the actual reward.  After all 3 stop the reward is auto-collected with a
// flash, then the overlay closes and the callback fires.
// ---------------------------------------------------------------------------

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { Application } from 'pixi.js'
import { GameWorld } from '../ecs/world'
import { COLLECTIBLES, type Collectible } from './LevelUpUI'

// Reel stop times (seconds)
const STOP_TIMES = [1.3, 2.1, 2.9]
const COLLECT_DELAY = 3.5   // auto-collect after this total elapsed
const CYCLE_RATE    = 9     // items cycled per second while spinning

const REEL_W = 220
const REEL_H = 130
const REEL_GAP = 24
const TOTAL_W = REEL_W * 3 + REEL_GAP * 2
const ORIGIN_X = (1280 - TOTAL_W) / 2
const ORIGIN_Y = (720  - REEL_H)  / 2 + 30

// ---------------------------------------------------------------------------

interface ReelState {
  elapsed:   number
  cyclePos:  number     // fractional index into ITEMS for cycling display
  stopped:   boolean
  target:    Collectible
}

export class RouletteUI {
  private readonly container: Container
  private isOpen = false

  // live state
  private reels:    ReelState[] = []
  private elapsed   = 0
  private winner:   Collectible | null = null
  private collected = false
  private onDone:   (() => void) | null = null
  private world:    GameWorld | null = null

  // pixi objects updated each animate() tick
  private reelCards: Container[] = []
  private reelNameTexts: Text[]  = []
  private reelBgs:   Graphics[]  = []
  private resultBanner!: Text
  private flashTimer = 0

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

    // Pick winner from catalyst pool (more thematic for chest drops)
    const catalysts = COLLECTIBLES.filter(it => it.category === 'catalyst')
    const pool      = catalysts.length > 0 ? catalysts : COLLECTIBLES
    this.winner     = pool[Math.floor(Math.random() * pool.length)]

    // Build 3 reels with the winner locked to reel index 1 (middle)
    this.reels = STOP_TIMES.map((_, i) => ({
      elapsed:  0,
      cyclePos: Math.random() * COLLECTIBLES.length,
      stopped:  false,
      target:   i === 1 ? this.winner! : pool[Math.floor(Math.random() * pool.length)],
    }))

    this.buildLayout()
  }

  private buildLayout(): void {
    // Dark backdrop
    const overlay = new Graphics()
    overlay.beginFill(0x000000, 0.80)
    overlay.drawRect(0, 0, 1280, 720)
    overlay.endFill()
    this.container.addChild(overlay)

    // Decorative outer panel
    const panelW = TOTAL_W + 60
    const panelH = REEL_H  + 160
    const panelX = (1280 - panelW) / 2
    const panelY = ORIGIN_Y - 80
    const panel  = new Graphics()
    panel.lineStyle(3, 0xffd700, 1)
    panel.beginFill(0x08091a, 0.96)
    panel.drawRoundedRect(panelX, panelY, panelW, panelH, 16)
    panel.endFill()
    this.container.addChild(panel)

    // Corner stars
    for (const [sx, sy] of [[panelX + 16, panelY + 16], [panelX + panelW - 16, panelY + 16],
                             [panelX + 16, panelY + panelH - 16], [panelX + panelW - 16, panelY + panelH - 16]]) {
      const star = new Text('★', new TextStyle({ fill: '#ffd700', fontSize: 18 }))
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
    header.x = 640; header.y = panelY + 18
    this.container.addChild(header)

    const sub = new Text('— SPIN —', new TextStyle({
      fill: '#aa7700', fontSize: 14, fontFamily: 'monospace',
    }))
    sub.anchor.set(0.5, 0); sub.x = 640; sub.y = panelY + 54
    this.container.addChild(sub)

    // Reel divider line
    const line = new Graphics()
    line.lineStyle(1, 0x334466, 0.6)
    line.moveTo(panelX + 20, ORIGIN_Y - 12)
    line.lineTo(panelX + panelW - 20, ORIGIN_Y - 12)
    this.container.addChild(line)

    // 3 reel cards
    this.reelCards     = []
    this.reelNameTexts = []
    this.reelBgs       = []

    for (let i = 0; i < 3; i++) {
      const card = new Container()
      card.x = ORIGIN_X + i * (REEL_W + REEL_GAP)
      card.y = ORIGIN_Y
      this.container.addChild(card)
      this.reelCards.push(card)

      const bg = new Graphics()
      card.addChild(bg)
      this.reelBgs.push(bg)

      const nameTxt = new Text('', new TextStyle({
        fill: '#ffffff', fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
        wordWrap: true, wordWrapWidth: REEL_W - 20, align: 'center',
      }))
      nameTxt.anchor.set(0.5)
      nameTxt.x = REEL_W / 2; nameTxt.y = REEL_H / 2
      card.addChild(nameTxt)
      this.reelNameTexts.push(nameTxt)
    }

    // Result banner (hidden until collected)
    this.resultBanner = new Text('', new TextStyle({
      fill: '#ffd700', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
      dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 3,
    }))
    this.resultBanner.anchor.set(0.5, 0)
    this.resultBanner.x = 640
    this.resultBanner.y = panelY + panelH - 52
    this.container.addChild(this.resultBanner)
  }

  /** Called every frame from Game.ts — runs even while game is paused */
  animate(dt: number): void {
    if (!this.isOpen || this.reels.length === 0) return
    this.elapsed += dt

    // Animate each reel
    for (let i = 0; i < 3; i++) {
      const reel = this.reels[i]
      const bg   = this.reelBgs[i]
      const txt  = this.reelNameTexts[i]
      const stopAt = STOP_TIMES[i]

      if (!reel.stopped) {
        reel.cyclePos += CYCLE_RATE * dt
        if (this.elapsed >= stopAt) {
          reel.stopped  = true
          reel.cyclePos = Math.floor(reel.cyclePos) // snap to integer
        }
      }

      const item = reel.stopped
        ? reel.target
        : COLLECTIBLES[Math.floor(reel.cyclePos) % COLLECTIBLES.length]

      // Draw reel card
      const borderColor = reel.stopped ? item.color : 0x334466
      const borderAlpha = reel.stopped ? 1.0 : 0.5
      bg.clear()
      bg.lineStyle(2, borderColor, borderAlpha)
      bg.beginFill(reel.stopped ? 0x0d1526 : 0x090e1a, 0.95)
      bg.drawRoundedRect(0, 0, REEL_W, REEL_H, 10)
      bg.endFill()

      // Spinning flash effect
      if (!reel.stopped) {
        const flash = Math.sin(this.elapsed * 30) * 0.5 + 0.5
        bg.lineStyle(1, 0x667799, flash * 0.3)
        bg.drawRoundedRect(4, 4, REEL_W - 8, REEL_H - 8, 8)
      } else {
        // Glow ring for stopped reel
        bg.lineStyle(1, item.color, 0.35)
        bg.drawRoundedRect(4, 4, REEL_W - 8, REEL_H - 8, 8)
      }

      txt.text  = item.name
      txt.style.fill = reel.stopped ? '#ffffff' : '#778899'
    }

    // Flash winner reel after stop
    if (this.elapsed > STOP_TIMES[2]) {
      this.flashTimer += dt
      const pulse = Math.sin(this.flashTimer * 8) * 0.5 + 0.5
      this.reelBgs[1].alpha = 0.7 + pulse * 0.3
    }

    // Result banner
    if (this.elapsed > STOP_TIMES[2] + 0.3 && this.winner) {
      this.resultBanner.text = `YOU GOT: ${this.winner.name}!`
    }

    // Auto-collect
    if (!this.collected && this.elapsed >= COLLECT_DELAY && this.winner && this.world) {
      this.collected = true
      this.winner.apply(this.world)
      this.close()
    }
  }

  private close(): void {
    this.isOpen = false
    this.container.visible = false
    this.reels = []
    this.winner = null
    this.onDone?.()
    this.onDone = null
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

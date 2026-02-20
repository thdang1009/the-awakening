// ---------------------------------------------------------------------------
// Skill Tree UI — full-screen PixiJS overlay
// Pan (drag), Zoom (wheel), interactive node circles, tooltip
// ---------------------------------------------------------------------------

import {
  Application, Container, Graphics, Text, TextStyle, Rectangle,
} from 'pixi.js'
import type { SkillNode } from './types'
import { SkillTreeStore } from './SkillTreeStore'
import { encodeBuild, decodeBuild } from '../buildcode/BuildCode'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants'

// Branch colour palette
const BRANCH_COLOR: Record<string, number> = {
  start:        0xffffff,
  rapidFire:    0xff8822,
  heavyStrike:  0xff2244,
  bulwark:      0x2255ff,
  warp:         0x22ddff,
  chain:        0xaa22ff,
  collector:    0xffcc22,
  junction:     0x44ffaa,
}

const COLOR_ACTIVE      = 0xffffff   // white ring  — active
const COLOR_AVAILABLE   = 0xffee44   // yellow ring — adjacent + affordable
const COLOR_REACHABLE   = 0xff9922   // orange ring — adjacent but too expensive
const COLOR_LOCKED      = 0x444466   // muted grey  — no adjacent active node

// Node visual radii by tier
const TIER_RADIUS: Record<string, number> = {
  start:    28,
  small:    13,
  notable:  19,
  keystone: 25,
}

export class SkillTreeUI {
  private readonly app: Application
  private readonly overlay: Container
  private readonly viewport: Container
  private readonly connectionsGfx: Graphics
  private readonly nodesLayer: Container
  private readonly tooltip: Container
  private readonly spText: Text
  private readonly treeBtn: Container   // reference kept by Game for positioning

  private _isOpen = false
  private pulseTimer = 0

  // Pan state
  private isPanning = false
  private panStart = { x: 0, y: 0 }
  private vpStart  = { x: 0, y: 0 }

  // Node Graphics map for quick refresh
  private nodeGfxMap = new Map<string, Graphics>()

  constructor(app: Application, treeBtn: Container) {
    this.app = app
    this.treeBtn = treeBtn

    // -----------------------------------------------------------------------
    // Overlay root
    // -----------------------------------------------------------------------
    this.overlay = new Container()
    this.overlay.visible = false
    this.overlay.zIndex = 100
    app.stage.addChild(this.overlay)

    // Semi-transparent dark background (interactive — captures pan drags)
    const bg = new Graphics()
    bg.beginFill(0x000000, 0.88)
    bg.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    bg.endFill()
    bg.interactive = true
    bg.hitArea = new Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    this.overlay.addChild(bg)

    this.attachPanHandlers(bg)

    // -----------------------------------------------------------------------
    // Zoomable / pannable viewport
    // -----------------------------------------------------------------------
    this.viewport = new Container()
    this.viewport.x = CANVAS_WIDTH / 2
    this.viewport.y = CANVAS_HEIGHT / 2
    this.viewport.scale.set(0.72)
    this.overlay.addChild(this.viewport)

    this.connectionsGfx = new Graphics()
    this.viewport.addChild(this.connectionsGfx)

    this.nodesLayer = new Container()
    this.viewport.addChild(this.nodesLayer)

    // -----------------------------------------------------------------------
    // Header bar
    // -----------------------------------------------------------------------
    const header = new Container()
    this.overlay.addChild(header)

    const headerBg = new Graphics()
    headerBg.beginFill(0x0a0a1a, 0.95)
    headerBg.drawRect(0, 0, CANVAS_WIDTH, 48)
    headerBg.endFill()
    header.addChild(headerBg)

    const titleText = new Text('SKILL TREE', new TextStyle({
      fill: '#aaccff', fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    titleText.x = 20
    titleText.y = 12
    header.addChild(titleText)

    this.spText = new Text('SP: 0', new TextStyle({
      fill: '#ffee44', fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    this.spText.x = CANVAS_WIDTH / 2 - 40
    this.spText.y = 12
    header.addChild(this.spText)

    const closeText = new Text('[X] Close  (Tab)', new TextStyle({
      fill: '#888888', fontSize: 18, fontFamily: 'monospace',
    }))
    closeText.x = CANVAS_WIDTH - 200
    closeText.y = 14
    const closeBtnGfx = new Graphics()
    closeBtnGfx.interactive = true
    closeBtnGfx.cursor = 'pointer'
    closeBtnGfx.hitArea = new Rectangle(CANVAS_WIDTH - 210, 0, 210, 48)
    closeBtnGfx.on('pointertap', () => this.close())
    header.addChild(closeBtnGfx)
    header.addChild(closeText)

    // -----------------------------------------------------------------------
    // Build Code panel (bottom-right, next to legend)
    // -----------------------------------------------------------------------
    const codePanel = this.buildCodePanel()
    this.overlay.addChild(codePanel)

    // -----------------------------------------------------------------------
    // Legend (bottom-left)
    // -----------------------------------------------------------------------
    const legendY = CANVAS_HEIGHT - 120
    const legend = this.buildLegend(legendY)
    this.overlay.addChild(legend)

    // -----------------------------------------------------------------------
    // Tooltip (positioned dynamically near hovered node)
    // -----------------------------------------------------------------------
    this.tooltip = new Container()
    this.tooltip.visible = false
    this.overlay.addChild(this.tooltip)

    // -----------------------------------------------------------------------
    // Wheel zoom
    // -----------------------------------------------------------------------
    ;(app.view as HTMLCanvasElement).addEventListener('wheel', (e) => {
      if (!this._isOpen) return
      e.preventDefault()
      const factor   = e.deltaY < 0 ? 1.12 : 0.893
      const newScale = Math.max(0.22, Math.min(2.8, this.viewport.scale.x * factor))
      const canvas   = app.view as HTMLCanvasElement
      const rect     = canvas.getBoundingClientRect()
      const mx       = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width)
      const my       = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height)
      const wx = (mx - this.viewport.x) / this.viewport.scale.x
      const wy = (my - this.viewport.y) / this.viewport.scale.y
      this.viewport.scale.set(newScale)
      this.viewport.x = mx - wx * newScale
      this.viewport.y = my - wy * newScale
    }, { passive: false })

    // Subscribe to store changes (node activated → refresh)
    SkillTreeStore.onChange(() => {
      if (this._isOpen) this.redraw()
      this.refreshSP()
    })
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get isOpen(): boolean { return this._isOpen }

  open(): void {
    this._isOpen = true
    this.overlay.visible = true
    this.rebuildNodes()
    this.redraw()
    this.refreshSP()
  }

  close(): void {
    this._isOpen = false
    this.overlay.visible = false
    this.tooltip.visible = false
  }

  toggle(): void {
    this._isOpen ? this.close() : this.open()
  }

  /** Called from Game.ts update loop (even when paused) */
  animate(dt: number): void {
    if (!this._isOpen) return
    this.pulseTimer += dt
    const pulse = 0.5 + 0.5 * Math.sin(this.pulseTimer * 4)
    for (const node of SkillTreeStore.allNodes) {
      const gfx = this.nodeGfxMap.get(node.id)
      if (!gfx) continue
      if (SkillTreeStore.canActivate(node.id)) {
        // Affordable: bright yellow pulse
        gfx.alpha = 0.75 + pulse * 0.25
      } else if (SkillTreeStore.isReachable(node.id)) {
        // Reachable but unaffordable: slow dim orange pulse
        gfx.alpha = 0.45 + pulse * 0.20
      }
    }
  }

  refreshSP(): void {
    this.spText.text = `SP: ${SkillTreeStore.skillPoints}`
  }

  // ---------------------------------------------------------------------------
  // Build / Redraw
  // ---------------------------------------------------------------------------

  /** Rebuild node Graphics objects (call when overlay opens or after restart) */
  private rebuildNodes(): void {
    this.nodesLayer.removeChildren()
    this.nodeGfxMap.clear()

    for (const node of SkillTreeStore.allNodes) {
      const gfx = this.buildNodeGfx(node)
      this.nodesLayer.addChild(gfx)
      this.nodeGfxMap.set(node.id, gfx)
    }
  }

  /** Redraw connections + refresh node visuals based on current store state */
  private redraw(): void {
    this.drawConnections()
    for (const node of SkillTreeStore.allNodes) {
      const gfx = this.nodeGfxMap.get(node.id)
      if (!gfx) continue
      this.drawNode(gfx, node)
    }
  }

  // ---------------------------------------------------------------------------
  // Connection lines
  // ---------------------------------------------------------------------------

  private drawConnections(): void {
    this.connectionsGfx.clear()
    const drawn = new Set<string>()

    for (const node of SkillTreeStore.allNodes) {
      for (const connId of node.connections) {
        const key = [node.id, connId].sort().join('|')
        if (drawn.has(key)) continue
        drawn.add(key)

        const target = SkillTreeStore.allNodes.find(n => n.id === connId)
        if (!target) continue

        const bothActive = SkillTreeStore.isActive(node.id) && SkillTreeStore.isActive(connId)
        const eitherActive = SkillTreeStore.isActive(node.id) || SkillTreeStore.isActive(connId)
        const alpha = bothActive ? 0.9 : eitherActive ? 0.5 : 0.18
        const color = bothActive
          ? BRANCH_COLOR[node.branch] ?? 0x8888aa
          : 0x4455aa

        this.connectionsGfx.lineStyle(bothActive ? 3 : 1.5, color, alpha)
        this.connectionsGfx.moveTo(node.x, node.y)
        this.connectionsGfx.lineTo(target.x, target.y)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Node graphics
  // ---------------------------------------------------------------------------

  private buildNodeGfx(node: SkillNode): Graphics {
    const gfx = new Graphics()
    gfx.x = node.x
    gfx.y = node.y
    gfx.interactive = true
    gfx.cursor = 'pointer'

    this.drawNode(gfx, node)

    gfx.on('pointerover', () => this.showTooltip(node, gfx))
    gfx.on('pointerout',  () => { this.tooltip.visible = false })
    gfx.on('pointertap',  () => {
      if (SkillTreeStore.activate(node.id)) {
        // store notifies → redraw called automatically
      }
    })

    return gfx
  }

  private drawNode(gfx: Graphics, node: SkillNode): void {
    gfx.clear()
    const r         = TIER_RADIUS[node.tier] ?? 13
    const color     = BRANCH_COLOR[node.branch] ?? 0xaaaaaa
    const active    = SkillTreeStore.isActive(node.id)
    const avail     = SkillTreeStore.canActivate(node.id)
    const reachable = SkillTreeStore.isReachable(node.id)   // adjacent but too expensive

    if (active) {
      // Glow halo (notable + keystone only)
      if (node.tier === 'notable' || node.tier === 'keystone') {
        gfx.beginFill(color, 0.18)
        gfx.drawCircle(0, 0, r + 10)
        gfx.endFill()
      }
      gfx.beginFill(color, 1.0)
      gfx.drawCircle(0, 0, r)
      gfx.endFill()
      gfx.lineStyle(2, COLOR_ACTIVE, 1)
      gfx.drawCircle(0, 0, r + 3)

    } else if (avail) {
      // Affordable — tinted fill, pulsing yellow border
      gfx.beginFill(color, 0.45)
      gfx.drawCircle(0, 0, r)
      gfx.endFill()
      gfx.lineStyle(2.5, COLOR_AVAILABLE, 0.9)
      gfx.drawCircle(0, 0, r + 2)

    } else if (reachable) {
      // Can see it but can't afford yet — dim fill, orange dashed-looking border
      gfx.beginFill(color, 0.22)
      gfx.drawCircle(0, 0, r)
      gfx.endFill()
      gfx.lineStyle(1.5, COLOR_REACHABLE, 0.75)
      gfx.drawCircle(0, 0, r + 2)

    } else {
      // Truly locked — dark grey, no path to here yet
      gfx.beginFill(COLOR_LOCKED, 0.6)
      gfx.drawCircle(0, 0, r)
      gfx.endFill()
      if (node.tier === 'keystone') {
        gfx.lineStyle(1.5, 0x333355, 0.5)
        gfx.drawCircle(0, 0, r + 2)
      }
    }

    gfx.alpha = 1.0
  }

  // ---------------------------------------------------------------------------
  // Tooltip
  // ---------------------------------------------------------------------------

  /** Break a string into lines no longer than maxChars, splitting at word boundaries */
  private static wordWrap(text: string, maxChars: number): string[] {
    const words = text.split(' ')
    const result: string[] = []
    let current = ''
    for (const word of words) {
      if (current.length === 0) {
        current = word
      } else if (current.length + 1 + word.length <= maxChars) {
        current += ' ' + word
      } else {
        result.push(current)
        current = word
      }
    }
    if (current) result.push(current)
    return result
  }

  private showTooltip(node: SkillNode, nodeGfx: Graphics): void {
    const active = SkillTreeStore.isActive(node.id)
    const avail  = SkillTreeStore.canActivate(node.id)

    // Build text lines — description is word-wrapped at 34 chars
    const lines: string[] = [node.label]
    for (const l of SkillTreeUI.wordWrap(node.description, 34)) lines.push(l)
    lines.push('')
    if (node.effects.length > 0) {
      for (const e of node.effects) {
        lines.push(SkillTreeStore.describeEffect(e.stat, e.value))
      }
    }
    if (node.behaviors && node.behaviors.length > 0) {
      lines.push('')
      lines.push('Grants:')
      for (const b of node.behaviors) {
        lines.push(`  [${b.replace(/_/g, ' ')}]`)
      }
    }
    lines.push('')
    if (active) {
      lines.push('[ ALLOCATED ]')
    } else if (avail) {
      lines.push(`Cost: ${node.cost} SP  — Click to allocate`)
    } else if (SkillTreeStore.isReachable(node.id)) {
      const need = node.cost - SkillTreeStore.skillPoints
      lines.push(`Cost: ${node.cost} SP  — need ${need} more SP`)
    } else {
      lines.push(`Cost: ${node.cost} SP  — unlock a connected node first`)
    }

    // Clear and rebuild tooltip container
    this.tooltip.removeChildren()

    const pad = 10
    const textObjs: Text[] = lines.map((line, i) => {
      const isBold     = i === 0
      const isTag      = line.startsWith('[') || line.startsWith('Cost:')
      const isBehavior = line.startsWith('  [')
      const isGrants   = line === 'Grants:'
      const isInfo     = line.startsWith('+') || line.startsWith('×') || line.startsWith('−')
      const color = isBold     ? '#ffffff'
                  : isBehavior ? '#ffaa44'
                  : isGrants   ? '#cc8833'
                  : isTag      ? '#ffee44'
                  : isInfo     ? '#aaffaa'
                  :              '#aaaacc'
      const t = new Text(line, new TextStyle({
        fill: color,
        fontSize: isBold ? 16 : 13,
        fontFamily: 'monospace',
        fontWeight: isBold ? 'bold' : 'normal',
      }))
      t.x = pad
      t.y = pad + i * 18
      return t
    })

    const tipW = Math.max(...textObjs.map(t => t.width)) + pad * 2
    const tipH = pad * 2 + lines.length * 18

    const bg = new Graphics()
    bg.beginFill(0x0a0a1e, 0.95)
    bg.lineStyle(1, 0x3355aa, 0.9)
    bg.drawRoundedRect(0, 0, tipW, tipH, 6)
    bg.endFill()
    this.tooltip.addChild(bg)
    for (const t of textObjs) this.tooltip.addChild(t)

    // Position near node in screen space
    const sx = this.viewport.x + nodeGfx.x * this.viewport.scale.x
    const sy = this.viewport.y + nodeGfx.y * this.viewport.scale.y
    let tx = sx + 20
    let ty = sy - tipH / 2
    if (tx + tipW > CANVAS_WIDTH - 10) tx = sx - tipW - 20
    if (ty < 50) ty = 50
    if (ty + tipH > CANVAS_HEIGHT - 10) ty = CANVAS_HEIGHT - tipH - 10
    this.tooltip.x = tx
    this.tooltip.y = ty
    this.tooltip.visible = true
  }

  // ---------------------------------------------------------------------------
  // Pan handlers (on background Graphics)
  // ---------------------------------------------------------------------------

  private attachPanHandlers(bg: Graphics): void {
    bg.on('pointerdown', (e) => {
      this.isPanning = true
      this.panStart.x = e.global.x
      this.panStart.y = e.global.y
      this.vpStart.x  = this.viewport.x
      this.vpStart.y  = this.viewport.y
    })
    bg.on('pointermove', (e) => {
      if (!this.isPanning) return
      this.viewport.x = this.vpStart.x + (e.global.x - this.panStart.x)
      this.viewport.y = this.vpStart.y + (e.global.y - this.panStart.y)
    })
    const stopPan = () => { this.isPanning = false }
    bg.on('pointerup',        stopPan)
    bg.on('pointerupoutside', stopPan)
  }

  // ---------------------------------------------------------------------------
  // Legend
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Build Code panel (export / import)
  // ---------------------------------------------------------------------------

  private buildCodePanel(): Container {
    const c = new Container()
    c.x = CANVAS_WIDTH - 270
    c.y = CANVAS_HEIGHT - 120

    const bg = new Graphics()
    bg.beginFill(0x0a0a1a, 0.85)
    bg.drawRoundedRect(0, 0, 260, 110, 6)
    bg.endFill()
    c.addChild(bg)

    const titleStyle = new TextStyle({ fill: '#888899', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' })
    const title = new Text('BUILD CODE', titleStyle)
    title.x = 10; title.y = 8
    c.addChild(title)

    // Export button
    const exportBg = new Graphics()
    exportBg.beginFill(0x1a2244)
    exportBg.lineStyle(1, 0x3355aa)
    exportBg.drawRoundedRect(10, 30, 112, 28, 4)
    exportBg.endFill()
    exportBg.interactive = true
    exportBg.cursor = 'pointer'
    c.addChild(exportBg)

    const exportLabel = new Text('EXPORT', new TextStyle({
      fill: '#aaccff', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    exportLabel.x = 10 + 56 - exportLabel.width / 2
    exportLabel.y = 30 + 7
    c.addChild(exportLabel)

    exportBg.on('pointertap', () => {
      const code = encodeBuild(SkillTreeStore.activeNodes)
      navigator.clipboard.writeText(code).catch(() => {
        window.prompt('Copy build code (Ctrl+C):', code)
      })
      exportLabel.text  = 'COPIED!'
      exportLabel.style.fill = '#44ff88'
      setTimeout(() => {
        exportLabel.text = 'EXPORT'
        exportLabel.style.fill = '#aaccff'
      }, 1400)
    })

    // Import button
    const importBg = new Graphics()
    importBg.beginFill(0x1a2244)
    importBg.lineStyle(1, 0x3355aa)
    importBg.drawRoundedRect(138, 30, 112, 28, 4)
    importBg.endFill()
    importBg.interactive = true
    importBg.cursor = 'pointer'
    c.addChild(importBg)

    const importLabel = new Text('IMPORT', new TextStyle({
      fill: '#aaccff', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    importLabel.x = 138 + 56 - importLabel.width / 2
    importLabel.y = 30 + 7
    c.addChild(importLabel)

    importBg.on('pointertap', () => {
      const input = window.prompt('Paste build code (NEXUS-...):')
      if (!input) return
      const nodes = decodeBuild(input)
      if (!nodes) {
        importLabel.text = 'INVALID!'
        importLabel.style.fill = '#ff4444'
        setTimeout(() => {
          importLabel.text = 'IMPORT'
          importLabel.style.fill = '#aaccff'
        }, 1400)
        return
      }
      SkillTreeStore.loadBuild(nodes)
      importLabel.text = 'LOADED!'
      importLabel.style.fill = '#44ff88'
      setTimeout(() => {
        importLabel.text = 'IMPORT'
        importLabel.style.fill = '#aaccff'
      }, 1400)
    })

    // Hint text
    const hint = new Text('Share your build with friends', new TextStyle({
      fill: '#445566', fontSize: 11, fontFamily: 'monospace',
    }))
    hint.x = 10; hint.y = 70
    c.addChild(hint)

    const hintSP = new Text('(import resets SP to 0)', new TextStyle({
      fill: '#334455', fontSize: 11, fontFamily: 'monospace',
    }))
    hintSP.x = 10; hintSP.y = 86
    c.addChild(hintSP)

    return c
  }

  private buildLegend(y: number): Container {
    const c = new Container()
    c.y = y

    const bg = new Graphics()
    bg.beginFill(0x0a0a1a, 0.85)
    bg.drawRoundedRect(10, 0, 320, 120, 6)
    bg.endFill()
    c.addChild(bg)

    const style = new TextStyle({ fill: '#888899', fontSize: 13, fontFamily: 'monospace' })
    const entries = [
      { color: 0xffffff,  label: 'Allocated' },
      { color: 0xffee44,  label: 'Affordable (click to buy)' },
      { color: 0xff9922,  label: 'Need more SP' },
      { color: 0x444466,  label: 'Locked' },
    ]
    entries.forEach(({ color, label }, i) => {
      const dot = new Graphics()
      dot.beginFill(color, 0.9)
      dot.drawCircle(0, 0, 6)
      dot.endFill()
      dot.x = 26
      dot.y = 18 + i * 22
      c.addChild(dot)

      const txt = new Text(label, style)
      txt.x = 38
      txt.y = 10 + i * 22
      c.addChild(txt)
    })

    // Tier legend
    const tiers = [
      { r: 6,  label: 'Small' },
      { r: 10, label: 'Notable' },
      { r: 14, label: 'Keystone' },
    ]
    tiers.forEach(({ r, label }, i) => {
      const dot = new Graphics()
      dot.beginFill(0x8888aa, 0.8)
      dot.drawCircle(0, 0, r)
      dot.endFill()
      dot.x = 180
      dot.y = 18 + i * 22
      c.addChild(dot)

      const txt = new Text(label, style)
      txt.x = 196
      txt.y = 10 + i * 22
      c.addChild(txt)
    })

    const hint = new Text('Drag to pan  •  Scroll to zoom', new TextStyle({
      fill: '#555566', fontSize: 12, fontFamily: 'monospace',
    }))
    hint.x = 20
    hint.y = 100
    c.addChild(hint)

    return c
  }
}

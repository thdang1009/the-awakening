// ---------------------------------------------------------------------------
// PlayerStatusUI — Full-screen player status overlay ([Shift] to toggle)
// ---------------------------------------------------------------------------
// Shows live combat stats and all acquired Peripheral Weapons / Passive
// Catalysts, using correct MASTER_DOC naming.
// ---------------------------------------------------------------------------

import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js'
import { GameWorld } from '../ecs/world'
import { COLLECTIBLE_MAP } from './LevelUpUI'
import { EVOLUTION_RECIPES } from '../systems/EvolutionSystem'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BASE_NEXUS_MAX_HP, BASE_PROJECTILE_DAMAGE, BASE_FIRE_RATE,
  BASE_PROJECTILE_SPEED, BASE_WEAPON_RANGE, NEXUS_MOVE_SPEED,
} from '../constants'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const PANEL_W = 1100
const PANEL_H = 580
const PANEL_X = (CANVAS_WIDTH  - PANEL_W) / 2
const PANEL_Y = (CANVAS_HEIGHT - PANEL_H) / 2
const COL_SPLIT = 500   // x-offset inside panel where right column starts
const CONTENT_Y = PANEL_Y + 62  // y where column content starts

// ---------------------------------------------------------------------------

export class PlayerStatusUI {
  private readonly container: Container
  private isOpen = false

  constructor(app: Application) {
    this.container = new Container()
    this.container.visible = false
    app.stage.addChild(this.container)
  }

  get visible(): boolean { return this.isOpen }

  toggle(world: GameWorld): void {
    if (this.isOpen) { this.hide() } else { this.show(world) }
  }

  show(world: GameWorld): void {
    this.isOpen = true
    this.container.visible = true
    this.container.removeChildren()
    this.buildLayout(world)
  }

  hide(): void {
    this.isOpen = false
    this.container.visible = false
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  private buildLayout(world: GameWorld): void {
    // Dark backdrop — click anywhere to close
    const overlay = new Graphics()
    overlay.beginFill(0x000000, 0.82)
    overlay.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    overlay.endFill()
    overlay.interactive = true
    overlay.cursor = 'default'
    overlay.on('pointertap', () => this.hide())
    this.container.addChild(overlay)

    // Main panel
    const panel = new Graphics()
    panel.lineStyle(2, 0x3355aa, 1)
    panel.beginFill(0x060c1a, 0.97)
    panel.drawRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 14)
    panel.endFill()
    this.container.addChild(panel)

    // Header
    const header = new Text('PLAYER  STATUS', new TextStyle({
      fill: '#aaccff', fontSize: 24, fontFamily: 'monospace', fontWeight: 'bold',
      dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2,
    }))
    header.anchor.set(0.5, 0)
    header.x = CANVAS_WIDTH / 2
    header.y = PANEL_Y + 14
    this.container.addChild(header)

    const closeHint = new Text('[Shift] or click overlay to close', new TextStyle({
      fill: '#334455', fontSize: 11, fontFamily: 'monospace',
    }))
    closeHint.anchor.set(1, 0)
    closeHint.x = PANEL_X + PANEL_W - 14
    closeHint.y = PANEL_Y + 18
    this.container.addChild(closeHint)

    // Header divider
    const hDiv = new Graphics()
    hDiv.lineStyle(1, 0x2244aa, 0.55)
    hDiv.moveTo(PANEL_X + 16, PANEL_Y + 52)
    hDiv.lineTo(PANEL_X + PANEL_W - 16, PANEL_Y + 52)
    this.container.addChild(hDiv)

    // Vertical column divider
    const vDiv = new Graphics()
    vDiv.lineStyle(1, 0x2244aa, 0.35)
    vDiv.moveTo(PANEL_X + COL_SPLIT, PANEL_Y + 58)
    vDiv.lineTo(PANEL_X + COL_SPLIT, PANEL_Y + PANEL_H - 16)
    this.container.addChild(vDiv)

    // Left column: Combat Stats
    this.buildStatsColumn(world, PANEL_X + 16, CONTENT_Y)

    // Right column: Inventory
    this.buildInventoryColumn(world, PANEL_X + COL_SPLIT + 16, CONTENT_Y)
  }

  // ---------------------------------------------------------------------------
  // Left column — Combat Stats
  // ---------------------------------------------------------------------------

  private buildStatsColumn(world: GameWorld, x: number, startY: number): void {
    const { stats } = world

    const title = new Text('COMBAT STATS', new TextStyle({
      fill: '#7799cc', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    title.x = x; title.y = startY
    this.container.addChild(title)

    const xpPct = world.xpToNextLevel > 0
      ? Math.floor((world.xp / world.xpToNextLevel) * 100)
      : 0

    // Stat rows: [label, value, value-color]
    type Row = { label: string; value: string; color: string } | 'divider'

    const rows: Row[] = [
      {
        label: 'Level',
        value: `${world.level}   (XP ${world.xp} / ${world.xpToNextLevel}  •  ${xpPct}%)`,
        color: '#00ffaa',
      },
      'divider',
      {
        label: 'Max HP',
        value: fmt(BASE_NEXUS_MAX_HP * (1 + stats.maxHPBonus) * stats.maxHPMultiplier),
        color: '#44ff88',
      },
      {
        label: 'Armor  (DMG-Red.)',
        value: `${Math.round(stats.armorFlat * 100)}%  (cap 85%)`,
        color: '#88aaff',
      },
      'divider',
      {
        label: 'Damage / Proj',
        value: fmt(BASE_PROJECTILE_DAMAGE * (1 + stats.damageBonus) * stats.damageMultiplier),
        color: '#ff8844',
      },
      {
        label: 'Fire Rate',
        value: `${fmt(BASE_FIRE_RATE * (1 + stats.fireRateBonus) * stats.fireRateMultiplier)} /s`,
        color: '#ffee44',
      },
      {
        label: 'Proj Speed',
        value: `${fmt(BASE_PROJECTILE_SPEED * (1 + stats.speedBonus))} px/s`,
        color: '#ffee44',
      },
      {
        label: 'Weapon Range',
        value: `${fmt(BASE_WEAPON_RANGE * (1 + stats.rangeBonus))} px`,
        color: '#ffee44',
      },
      {
        label: 'Multishot Bonus',
        value: stats.multishotAdd > 0 ? `+${stats.multishotAdd} extra proj` : 'none',
        color: '#ff88ff',
      },
      'divider',
      {
        label: 'Move Speed',
        value: `${fmt(NEXUS_MOVE_SPEED * world.moveSpeedMult)} px/s`,
        color: '#00ccff',
      },
      {
        label: 'Pickup Radius',
        value: `${fmt(world.pickupRadius)} px`,
        color: '#00ccff',
      },
      'divider',
      {
        label: 'Score Mult',
        value: `×${stats.scoreMultiplier.toFixed(2)}`,
        color: '#ffee44',
      },
    ]

    // Active behaviors
    if (stats.behaviors.size > 0) {
      rows.push('divider')
      rows.push({ label: 'Active Behaviors', value: '', color: '#aabbcc' })
      for (const b of stats.behaviors) {
        rows.push({ label: `  ◦ ${b}`, value: '', color: '#667788' })
      }
    }

    const ROW_H = 24
    let curY = startY + 20

    for (const row of rows) {
      if (row === 'divider') {
        const line = new Graphics()
        line.lineStyle(1, 0x223355, 0.45)
        line.moveTo(x, curY + 8)
        line.lineTo(x + COL_SPLIT - 32, curY + 8)
        this.container.addChild(line)
        curY += 16
        continue
      }

      const lbl = new Text(row.label, new TextStyle({
        fill: '#5a7090', fontSize: 12, fontFamily: 'monospace',
      }))
      lbl.x = x; lbl.y = curY
      this.container.addChild(lbl)

      if (row.value) {
        const val = new Text(row.value, new TextStyle({
          fill: row.color, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold',
        }))
        val.x = x + 162; val.y = curY
        this.container.addChild(val)
      }

      curY += ROW_H
    }
  }

  // ---------------------------------------------------------------------------
  // Right column — Inventory
  // ---------------------------------------------------------------------------

  private buildInventoryColumn(world: GameWorld, x: number, startY: number): void {
    const colW = PANEL_W - COL_SPLIT - 32   // usable width in right column

    let curY = startY

    // ── Peripheral Weapons (List 3) ────────────────────────────────────────
    const periTitle = new Text('◆  PERIPHERAL WEAPONS  (List 3)', new TextStyle({
      fill: '#ff8833', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    periTitle.x = x; periTitle.y = curY
    this.container.addChild(periTitle)
    curY += 22

    if (world.peripherals.length === 0) {
      const none = new Text('  none acquired yet', new TextStyle({
        fill: '#334455', fontSize: 12, fontFamily: 'monospace',
      }))
      none.x = x; none.y = curY
      this.container.addChild(none)
      curY += 20
    } else {
      const counts = countIds(world.peripherals)
      for (const [id, count] of counts) {
        const item = COLLECTIBLE_MAP.get(id)
        curY = this.drawItem(
          x, curY, colW,
          item?.name ?? id,
          item?.description ?? '',
          item?.color ?? 0xff8833,
          count,
          'peripheral',
        )
      }
    }

    // Divider between sections
    curY += 12
    const div = new Graphics()
    div.lineStyle(1, 0x223355, 0.5)
    div.moveTo(x, curY); div.lineTo(x + colW, curY)
    this.container.addChild(div)
    curY += 14

    // ── Passive Catalysts (List 4) ─────────────────────────────────────────
    const catTitle = new Text('●  PASSIVE CATALYSTS  (List 4)', new TextStyle({
      fill: '#00ccff', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    catTitle.x = x; catTitle.y = curY
    this.container.addChild(catTitle)
    curY += 22

    if (world.catalysts.length === 0) {
      const none = new Text('  none acquired yet', new TextStyle({
        fill: '#334455', fontSize: 12, fontFamily: 'monospace',
      }))
      none.x = x; none.y = curY
      this.container.addChild(none)
      curY += 20
    } else {
      const counts = countIds(world.catalysts)
      for (const [id, count] of counts) {
        const item = COLLECTIBLE_MAP.get(id)
        this.drawItem(
          x, curY, colW,
          item?.name ?? id,
          item?.description ?? '',
          item?.color ?? 0x00ccff,
          count,
          'catalyst',
        )
        curY += 38
      }
    }

    // ── Phase 4: Weapon Evolutions ─────────────────────────────────────────
    if (world.evolutions && world.evolutions.size > 0) {
      curY += 12
      const evoDiv = new Graphics()
      evoDiv.lineStyle(1, 0x441166, 0.7)
      evoDiv.moveTo(x, curY); evoDiv.lineTo(x + colW, curY)
      this.container.addChild(evoDiv)
      curY += 14

      const evoTitle = new Text('✦  WEAPON EVOLUTIONS  (Phase 4)', new TextStyle({
        fill: '#ff88ff', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
      }))
      evoTitle.x = x; evoTitle.y = curY
      this.container.addChild(evoTitle)
      curY += 22

      for (const recipe of EVOLUTION_RECIPES) {
        if (!world.evolutions.has(recipe.id)) continue
        const evoRow = new Text(`★ ${recipe.displayName}`, new TextStyle({
          fill: '#ff88ff', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold',
        }))
        evoRow.x = x; evoRow.y = curY
        this.container.addChild(evoRow)
        curY += 20
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helper — single item row with colored icon, name, description
  // ---------------------------------------------------------------------------

  private drawItem(
    x: number, y: number, colW: number,
    name: string, desc: string, color: number, count: number,
    category: 'peripheral' | 'catalyst',
  ): number {
    const DOT = 8

    const dot = new Graphics()
    dot.beginFill(color, 0.9)
    if (category === 'peripheral') {
      dot.drawPolygon([DOT / 2, 0, DOT, DOT / 2, DOT / 2, DOT, 0, DOT / 2])
    } else {
      dot.drawCircle(DOT / 2, DOT / 2, DOT / 2)
    }
    dot.endFill()
    dot.x = x; dot.y = y + 3
    this.container.addChild(dot)

    const suffix = count > 1 ? `  ×${count}` : ''
    const nameTxt = new Text(`${name}${suffix}`, new TextStyle({
      fill: '#e0eeff', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    nameTxt.x = x + DOT + 6; nameTxt.y = y
    this.container.addChild(nameTxt)

    // Description — first clause before the stat line
    const descTxt = new Text(desc, new TextStyle({
      fill: '#6a8099', fontSize: 11, fontFamily: 'monospace',
      wordWrap: true, wordWrapWidth: colW - DOT - 6,
    }))
    descTxt.x = x + DOT + 6; descTxt.y = y + 16
    this.container.addChild(descTxt)

    return y + 38
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)
}

function countIds(ids: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1)
  return m
}

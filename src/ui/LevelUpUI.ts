// ---------------------------------------------------------------------------
// LevelUpUI — 3-card RNG drafting screen (triggered on XP bar fill)
// ---------------------------------------------------------------------------
// When the player levels up, the game pauses and this overlay presents
// 3 randomly chosen cards from the available Peripheral Weapons (List 3)
// and Passive Catalysts (List 4).  Clicking a card applies its effect
// and resumes the game.
// ---------------------------------------------------------------------------

import {
  Application, Container, Graphics, Text, TextStyle,
} from 'pixi.js'
import { GameWorld } from '../ecs/world'

// ---------------------------------------------------------------------------
// Item definitions — MVP subset (2 from each list per GDD)
// ---------------------------------------------------------------------------

export type ItemCategory = 'peripheral' | 'catalyst'

export interface LevelUpItem {
  id:          string
  category:    ItemCategory
  name:        string
  description: string
  color:       number       // card accent color
  apply:       (world: GameWorld) => void
}

export const ITEMS: LevelUpItem[] = [
  // ── List 3: Peripheral Weapons ──────────────────────────────────────────
  {
    id: 'orbital_buzzsaw',
    category: 'peripheral',
    name: 'Orbital Buzzsaw',
    description: 'Summons rotating energy blades around the Nexus.\n+1% Damage.',
    color: 0xff6600,
    apply(world) {
      world.peripherals.push('orbital_buzzsaw')
      world.stats.behaviors.add('AURA_DAMAGE')
      world.stats.damageMultiplier *= 1.01
    },
  },
  {
    id: 'seeker_missile',
    category: 'peripheral',
    name: 'Seeker Missile Pod',
    description: 'Every few seconds, missiles auto-target elite enemies.\n+1.5% Fire Rate.',
    color: 0xff3333,
    apply(world) {
      world.peripherals.push('seeker_missile')
      world.stats.fireRateBonus += 0.015
    },
  },

  // ── List 4: Passive Catalysts ────────────────────────────────────────────
  {
    id: 'hyper_coolant',
    category: 'catalyst',
    name: 'Hyper-Coolant',
    description: 'Cooldown Reduction for all weapons.\n+3% Fire Rate.',
    color: 0x00ccff,
    apply(world) {
      world.catalysts.push('hyper_coolant')
      world.stats.fireRateMultiplier *= 1.03
    },
  },
  {
    id: 'overclock_chip',
    category: 'catalyst',
    name: 'Overclock Chip',
    description: 'Overclocks the Nexus drive systems.\n+3% Move Speed & Projectile Speed.',
    color: 0xffee00,
    apply(world) {
      world.catalysts.push('overclock_chip')
      world.moveSpeedMult    *= 1.03
      world.stats.speedBonus += 0.03
    },
  },
  {
    id: 'uranium_core',
    category: 'catalyst',
    name: 'Uranium Core',
    description: 'Fission core amplifies damage output.\n+4% Damage Multiplier.',
    color: 0x66ff33,
    apply(world) {
      world.catalysts.push('uranium_core')
      world.stats.damageMultiplier *= 1.04
    },
  },
  {
    id: 'graviton_lens',
    category: 'catalyst',
    name: 'Graviton Lens',
    description: 'Bends gravity around the Nexus.\n+5% Pickup Radius & +2% AoE.',
    color: 0xcc44ff,
    apply(world) {
      world.catalysts.push('graviton_lens')
      world.pickupRadius     *= 1.05
      world.stats.rangeBonus += 0.02
    },
  },
  {
    id: 'exo_casing',
    category: 'catalyst',
    name: 'Exo-Casing',
    description: 'Shell plating reinforcement.\n+5% Max HP & 1.5% Damage Reduction.',
    color: 0x88aaff,
    apply(world) {
      world.catalysts.push('exo_casing')
      world.stats.maxHPBonus += 0.05
      world.stats.armorFlat  = Math.min(0.85, world.stats.armorFlat + 0.015)
    },
  },
]

// ---------------------------------------------------------------------------
// Card dimensions
// ---------------------------------------------------------------------------
const CARD_W   = 280
const CARD_H   = 220
const CARD_GAP = 40
const TOTAL_W  = CARD_W * 3 + CARD_GAP * 2
const ORIGIN_X = (1280 - TOTAL_W) / 2
const ORIGIN_Y = (720  - CARD_H)  / 2

// ---------------------------------------------------------------------------
// LevelUpUI class
// ---------------------------------------------------------------------------
export class LevelUpUI {
  private readonly container: Container
  private readonly app: Application
  private isOpen = false

  constructor(app: Application) {
    this.app       = app
    this.container = new Container()
    this.container.visible = false
    app.stage.addChild(this.container)
  }

  get visible(): boolean { return this.isOpen }

  /**
   * Show the drafting screen with 3 random cards.
   * @param world   — the live game world to apply the chosen item to
   * @param onPick  — callback once the player selects a card (resumes game)
   */
  show(world: GameWorld, onPick: () => void): void {
    this.isOpen = true
    this.container.visible = true
    this.container.removeChildren()

    // Semi-transparent backdrop
    const overlay = new Graphics()
    overlay.beginFill(0x000000, 0.72)
    overlay.drawRect(0, 0, 1280, 720)
    overlay.endFill()
    this.container.addChild(overlay)

    // Header
    const header = new Text(`LEVEL UP!  →  Level ${world.level}`, new TextStyle({
      fill: '#ffee44', fontSize: 32, fontFamily: 'monospace', fontWeight: 'bold',
      dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 3,
    }))
    header.anchor.set(0.5, 0)
    header.x = 640
    header.y = ORIGIN_Y - 60
    this.container.addChild(header)

    const subtext = new Text('Choose one enhancement', new TextStyle({
      fill: '#aabbcc', fontSize: 18, fontFamily: 'monospace',
    }))
    subtext.anchor.set(0.5, 0)
    subtext.x = 640
    subtext.y = ORIGIN_Y - 24
    this.container.addChild(subtext)

    // Pick 3 random unique cards, excluding already-owned duplicates where possible
    const available = ITEMS.filter(item =>
      !world.peripherals.includes(item.id) && !world.catalysts.includes(item.id),
    )
    const pool = available.length >= 3 ? available : ITEMS   // fallback to all if low variety
    const chosen = shuffled(pool).slice(0, 3)

    chosen.forEach((item, idx) => {
      const cardX = ORIGIN_X + idx * (CARD_W + CARD_GAP)
      const card  = this.buildCard(item, cardX, ORIGIN_Y)

      // Hover effect
      card.interactive = true
      card.cursor = 'pointer'
      card.on('pointerover',  () => card.scale.set(1.04))
      card.on('pointerout',   () => card.scale.set(1.0))
      card.on('pointertap',   () => {
        item.apply(world)
        this.hide()
        onPick()
      })

      this.container.addChild(card)
    })
  }

  hide(): void {
    this.isOpen = false
    this.container.visible = false
  }

  private buildCard(item: LevelUpItem, cx: number, cy: number): Container {
    const card = new Container()
    card.x = cx
    card.y = cy

    // Card background
    const bg = new Graphics()
    bg.lineStyle(2, item.color, 0.9)
    bg.beginFill(0x0d1526, 0.95)
    bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 12)
    bg.endFill()
    card.addChild(bg)

    // Category badge
    const badgeColor = item.category === 'catalyst' ? '#00ccff' : '#ff8833'
    const badge = new Text(
      item.category === 'catalyst' ? '◆ CATALYST' : '⚙ PERIPHERAL',
      new TextStyle({ fill: badgeColor, fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' }),
    )
    badge.x = 12; badge.y = 12
    card.addChild(badge)

    // Item name
    const name = new Text(item.name, new TextStyle({
      fill: '#ffffff', fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold',
      wordWrap: true, wordWrapWidth: CARD_W - 24,
    }))
    name.x = 12; name.y = 38
    card.addChild(name)

    // Divider
    const div = new Graphics()
    div.lineStyle(1, item.color, 0.5)
    div.moveTo(12, 68); div.lineTo(CARD_W - 12, 68)
    card.addChild(div)

    // Description
    const desc = new Text(item.description, new TextStyle({
      fill: '#aabbcc', fontSize: 13, fontFamily: 'monospace',
      wordWrap: true, wordWrapWidth: CARD_W - 24,
    }))
    desc.x = 12; desc.y = 78
    card.addChild(desc)

    // "Click to select" prompt at bottom
    const prompt = new Text('[ Click to select ]', new TextStyle({
      fill: item.color, fontSize: 12, fontFamily: 'monospace',
    }))
    prompt.anchor.set(0.5, 1)
    prompt.x = CARD_W / 2; prompt.y = CARD_H - 12
    card.addChild(prompt)

    return card
  }

  destroy(): void {
    this.container.parent?.removeChild(this.container)
    this.container.destroy({ children: true })
  }
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

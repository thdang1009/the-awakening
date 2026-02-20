// ---------------------------------------------------------------------------
// LevelUpUI — 3-card RNG drafting screen (triggered on XP bar fill)
// ---------------------------------------------------------------------------
// Presents 3 randomly chosen cards from the Peripheral Weapons (List 3)
// and Passive Catalysts (List 4) pool when the XP bar fills.
// ---------------------------------------------------------------------------

import {
  Application, Container, Graphics, Text, TextStyle,
} from 'pixi.js'
import { GameWorld } from '../ecs/world'

// ---------------------------------------------------------------------------
// Collectible type — shared by LevelUpUI and RouletteUI
// ---------------------------------------------------------------------------

export type ItemCategory = 'peripheral' | 'catalyst'

/**
 * A single collectible item: either a Peripheral Weapon (Sub-Weapon, List 3)
 * or a Passive Catalyst (Evolution Key, List 4).
 */
export interface Collectible {
  id:          string
  category:    ItemCategory
  /** Display name — matches MASTER_DOC exactly */
  name:        string
  /** One-line effect description shown on the card */
  description: string
  color:       number       // card accent color
  apply:       (world: GameWorld) => void
}

// ---------------------------------------------------------------------------
// Item registry — List 3 + List 4 (MVP subset per MASTER_DOC §Appendix A)
// ---------------------------------------------------------------------------

export const COLLECTIBLES: Collectible[] = [
  // ── List 3: Peripheral Weapons (Sub-Weapons) ─────────────────────────────
  // Acquired from level-up (XP fill).
  {
    id: 'orbital_buzzsaw',
    category: 'peripheral',
    name: 'Orbital Buzzsaw',
    description: 'Rotating energy blades surround the Nexus.\n+1% Damage.',
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
    description: 'Missiles auto-target Elite/Boss enemies on the map.\n+1.5% Fire Rate.',
    color: 0xff3333,
    apply(world) {
      world.peripherals.push('seeker_missile')
      world.stats.fireRateBonus += 0.015
    },
  },

  // ── List 4: Passive Catalysts (Evolution Keys) ───────────────────────────
  // Acquired from level-up AND Roulette (chest drops).
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
    description: 'Overclocks Nexus drive systems.\n+3% Move Speed & Projectile Speed.',
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
    description: 'Fission core amplifies all damage output.\n+4% Damage Multiplier.',
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
    description: 'Heavy shell plating reinforcement.\n+5% Max HP & 1.5% Damage Reduction.',
    color: 0x88aaff,
    apply(world) {
      world.catalysts.push('exo_casing')
      world.stats.maxHPBonus += 0.05
      world.stats.armorFlat  = Math.min(0.85, world.stats.armorFlat + 0.015)
    },
  },
  {
    id: 'replicator_matrix',
    category: 'catalyst',
    name: 'Replicator Matrix',
    description: 'Global multiplier to Multishot & SpawnCount.\n+1 Projectile per salvo.',
    color: 0xff88ff,
    apply(world) {
      world.catalysts.push('replicator_matrix')
      world.stats.multishotAdd += 1
    },
  },
]

// Convenience lookup by id
export const COLLECTIBLE_MAP = new Map(COLLECTIBLES.map(c => [c.id, c]))

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

    const subtext = new Text('Choose a Peripheral Weapon', new TextStyle({
      fill: '#aabbcc', fontSize: 16, fontFamily: 'monospace',
    }))
    subtext.anchor.set(0.5, 0)
    subtext.x = 640
    subtext.y = ORIGIN_Y - 24
    this.container.addChild(subtext)

    // Level-up: 3 cards drawn exclusively from List 3 (Peripheral Weapons).
    // Prefer unowned ones; allow repeats when the full List 3 pool is small.
    const periOnly  = COLLECTIBLES.filter(c => c.category === 'peripheral')
    const unowned   = periOnly.filter(c => !world.peripherals.includes(c.id))
    const base      = unowned.length > 0 ? unowned : periOnly
    // Pad to at least 3 by repeating the peripheral list so we always show 3 cards
    const padded    = [...base, ...periOnly, ...periOnly]
    const chosen    = shuffled(padded).slice(0, 3)

    chosen.forEach((item, idx) => {
      const cardX = ORIGIN_X + idx * (CARD_W + CARD_GAP)
      const card  = this.buildCard(item, cardX, ORIGIN_Y)

      card.interactive = true
      card.cursor = 'pointer'
      card.on('pointerover', () => card.scale.set(1.04))
      card.on('pointerout',  () => card.scale.set(1.0))
      card.on('pointertap',  () => {
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

  private buildCard(item: Collectible, cx: number, cy: number): Container {
    const card = new Container()
    card.x = cx
    card.y = cy

    const bg = new Graphics()
    bg.lineStyle(2, item.color, 0.9)
    bg.beginFill(0x0d1526, 0.95)
    bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 12)
    bg.endFill()
    card.addChild(bg)

    // Category label with correct MASTER_DOC names
    const catLabel = item.category === 'peripheral' ? '◆ PERIPHERAL WEAPON' : '● PASSIVE CATALYST'
    const catColor = item.category === 'peripheral' ? '#ff8833'             : '#00ccff'
    const badge = new Text(catLabel, new TextStyle({
      fill: catColor, fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    badge.x = 12; badge.y = 12
    card.addChild(badge)

    const name = new Text(item.name, new TextStyle({
      fill: '#ffffff', fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold',
      wordWrap: true, wordWrapWidth: CARD_W - 24,
    }))
    name.x = 12; name.y = 38
    card.addChild(name)

    const div = new Graphics()
    div.lineStyle(1, item.color, 0.5)
    div.moveTo(12, 68); div.lineTo(CARD_W - 12, 68)
    card.addChild(div)

    const desc = new Text(item.description, new TextStyle({
      fill: '#aabbcc', fontSize: 13, fontFamily: 'monospace',
      wordWrap: true, wordWrapWidth: CARD_W - 24,
    }))
    desc.x = 12; desc.y = 78
    card.addChild(desc)

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

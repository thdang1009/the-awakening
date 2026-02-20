// ---------------------------------------------------------------------------
// Enemy Archetype definitions
// 10 distinct archetypes × wave scaling × context modifiers = 50+ variations
// ---------------------------------------------------------------------------

import { TextureId } from '../constants'
import type { GameContext } from '../context/DateTimeContext'

export interface EnemyArchetype {
  id:             string
  label:          string
  textureId:      TextureId
  /** Base tint (white-based textures, so this IS the color) */
  tint:           number
  /** Visual + collider scale relative to ENEMY_RADIUS */
  scale:          number
  /** Multiplier on wave base speed */
  speedMult:      number
  /** Multiplier on wave base HP */
  hpMult:         number
  /** Multiplier on ENEMY_DAMAGE */
  damageMult:     number
  /** Multiplier on ENEMY_ATTACK_COOLDOWN (lower = more frequent) */
  cooldownMult:   number
  /** How many entities to spawn per scheduler "slot" */
  spawnGroupSize: number
  /** Earliest wave this archetype may appear */
  minWave:        number
  /** Relative weight in weighted-random selection (higher = more common) */
  weight:         number
  /** Only available during night context (22:00–05:59) */
  nightOnly?:     boolean
  /** Only available during weekend context (Sat/Sun) */
  weekendOnly?:   boolean
  /** Spawns 2 mini-enemies on death */
  splitsOnDeath?: boolean
}

// ---------------------------------------------------------------------------
// Archetype definitions
// ---------------------------------------------------------------------------

export const ARCHETYPES: readonly EnemyArchetype[] = [
  // ── Waves 1+ ────────────────────────────────────────────────────────────
  {
    id: 'standard', label: 'Standard',
    textureId: TextureId.Enemy,      tint: 0xff3333, scale: 1.0,
    speedMult: 1.0,  hpMult: 1.0,   damageMult: 1.0,  cooldownMult: 1.0,
    spawnGroupSize: 1, minWave: 1,   weight: 10,
  },
  {
    id: 'swarm', label: 'Swarm',
    textureId: TextureId.EnemySwarm, tint: 0xaaff00, scale: 0.55,
    speedMult: 1.4,  hpMult: 0.4,   damageMult: 0.5,  cooldownMult: 1.0,
    spawnGroupSize: 4, minWave: 1,   weight: 6,
  },

  // ── Waves 2+ ────────────────────────────────────────────────────────────
  {
    id: 'dasher', label: 'Dasher',
    textureId: TextureId.EnemyFast,  tint: 0x00ffcc, scale: 0.75,
    speedMult: 1.8,  hpMult: 0.6,   damageMult: 0.8,  cooldownMult: 1.0,
    spawnGroupSize: 1, minWave: 2,   weight: 7,
  },
  {
    id: 'brute', label: 'Brute',
    textureId: TextureId.EnemyBrute, tint: 0xcc3300, scale: 1.6,
    speedMult: 0.5,  hpMult: 3.0,   damageMult: 1.8,  cooldownMult: 0.8,
    spawnGroupSize: 1, minWave: 2,   weight: 5,
  },

  // ── Waves 3+ ────────────────────────────────────────────────────────────
  {
    id: 'tank', label: 'Tank',
    textureId: TextureId.EnemyBrute, tint: 0xff6600, scale: 1.35,
    speedMult: 0.55, hpMult: 2.5,   damageMult: 1.2,  cooldownMult: 0.9,
    spawnGroupSize: 1, minWave: 3,   weight: 5,
  },
  {
    id: 'splitter', label: 'Splitter',
    textureId: TextureId.EnemySwarm, tint: 0xffaa33, scale: 1.2,
    speedMult: 0.7,  hpMult: 1.5,   damageMult: 1.0,  cooldownMult: 1.0,
    spawnGroupSize: 1, minWave: 3,   weight: 4,        splitsOnDeath: true,
  },
  {
    id: 'void', label: 'Void',
    textureId: TextureId.EnemyShadow, tint: 0x6600cc, scale: 1.1,
    speedMult: 0.9,  hpMult: 1.8,   damageMult: 2.0,  cooldownMult: 0.9,
    spawnGroupSize: 1, minWave: 3,   weight: 5,         weekendOnly: true,
  },

  // ── Waves 4+ ────────────────────────────────────────────────────────────
  {
    id: 'berserker', label: 'Berserker',
    textureId: TextureId.EnemyFast,  tint: 0xff4400, scale: 1.0,
    speedMult: 1.4,  hpMult: 1.0,   damageMult: 1.6,  cooldownMult: 0.5,
    spawnGroupSize: 1, minWave: 4,   weight: 5,
  },
  {
    id: 'elite', label: 'Elite',
    textureId: TextureId.EnemyBrute, tint: 0xffcc00, scale: 1.2,
    speedMult: 1.2,  hpMult: 2.0,   damageMult: 1.5,  cooldownMult: 0.85,
    spawnGroupSize: 1, minWave: 4,   weight: 3,
  },

  // ── Night-only (any wave) ────────────────────────────────────────────────
  {
    id: 'shadow', label: 'Shadow',
    textureId: TextureId.EnemyShadow, tint: 0x8844ff, scale: 0.9,
    speedMult: 1.1,  hpMult: 0.9,   damageMult: 1.3,  cooldownMult: 1.0,
    spawnGroupSize: 2, minWave: 1,   weight: 8,         nightOnly: true,
  },
]

export const ARCHETYPE_MAP = new Map(ARCHETYPES.map(a => [a.id, a]))

// ---------------------------------------------------------------------------
// Weighted archetype selection
// ---------------------------------------------------------------------------

export function selectArchetype(wave: number, context: GameContext): EnemyArchetype {
  const pool = ARCHETYPES.filter(a => {
    if (a.minWave > wave)                       return false
    if (a.nightOnly   && !context.isNight)      return false
    if (a.weekendOnly && !context.isWeekend)    return false
    return true
  })

  if (pool.length === 0) return ARCHETYPES[0]

  const total = pool.reduce((s, a) => s + a.weight, 0)
  let roll    = Math.random() * total
  for (const a of pool) {
    roll -= a.weight
    if (roll <= 0) return a
  }
  return pool[pool.length - 1]
}

// ---------------------------------------------------------------------------
// Context-driven tint modifier (applied at spawn time)
// ---------------------------------------------------------------------------

export function contextTintOverride(tint: number, context: GameContext): number {
  if (context.isHalloween) {
    // Shift toward orange: boost red, reduce blue
    const r = Math.min(255, ((tint >> 16) & 0xff) + 60)
    const g =               ((tint >>  8) & 0xff)
    const b = Math.max(0,   ( tint        & 0xff) - 60)
    return (r << 16) | (g << 8) | b
  }
  if (context.isNewYear) {
    // Shift toward gold/silver: boost red + green, reduce blue
    const r = Math.min(255, ((tint >> 16) & 0xff) + 50)
    const g = Math.min(255, ((tint >>  8) & 0xff) + 30)
    const b = Math.max(0,   ( tint        & 0xff) - 20)
    return (r << 16) | (g << 8) | b
  }
  return tint
}

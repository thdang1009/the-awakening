import { createWorld } from 'bitecs'
import type { ComputedStats } from '../skilltree/types'
import { createDefaultStats } from '../skilltree/types'
import { type GameContext, detectContext } from '../context/DateTimeContext'

export type { GameContext }

// ---------------------------------------------------------------------------
// Timed / one-shot viewer-buff state (used by Streamer Mode)
// ---------------------------------------------------------------------------

export interface WorldBuffs {
  /** Fire rate multiplier on top of weapon stats (1.0 = no buff) */
  fireRateMult:   number
  /** Seconds remaining for the fire rate buff (0 = inactive) */
  fireRateTimer:  number
  /** Enemy speed multiplier (1.0 = normal) */
  enemySpeedMult:  number
  /** Seconds remaining for the enemy speed buff (0 = inactive) */
  enemySpeedTimer: number
  /** Consume-once flag: immediately spawn a mini-wave */
  spawnWaveRequest: boolean
  /** Consume-once flag: spawn a boss enemy */
  spawnBossRequest: boolean
  /** Consume-once flag: restore 30 % of Nexus max HP */
  healRequest: boolean
}

// ---------------------------------------------------------------------------
// Extended world type
// ---------------------------------------------------------------------------

/** Extended world with game-level state */
export type GameWorld = ReturnType<typeof createWorld> & {
  delta: number       // current frame dt in seconds
  elapsed: number     // total elapsed seconds
  nexusEid: number    // entity ID of the Nexus
  gameOver: boolean
  paused: boolean     // true while the skill tree overlay is open
  wave: number
  score: number
  stats: ComputedStats  // current computed skill-tree stats (read by systems)
  buffs: WorldBuffs
  /** DateTime-based game context, detected once at session start */
  context: GameContext
  /** Pending split-spawn requests from Splitter enemies (written by CollisionSystem, consumed by SpawnerSystem) */
  pendingSplits: Array<{ x: number; y: number }>
  /** 0–1 heat level for THERMAL_ACCELERATION; ramps up during sustained fire */
  thermalHeat: number
  /** Current sweep angle (radians) for BEAM_MODE + SWEEPING */
  beamAngle: number
  /** Countdown until next AURA_DAMAGE pulse (seconds) */
  auraTimer: number

  // ── Phase 2: Economy & XP ──────────────────────────────────────────────
  /** Current experience points accumulated this level */
  xp: number
  /** XP required to trigger the next level-up */
  xpToNextLevel: number
  /** Current player level (starts at 1) */
  level: number
  /** Pickup radius (px) — can be boosted by Scrap Magnet chassis / catalysts */
  pickupRadius: number
  /** Nexus move speed multiplier — can be boosted by level-up items */
  moveSpeedMult: number
  /** Consume-once: triggers the Level-Up drafting pause */
  pendingLevelUp: boolean
  /** True while the level-up card selection overlay is visible */
  levelUpPause: boolean
  /** Inventory: IDs of acquired peripheral weapons */
  peripherals: string[]
  /** Inventory: IDs of acquired passive catalysts */
  catalysts: string[]
  /** Pending gem spawns (written by CollisionSystem/AuraSystem, consumed by GemSystem) */
  pendingGems: Array<{ x: number; y: number }>
}

export function createGameWorld(): GameWorld {
  const world = createWorld() as GameWorld
  world.delta   = 0
  world.elapsed = 0
  world.nexusEid  = -1
  world.gameOver  = false
  world.paused    = false
  world.wave      = 0
  world.score     = 0
  world.stats     = createDefaultStats()
  world.buffs     = {
    fireRateMult:     1,
    fireRateTimer:    0,
    enemySpeedMult:   1,
    enemySpeedTimer:  0,
    spawnWaveRequest: false,
    spawnBossRequest: false,
    healRequest:      false,
  }
  world.context       = detectContext()
  world.pendingSplits = []
  world.thermalHeat   = 0
  world.beamAngle     = 0
  world.auraTimer     = 0

  // Phase 2
  world.xp              = 0
  world.xpToNextLevel   = 50   // matches XP_BASE constant
  world.level           = 1
  world.pickupRadius    = 90   // matches BASE_PICKUP_RADIUS constant
  world.moveSpeedMult   = 1.0
  world.pendingLevelUp  = false
  world.levelUpPause    = false
  world.peripherals     = []
  world.catalysts       = []
  world.pendingGems     = []

  return world
}

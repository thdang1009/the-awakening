// ---------------------------------------------------------------------------
// Skill Tree — Type Definitions
// ---------------------------------------------------------------------------

/** Which additive bonus pool a node effect targets */
export type StatKey =
  | 'fireRateBonus'    // adds to fire-rate multiplier pool
  | 'damageBonus'      // adds to damage multiplier pool
  | 'speedBonus'       // adds to projectile-speed multiplier pool
  | 'rangeBonus'       // adds to range multiplier pool
  | 'maxHPBonus'       // adds to max-HP multiplier pool
  | 'armorFlat'        // flat incoming-damage reduction (0–0.9)
  | 'scoreBonus'       // adds to score multiplier pool
  | 'bonusSPPerWave'   // extra skill points awarded per wave clear
  | 'multishotAdd'     // extra projectiles fired per shot

/** Keystone identifiers — each flips a boolean flag in ComputedStats */
export type KeystoneId =
  | 'machineGunProtocol'  // ×2.8 fire rate, ×0.7 damage
  | 'singularityCannon'   // ×2.0 damage, ×0.6 fire rate
  | 'indestructibleCore'  // ×2.0 max HP, −25% damage taken
  | 'quantumTunneling'    // projectiles pass through enemies
  | 'novaBurst'           // fires 8 projectiles in all directions
  | 'omniscient'          // ×2 score per kill

export type NodeTier = 'start' | 'small' | 'notable' | 'keystone'

export type BranchId =
  | 'start'
  | 'rapidFire'
  | 'heavyStrike'
  | 'bulwark'
  | 'warp'
  | 'chain'
  | 'collector'
  | 'junction'          // cross-branch connector nodes

/** A single bonus applied when the node is active */
export interface NodeEffect {
  stat: StatKey
  value: number
}

/** A node in the skill tree graph */
export interface SkillNode {
  id: string
  x: number             // position in tree-space (px)
  y: number
  tier: NodeTier
  branch: BranchId
  label: string
  description: string
  connections: string[] // IDs of adjacent nodes (used to build bidirectional map)
  effects: NodeEffect[]
  keystoneId?: KeystoneId
  cost: number          // skill points to activate
}

/** Accumulated stats after summing all active nodes */
export interface ComputedStats {
  // Additive bonus pools (add to these, final mult = 1 + bonus)
  fireRateBonus: number
  damageBonus: number
  speedBonus: number
  rangeBonus: number
  maxHPBonus: number
  armorFlat: number        // damage reduction fraction
  scoreBonus: number
  bonusSPPerWave: number
  multishotAdd: number

  // Keystones
  machineGunProtocol: boolean
  singularityCannon: boolean
  indestructibleCore: boolean
  quantumTunneling: boolean
  novaBurst: boolean
  omniscient: boolean
}

export const DEFAULT_STATS: ComputedStats = {
  fireRateBonus: 0,
  damageBonus: 0,
  speedBonus: 0,
  rangeBonus: 0,
  maxHPBonus: 0,
  armorFlat: 0,
  scoreBonus: 0,
  bonusSPPerWave: 0,
  multishotAdd: 0,
  machineGunProtocol: false,
  singularityCannon: false,
  indestructibleCore: false,
  quantumTunneling: false,
  novaBurst: false,
  omniscient: false,
}

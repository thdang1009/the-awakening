// ---------------------------------------------------------------------------
// Skill Tree — Type Definitions
// ---------------------------------------------------------------------------

// ─── Stat names ──────────────────────────────────────────────────────────────

/**
 * Additive stats — summed across all active nodes.
 * Applied as:  finalValue = BASE × (1 + totalBonus)
 */
export type AdditiveStat =
  | 'fireRateBonus'   // +X% fire rate
  | 'damageBonus'     // +X% damage per projectile
  | 'speedBonus'      // +X% projectile travel speed
  | 'rangeBonus'      // +X% targeting radius
  | 'maxHPBonus'      // +X% maximum HP
  | 'armorFlat'       // flat incoming-damage reduction (0 – 0.85 cap)
  | 'scoreBonus'      // +X% score per kill
  | 'bonusSPPerWave'  // extra skill points awarded per wave clear
  | 'multishotAdd'    // extra projectiles per salvo

/**
 * Multiplicative stats — each node's value is MULTIPLIED together.
 * Applied as:  finalValue = BASE × (1 + additiveBonus) × ∏(multipliers)
 * Default is 1.0; a node contributing 0.7 reduces the stat by 30%.
 */
export type MultiplicativeStat =
  | 'fireRateMultiplier'     // e.g. 3.5  → fire rate ×3.5
  | 'damageMultiplier'       // e.g. 0.6  → damage  ×0.6
  | 'maxHPMultiplier'        // e.g. 2.0  → max HP  ×2.0
  | 'damageTakenMultiplier'  // e.g. 0.75 → take 25% less damage
  | 'scoreMultiplier'        // e.g. 2.0  → score per kill ×2.0

/** Union of every stat name accepted by NodeEffect */
export type StatName = AdditiveStat | MultiplicativeStat

// ─── Behavior types ───────────────────────────────────────────────────────────

/**
 * Named gameplay-behaviour tags attached to skill nodes.
 * ECS systems read `stats.behaviors.has(b)` to conditionally alter logic.
 * Tags marked (future) are defined in data now; systems to be wired in a later phase.
 */
export type BehaviorType =
  // ── Rapid Fire branch ─────────────────────────────────────────────────────
  | 'BEAM_MODE'              // replaces projectiles with a continuous laser beam
  | 'SWEEPING'               // beam sweeps an arc across nearby enemy clusters
  | 'THERMAL_ACCELERATION'   // (future) fire rate ramps up during sustained fire
  // ── Heavy Strike branch ───────────────────────────────────────────────────
  | 'KNOCKBACK'              // pushes enemy away from Nexus on projectile hit
  | 'DELAYED_EXPLOSION'      // (future) projectile embeds then detonates after a delay
  // ── Bulwark branch ────────────────────────────────────────────────────────
  | 'AURA_DAMAGE'            // (future) Nexus emits a pulsing damage ring scaling with HP
  | 'SCALES_WITH_HP'         // (future) offensive power scales with current / max HP
  // ── Warp branch ───────────────────────────────────────────────────────────
  | 'BOOMERANG'              // (future) projectiles arc back to Nexus after max range
  | 'SPAWN_BLACKHOLE'        // (future) projectile becomes a gravity well at max range
  | 'MAGNETIC_PULL'          // (future) gravity well pulls nearby enemies inward
  // ── Chain branch ──────────────────────────────────────────────────────────
  | 'SEEKER'                 // (future) projectiles curve toward closest enemy mid-flight
  | 'CHAIN_LIGHTNING'        // (future) lightning bounces to additional enemies on kill
  | 'SMART_TARGETING'        // (future) always fires at the highest-HP enemy in range
  // ── Collector branch ──────────────────────────────────────────────────────
  | 'KINETIC_HARVEST'        // (future) score pickups emit radiation damaging nearby enemies
  | 'DAMAGE_SCALES_WITH_SCORE' // (future) projectile damage increases with current score
  | 'ORBITAL_DRONES'         // (future) spawns orbiting combat drones when SP is spent
  // ── Legacy (not granted by any current node; kept for system compatibility) ─
  | 'INFINITE_PIERCE'        // projectile ignores collision — hits every enemy in path
  | 'PIERCING_1'             // passes through first enemy, stops on second
  | 'CHAIN_1'                // bounces to 1 additional enemy after first kill
  | 'EXPLOSIVE'              // AoE burst when projectile expires or is consumed
  | 'HOMING'                 // projectile gradually steers toward closest enemy
  | 'NOVA_BURST'             // fires 8 evenly-spaced projectiles per salvo
  | 'RAPID_BURST'            // tight 3-shot bursts with a gap between clusters
  | 'THORNS'                 // enemies that deal contact damage take reflected damage
  | 'CULL_THRESHOLD'         // enemies below 20% HP are instantly removed

// ─── Node tiers / branches ───────────────────────────────────────────────────

export type NodeTier = 'start' | 'small' | 'notable' | 'keystone'

export type BranchId =
  | 'start'
  | 'rapidFire'
  | 'heavyStrike'
  | 'bulwark'
  | 'warp'
  | 'chain'
  | 'collector'
  | 'junction'

// ─── Node effect & node ──────────────────────────────────────────────────────

/** A single numeric modifier granted when the node is active */
export interface NodeEffect {
  stat:  StatName
  value: number
}

/** A node in the skill tree graph */
export interface SkillNode {
  id:          string
  x:           number         // position in tree-space (px)
  y:           number
  tier:        NodeTier
  branch:      BranchId
  label:       string
  description: string
  connections: string[]       // IDs of adjacent nodes (bidirectional)
  cost:        number         // skill points to activate
  effects:     NodeEffect[]   // stat modifiers granted when active
  behaviors?:  BehaviorType[] // gameplay behaviour tags granted when active
}

// ─── Computed stats ───────────────────────────────────────────────────────────

/** Accumulated result of all active nodes — ready for ECS systems to consume */
export interface ComputedStats {
  // Additive pools (sum across active nodes; final stat = BASE × (1 + total))
  fireRateBonus:  number
  damageBonus:    number
  speedBonus:     number
  rangeBonus:     number
  maxHPBonus:     number
  armorFlat:      number
  scoreBonus:     number
  bonusSPPerWave: number
  multishotAdd:   number

  // Multiplicative pools (product of node values; 1.0 when no node contributes)
  fireRateMultiplier:    number
  damageMultiplier:      number
  maxHPMultiplier:       number
  damageTakenMultiplier: number
  scoreMultiplier:       number

  // Union of all behavior tags on active nodes
  behaviors: Set<BehaviorType>
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Always returns a fresh ComputedStats with correct defaults — never share the reference */
export function createDefaultStats(): ComputedStats {
  return {
    fireRateBonus:  0,
    damageBonus:    0,
    speedBonus:     0,
    rangeBonus:     0,
    maxHPBonus:     0,
    armorFlat:      0,
    scoreBonus:     0,
    bonusSPPerWave: 0,
    multishotAdd:   0,

    fireRateMultiplier:    1,
    damageMultiplier:      1,
    maxHPMultiplier:       1,
    damageTakenMultiplier: 1,
    scoreMultiplier:       1,

    behaviors: new Set<BehaviorType>(),
  }
}

/** @deprecated — use createDefaultStats() to avoid shared Set reference */
export const DEFAULT_STATS = createDefaultStats()

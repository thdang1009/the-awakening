// ---------------------------------------------------------------------------
// Skill Tree Store — singleton state manager
// ---------------------------------------------------------------------------

import type { ComputedStats, StatName, MultiplicativeStat } from './types'
import { createDefaultStats } from './types'
import { ALL_NODES, NODE_MAP, buildAdjacency } from './treeData'

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let _activeNodes: Set<string>  = new Set(['start'])
let _skillPoints: number       = 2
let _adjacency                 = buildAdjacency()
let _computedStats: ComputedStats = recomputeStats()

const _listeners: Array<() => void> = []

// ---------------------------------------------------------------------------
// Multiplicative stat set (used to decide += vs *=)
// ---------------------------------------------------------------------------

const MULTIPLICATIVE: ReadonlySet<MultiplicativeStat> = new Set([
  'fireRateMultiplier',
  'damageMultiplier',
  'maxHPMultiplier',
  'damageTakenMultiplier',
  'scoreMultiplier',
])

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function recomputeStats(): ComputedStats {
  const s = createDefaultStats()

  for (const id of _activeNodes) {
    const node = NODE_MAP.get(id)
    if (!node) continue

    for (const effect of node.effects) {
      if (MULTIPLICATIVE.has(effect.stat as MultiplicativeStat)) {
        // Multiplicative: accumulate by multiplication
        ;(s[effect.stat as MultiplicativeStat] as number) *= effect.value
      } else {
        // Additive: sum into the bonus pool
        ;(s[effect.stat as StatName] as number) += effect.value
      }
    }

    if (node.behaviors) {
      for (const b of node.behaviors) s.behaviors.add(b)
    }
  }

  // Clamp armor so it never zeroes all incoming damage
  s.armorFlat = Math.min(s.armorFlat, 0.85)
  return s
}

function notify(): void {
  for (const fn of _listeners) fn()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const SkillTreeStore = {
  get activeNodes(): ReadonlySet<string> { return _activeNodes },
  get skillPoints(): number              { return _skillPoints },
  get computedStats(): ComputedStats     { return _computedStats },

  /** Subscribe to any state change */
  onChange(fn: () => void): void {
    _listeners.push(fn)
  },

  isActive(id: string): boolean {
    return _activeNodes.has(id)
  },

  /**
   * True if the node is adjacent to at least one active node.
   * Does NOT check skill-point cost — use this to show the "can see but can't afford" state.
   */
  isReachable(id: string): boolean {
    if (_activeNodes.has(id)) return false
    const node = NODE_MAP.get(id)
    if (!node) return false
    const adj = _adjacency.get(id)
    return adj !== undefined && [...adj].some(n => _activeNodes.has(n))
  },

  /** True only when the node is reachable AND the player can afford it right now */
  canActivate(id: string): boolean {
    if (!this.isReachable(id)) return false
    const node = NODE_MAP.get(id)
    if (!node) return false
    return _skillPoints >= node.cost
  },

  activate(id: string): boolean {
    if (!this.canActivate(id)) return false
    _activeNodes.add(id)
    _skillPoints -= NODE_MAP.get(id)!.cost
    _computedStats = recomputeStats()
    notify()
    return true
  },

  addSkillPoints(n: number): void {
    _skillPoints += n
    notify()
  },

  /**
   * Replace active nodes with a decoded build.
   * All SP are treated as pre-spent (SP set to 0).
   */
  loadBuild(nodes: Set<string>): void {
    _activeNodes   = nodes
    _skillPoints   = 0
    _adjacency     = buildAdjacency()
    _computedStats = recomputeStats()
    notify()
  },

  /** Full reset — called on game restart */
  reset(): void {
    _activeNodes   = new Set(['start'])
    _skillPoints   = 2
    _adjacency     = buildAdjacency()
    _computedStats = recomputeStats()
    notify()
  },

  /** Human-readable description of a single node effect (for tooltips) */
  describeEffect(stat: StatName, value: number): string {
    const pct  = (v: number) => `+${Math.round(v * 100)}%`
    const xMul = (v: number) => `×${parseFloat(v.toFixed(2))}`
    switch (stat) {
      case 'fireRateBonus':        return `${pct(value)} Fire Rate`
      case 'damageBonus':          return `${pct(value)} Damage`
      case 'speedBonus':           return `${pct(value)} Projectile Speed`
      case 'rangeBonus':           return `${pct(value)} Range`
      case 'maxHPBonus':           return `${pct(value)} Max HP`
      case 'armorFlat':            return `+${Math.round(value * 100)}% Damage Reduction`
      case 'scoreBonus':           return `${pct(value)} Score`
      case 'bonusSPPerWave':       return `+${value} Skill Point/Wave`
      case 'multishotAdd':         return `+${value} Projectile`
      case 'fireRateMultiplier':   return `${xMul(value)} Fire Rate`
      case 'damageMultiplier':     return `${xMul(value)} Damage`
      case 'maxHPMultiplier':      return `${xMul(value)} Max HP`
      case 'damageTakenMultiplier':
        return value < 1
          ? `−${Math.round((1 - value) * 100)}% Damage Taken`
          : `${xMul(value)} Damage Taken`
      case 'scoreMultiplier':      return `${xMul(value)} Score per Kill`
      default:                     return `+${value}`
    }
  },

  get allNodes() { return ALL_NODES },
}

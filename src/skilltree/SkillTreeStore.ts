// ---------------------------------------------------------------------------
// Skill Tree Store — singleton state manager
// ---------------------------------------------------------------------------

import type { ComputedStats, StatKey } from './types'
import { DEFAULT_STATS } from './types'
import { ALL_NODES, NODE_MAP, buildAdjacency } from './treeData'

// State (module-level singleton — persists across wave restarts)
let _activeNodes = new Set<string>(['start'])
let _skillPoints = 2   // Start with 2 free points to immediately engage
let _adjacency = buildAdjacency()
let _computedStats: ComputedStats = recomputeStats()

// Listeners called when anything changes (for UI refresh)
const _listeners: Array<() => void> = []

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function recomputeStats(): ComputedStats {
  const s: ComputedStats = { ...DEFAULT_STATS }
  for (const id of _activeNodes) {
    const node = NODE_MAP.get(id)
    if (!node) continue
    for (const effect of node.effects) {
      (s[effect.stat as StatKey] as number) += effect.value
    }
    if (node.keystoneId) {
      (s[node.keystoneId] as boolean) = true
    }
  }
  // Clamp armor so it never reaches 1.0 (would zero all damage)
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
  get skillPoints(): number { return _skillPoints },
  get computedStats(): ComputedStats { return _computedStats },

  /** Subscribe to any state change (node activated, SP changed) */
  onChange(fn: () => void): void {
    _listeners.push(fn)
  },

  /** True if the node is currently active */
  isActive(id: string): boolean {
    return _activeNodes.has(id)
  },

  /**
   * True if:
   *  - node is not already active
   *  - player has enough SP
   *  - at least one adjacent node is active
   */
  canActivate(id: string): boolean {
    if (_activeNodes.has(id)) return false
    const node = NODE_MAP.get(id)
    if (!node) return false
    if (_skillPoints < node.cost) return false
    const adj = _adjacency.get(id)
    return adj !== undefined && [...adj].some(n => _activeNodes.has(n))
  },

  /** Attempt to activate a node. Returns true on success. */
  activate(id: string): boolean {
    if (!this.canActivate(id)) return false
    _activeNodes.add(id)
    _skillPoints -= NODE_MAP.get(id)!.cost
    _computedStats = recomputeStats()
    notify()
    return true
  },

  /** Award skill points (called on wave clear) */
  addSkillPoints(n: number): void {
    _skillPoints += n
    notify()
  },

  /** Full reset — called on game restart */
  reset(): void {
    _activeNodes = new Set(['start'])
    _skillPoints = 2
    _adjacency = buildAdjacency()
    _computedStats = recomputeStats()
    notify()
  },

  /**
   * Returns a human-readable description of a computed stats delta.
   * Used to build the "stats preview" in the tooltip.
   */
  describeEffect(stat: StatKey, value: number): string {
    const pct = (v: number) => `+${Math.round(v * 100)}%`
    switch (stat) {
      case 'fireRateBonus':  return `${pct(value)} Fire Rate`
      case 'damageBonus':    return `${pct(value)} Damage`
      case 'speedBonus':     return `${pct(value)} Projectile Speed`
      case 'rangeBonus':     return `${pct(value)} Range`
      case 'maxHPBonus':     return `${pct(value)} Max HP`
      case 'armorFlat':      return `+${Math.round(value * 100)}% Damage Reduction`
      case 'scoreBonus':     return `${pct(value)} Score`
      case 'bonusSPPerWave': return `+${value} Skill Point/Wave`
      case 'multishotAdd':   return `+${value} Projectile`
      default:               return `+${value}`
    }
  },

  /** All nodes available for the UI to iterate */
  get allNodes() { return ALL_NODES },
}

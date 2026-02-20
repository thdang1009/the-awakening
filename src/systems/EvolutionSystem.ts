// ---------------------------------------------------------------------------
// EvolutionSystem — Phase 4: 1-to-1 Keystone + Catalyst lock-and-key
// ---------------------------------------------------------------------------
// Each frame this system checks whether a player has both the maxed keystone
// (skill branch keystone node active) and the matching Passive Catalyst in
// their inventory.  When both conditions are met for the first time, the
// corresponding Evolution Behavior is injected into world.stats.behaviors,
// the evolution is recorded in world.evolutions, and a pending notification
// is set so Game.ts can display the unlock banner.
//
// Evolution recipes (MASTER_DOC Appendix A):
//   rf_key  + graviton_lens      → QUASAR_BEAM
//   hs_key  + uranium_core       → TECTONIC_DETONATOR
//   bw_key  + exo_casing         → AEGIS_FORTRESS
//   wp_key  + overclock_chip     → VOID_SINGULARITY
//   ch_key  + replicator_matrix  → STORM_NETWORK
//   co_key  + hyper_coolant      → QUANTUM_HARVESTER
// ---------------------------------------------------------------------------

import { GameWorld } from '../ecs/world'
import { SkillTreeStore } from '../skilltree/SkillTreeStore'
import type { BehaviorType } from '../skilltree/types'

// ---------------------------------------------------------------------------
// Evolution recipe definition
// ---------------------------------------------------------------------------

interface EvolutionRecipe {
  /** Internal ID used in world.evolutions Set */
  id: string
  /** Display name shown in the unlock banner */
  displayName: string
  /** Keystone node ID that must be active in the skill tree */
  keystoneId: string
  /** Catalyst item ID that must be in world.catalysts inventory */
  catalystId: string
  /** Behavior tag injected into world.stats.behaviors on unlock */
  behavior: BehaviorType
}

const EVOLUTION_RECIPES: EvolutionRecipe[] = [
  {
    id: 'quasar_beam',
    displayName: 'QUASAR BEAM',
    keystoneId: 'rf_key',
    catalystId: 'graviton_lens',
    behavior: 'QUASAR_BEAM',
  },
  {
    id: 'tectonic_detonator',
    displayName: 'TECTONIC DETONATOR',
    keystoneId: 'hs_key',
    catalystId: 'uranium_core',
    behavior: 'TECTONIC_DETONATOR',
  },
  {
    id: 'aegis_fortress',
    displayName: 'AEGIS FORTRESS',
    keystoneId: 'bw_key',
    catalystId: 'exo_casing',
    behavior: 'AEGIS_FORTRESS',
  },
  {
    id: 'void_singularity',
    displayName: 'VOID SINGULARITY',
    keystoneId: 'wp_key',
    catalystId: 'overclock_chip',
    behavior: 'VOID_SINGULARITY',
  },
  {
    id: 'storm_network',
    displayName: 'STORM NETWORK',
    keystoneId: 'ch_key',
    catalystId: 'replicator_matrix',
    behavior: 'STORM_NETWORK',
  },
  {
    id: 'quantum_harvester',
    displayName: 'QUANTUM HARVESTER',
    keystoneId: 'co_key',
    catalystId: 'hyper_coolant',
    behavior: 'QUANTUM_HARVESTER',
  },
]

// Public lookup — other systems (e.g. UI) can read the recipe list.
export { EVOLUTION_RECIPES }
export type { EvolutionRecipe }

// ---------------------------------------------------------------------------
// Main system — call once per frame from Game.ts (before other systems)
// ---------------------------------------------------------------------------

export function evolutionSystem(world: GameWorld): void {
  if (world.gameOver) return

  const activeNodes = SkillTreeStore.activeNodes

  for (const recipe of EVOLUTION_RECIPES) {
    // Already unlocked — re-inject the behavior in case stats were recomputed
    if (world.evolutions.has(recipe.id)) {
      world.stats.behaviors.add(recipe.behavior)
      continue
    }

    // Check conditions
    const keystoneActive = activeNodes.has(recipe.keystoneId)
    const catalystOwned  = world.catalysts.includes(recipe.catalystId)

    if (keystoneActive && catalystOwned) {
      // First-time unlock
      world.evolutions.add(recipe.id)
      world.stats.behaviors.add(recipe.behavior)
      world.pendingEvolutionName = recipe.displayName
    }
  }
}

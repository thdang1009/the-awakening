import { createWorld } from 'bitecs'
import type { ComputedStats } from '../skilltree/types'
import { DEFAULT_STATS } from '../skilltree/types'

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
}

export function createGameWorld(): GameWorld {
  const world = createWorld() as GameWorld
  world.delta = 0
  world.elapsed = 0
  world.nexusEid = -1
  world.gameOver = false
  world.paused = false
  world.wave = 0
  world.score = 0
  world.stats = { ...DEFAULT_STATS }
  return world
}

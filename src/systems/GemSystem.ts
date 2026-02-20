// ---------------------------------------------------------------------------
// GemSystem — Experience Gem drops, magnet logic, and XP collection
// ---------------------------------------------------------------------------
// Gems are spawned into the ECS world from pendingGems (queued by
// CollisionSystem / AuraSystem / BombSystem on enemy death).
// Each frame:
//   1. Consume pendingGems → spawn gem entities in the ECS
//   2. Magnetise gems within pickupRadius → accelerate toward Nexus
//   3. Collect gems overlapping the Nexus → award XP, trigger level-up flag
// ---------------------------------------------------------------------------

import { addComponent, addEntity, defineQuery, removeEntity } from 'bitecs'
import {
  Position, Velocity, Renderable, Collider, ExperienceGem,
} from '../ecs/components'
import { GameWorld } from '../ecs/world'
import {
  TextureId, GEM_XP_VALUE, GEM_RADIUS, GEM_ATTRACT_SPEED,
  XP_BASE, XP_SCALE,
} from '../constants'

const gemQuery = defineQuery([ExperienceGem, Position, Velocity, Collider])

// ---------------------------------------------------------------------------
// Spawn a single gem entity at world position (ox, oy)
// ---------------------------------------------------------------------------
function spawnGem(world: GameWorld, ox: number, oy: number): void {
  const eid = addEntity(world)

  addComponent(world, Position, eid)
  // Scatter gems with a small random offset so they don't all stack
  Position.x[eid] = ox + (Math.random() - 0.5) * 20
  Position.y[eid] = oy + (Math.random() - 0.5) * 20

  addComponent(world, Velocity, eid)
  Velocity.x[eid] = 0
  Velocity.y[eid] = 0

  addComponent(world, Collider, eid)
  Collider.radius[eid] = GEM_RADIUS

  addComponent(world, ExperienceGem, eid)
  ExperienceGem.value[eid]      = GEM_XP_VALUE
  ExperienceGem.attracting[eid] = 0

  addComponent(world, Renderable, eid)
  Renderable.textureId[eid] = TextureId.Gem
  Renderable.tint[eid]      = 0x00ffaa
  Renderable.scale[eid]     = 1.0
}

// ---------------------------------------------------------------------------
// Main system
// ---------------------------------------------------------------------------
export function gemSystem(world: GameWorld): void {
  if (world.gameOver || world.paused) return

  const dt    = world.delta
  const neid  = world.nexusEid
  if (neid < 0) return

  // 1. Consume pending gem spawn requests
  while (world.pendingGems.length > 0) {
    const pos = world.pendingGems.pop()!
    spawnGem(world, pos.x, pos.y)
  }

  const nx = Position.x[neid]
  const ny = Position.y[neid]
  const pickupR  = world.pickupRadius
  const pickupR2 = pickupR * pickupR
  const collectR = GEM_RADIUS + 18   // slightly larger than GEM_RADIUS so collection feels good

  const toCollect: number[] = []

  // 2. Magnet + collection check
  const gems = gemQuery(world)
  for (let i = 0; i < gems.length; i++) {
    const geid = gems[i]
    const gx = Position.x[geid]
    const gy = Position.y[geid]
    const dx = nx - gx
    const dy = ny - gy
    const distSq = dx * dx + dy * dy

    // Within collect radius → mark for collection
    if (distSq <= collectR * collectR) {
      toCollect.push(geid)
      continue
    }

    // Within pickup radius → magnetise (accelerate toward Nexus)
    if (distSq <= pickupR2) {
      ExperienceGem.attracting[geid] = 1
    }

    if (ExperienceGem.attracting[geid] === 1) {
      const dist = Math.sqrt(distSq)
      if (dist > 0.1) {
        Velocity.x[geid] = (dx / dist) * GEM_ATTRACT_SPEED
        Velocity.y[geid] = (dy / dist) * GEM_ATTRACT_SPEED
      }
    }
  }

  // 3. Collect gems — award XP and remove entities
  for (const geid of toCollect) {
    const xpVal = ExperienceGem.value[geid]
    world.xp         += xpVal
    world.xpCollected += xpVal   // Phase 4: lifetime XP counter for drone spawn triggers
    removeEntity(world, geid)
  }

  // 4. Level-up check
  while (world.xp >= world.xpToNextLevel) {
    world.xp -= world.xpToNextLevel
    world.level++
    world.xpToNextLevel = XP_BASE + (world.level - 1) * XP_SCALE
    world.pendingLevelUp = true
  }
}

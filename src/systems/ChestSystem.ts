// ---------------------------------------------------------------------------
// ChestSystem — Golden Chest spawn, float animation, and collection
// ---------------------------------------------------------------------------
// Consumes world.pendingChests to spawn GoldenChest entities in the ECS.
// Each frame: animate chests (bob + rotate), detect Nexus overlap → collect.
// ---------------------------------------------------------------------------

import { addComponent, addEntity, defineQuery, removeEntity } from 'bitecs'
import { Position, Renderable, GoldenChest, IsNexus, Collider } from '../ecs/components'
import { GameWorld } from '../ecs/world'
import { TextureId, CHEST_RADIUS } from '../constants'

const chestQuery = defineQuery([GoldenChest, Position, Renderable])
const nexusQuery = defineQuery([IsNexus, Position, Collider])

export function chestSystem(world: GameWorld): void {
  if (world.gameOver || world.paused) return

  // 1. Spawn queued chests
  while (world.pendingChests.length > 0) {
    const pos = world.pendingChests.pop()!
    const eid = addEntity(world)

    addComponent(world, Position, eid)
    Position.x[eid] = pos.x
    Position.y[eid] = pos.y

    addComponent(world, GoldenChest, eid)

    addComponent(world, Collider, eid)
    Collider.radius[eid] = CHEST_RADIUS

    addComponent(world, Renderable, eid)
    Renderable.textureId[eid] = TextureId.Chest
    Renderable.tint[eid]      = 0xffd700
    Renderable.scale[eid]     = 1.0
  }

  // 2. Bob animation
  const chests = chestQuery(world)
  for (let i = 0; i < chests.length; i++) {
    const ceid = chests[i]
    Renderable.scale[ceid] = 1.0 + Math.sin(world.elapsed * 4 + ceid) * 0.12
  }

  // 3. Nexus overlap check → trigger roulette
  const nexii = nexusQuery(world)
  if (nexii.length === 0) return
  const neid = nexii[0]
  const nx   = Position.x[neid]
  const ny   = Position.y[neid]
  const nr   = Collider.radius[neid]

  for (let i = 0; i < chests.length; i++) {
    const ceid = chests[i]
    const dx   = nx - Position.x[ceid]
    const dy   = ny - Position.y[ceid]
    const rSum = nr + CHEST_RADIUS
    if (dx * dx + dy * dy > rSum * rSum) continue

    // Collected — trigger roulette and remove chest
    removeEntity(world, ceid)
    world.pendingRoulette = true
    break   // one chest per frame is enough
  }
}

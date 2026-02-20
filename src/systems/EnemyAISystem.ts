import { defineQuery } from 'bitecs'
import { Position, Velocity, Enemy } from '../ecs/components'
import { GameWorld } from '../ecs/world'

const enemyQuery = defineQuery([Position, Velocity, Enemy])

/**
 * Steer every enemy toward the Nexus.
 * Sets velocity to (normalised direction) * speed.
 */
export function enemyAISystem(world: GameWorld): void {
  if (world.paused) return
  const nexusEid = world.nexusEid
  if (nexusEid < 0) return

  const nx = Position.x[nexusEid]
  const ny = Position.y[nexusEid]

  const entities = enemyQuery(world)
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]
    const dx = nx - Position.x[eid]
    const dy = ny - Position.y[eid]
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.1) continue

    const speed = Enemy.speed[eid] * world.buffs.enemySpeedMult
    Velocity.x[eid] = (dx / dist) * speed
    Velocity.y[eid] = (dy / dist) * speed
  }
}

import { defineQuery } from 'bitecs'
import { Position, Velocity } from '../ecs/components'
import { GameWorld } from '../ecs/world'

const movableQuery = defineQuery([Position, Velocity])

/** Integrate velocity into position each frame */
export function movementSystem(world: GameWorld): void {
  if (world.paused) return
  const dt = world.delta
  const entities = movableQuery(world)
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]
    Position.x[eid] += Velocity.x[eid] * dt
    Position.y[eid] += Velocity.y[eid] * dt
  }
}

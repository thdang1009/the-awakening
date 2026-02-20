import { defineQuery, removeEntity } from 'bitecs'
import { Projectile } from '../ecs/components'
import { GameWorld } from '../ecs/world'

const projectileQuery = defineQuery([Projectile])

/** Remove projectiles that have exceeded their lifetime */
export function lifetimeSystem(world: GameWorld): void {
  if (world.paused) return
  const dt = world.delta
  const entities = projectileQuery(world)
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]
    Projectile.elapsed[eid] += dt
    if (Projectile.elapsed[eid] >= Projectile.lifetime[eid]) {
      removeEntity(world, eid)
    }
  }
}

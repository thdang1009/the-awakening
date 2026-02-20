import { addComponent, addEntity, defineQuery, removeEntity } from 'bitecs'
import { Projectile, Position, Blackhole, Renderable } from '../ecs/components'
import { GameWorld } from '../ecs/world'
import { TextureId } from '../constants'

const projectileQuery = defineQuery([Projectile, Position])

/** Advance projectile lifetimes; spawn blackholes on expiry when EVENT HORIZON is active */
export function lifetimeSystem(world: GameWorld): void {
  if (world.paused) return
  const dt = world.delta
  const spawnBH = world.stats.behaviors.has('SPAWN_BLACKHOLE')

  const entities = projectileQuery(world)
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]
    Projectile.elapsed[eid] += dt
    if (Projectile.elapsed[eid] < Projectile.lifetime[eid]) continue

    // ── EVENT HORIZON: leave a gravity well at the projectile's final position ──
    if (spawnBH) {
      const bid = addEntity(world)
      addComponent(world, Position, bid)
      Position.x[bid] = Position.x[eid]
      Position.y[bid] = Position.y[eid]
      addComponent(world, Blackhole, bid)
      Blackhole.timer[bid]  = 2.5
      Blackhole.radius[bid] = 190
      addComponent(world, Renderable, bid)
      Renderable.textureId[bid] = TextureId.Blackhole
      Renderable.tint[bid]      = 0xbb00ff
      Renderable.scale[bid]     = 1.0
    }

    removeEntity(world, eid)
  }
}

// ---------------------------------------------------------------------------
// BlackholeSystem — SPAWN_BLACKHOLE + MAGNETIC_PULL (wp_key: EVENT HORIZON)
// ---------------------------------------------------------------------------
// Gravity well entities created when projectiles expire at max range.
// Each well pulls all nearby enemies inward and pulses visually.
// ---------------------------------------------------------------------------

import { defineQuery, removeEntity } from 'bitecs'
import { Position, Blackhole, Enemy, Health, Renderable } from '../ecs/components'
import { GameWorld } from '../ecs/world'

const blackholeQuery = defineQuery([Blackhole, Position])
const enemyQuery     = defineQuery([Enemy, Position, Health])

const PULL_STRENGTH = 140   // px/s toward the singularity centre

export function blackholeSystem(world: GameWorld): void {
  if (world.gameOver || world.paused) return

  const dt          = world.delta
  const isVoid      = world.stats.behaviors.has('VOID_SINGULARITY')
  const pullStrength = isVoid ? PULL_STRENGTH * 2.0 : PULL_STRENGTH
  const bhs = blackholeQuery(world)

  for (let i = 0; i < bhs.length; i++) {
    const bhid = bhs[i]
    Blackhole.timer[bhid] -= dt

    if (Blackhole.timer[bhid] <= 0) {
      removeEntity(world, bhid)
      continue
    }

    // Pulsing scale — void singularity is larger and more dramatic
    if (Blackhole.timer[bhid] > 0) {
      const pulse = 1.0 + Math.sin(world.elapsed * 6) * 0.2
      Renderable.scale[bhid] = isVoid ? pulse * 2.0 : pulse
    }

    const bhx    = Position.x[bhid]
    const bhy    = Position.y[bhid]
    // VOID_SINGULARITY: double pull radius
    const radius  = Blackhole.radius[bhid] * (isVoid ? 2.0 : 1.0)
    const rSq    = radius ** 2
    const enemies = enemyQuery(world)

    for (let j = 0; j < enemies.length; j++) {
      const eid = enemies[j]
      const dx  = bhx - Position.x[eid]
      const dy  = bhy - Position.y[eid]
      if (dx * dx + dy * dy > rSq) continue

      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) continue

      // Pull enemy toward the singularity
      Position.x[eid] += (dx / dist) * pullStrength * dt
      Position.y[eid] += (dy / dist) * pullStrength * dt
    }
  }
}

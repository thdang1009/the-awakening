// ---------------------------------------------------------------------------
// BombSystem — DELAYED_EXPLOSION (hs_key: TECTONIC CRATER)
// ---------------------------------------------------------------------------
// Timed bomb entities planted at projectile impact points.
// They pulse visually and then explode in an AoE, applying KNOCKBACK to
// all enemies in range.
// ---------------------------------------------------------------------------

import { defineQuery, hasComponent, removeEntity } from 'bitecs'
import { Position, Bomb, Health, Enemy, Renderable } from '../ecs/components'
import { GameWorld } from '../ecs/world'

const bombQuery  = defineQuery([Bomb, Position])
const enemyQuery = defineQuery([Enemy, Position, Health])

const INITIAL_TIMER = 0.75   // must match what CollisionSystem sets

export function bombSystem(world: GameWorld): void {
  if (world.gameOver || world.paused) return

  const dt    = world.delta
  const { stats } = world
  const spk   = Math.floor(10 * (1 + stats.scoreBonus) * stats.scoreMultiplier)
  const bombs = bombQuery(world)

  for (let i = 0; i < bombs.length; i++) {
    const bid = bombs[i]
    Bomb.timer[bid] -= dt

    // Pulse scale as countdown warning (small → large)
    if (hasComponent(world, Renderable, bid)) {
      const frac = 1 - Math.max(0, Bomb.timer[bid]) / INITIAL_TIMER
      Renderable.scale[bid] = 0.4 + frac * 1.8
      // Shift tint from orange to white-hot as it approaches detonation
      const r = 0xff
      const g = Math.floor(0x66 + frac * (0xff - 0x66))
      Renderable.tint[bid] = (r << 16) | (g << 8) | 0x00
    }

    if (Bomb.timer[bid] > 0) continue

    // ── DETONATE ──────────────────────────────────────────────────────────
    const bx     = Position.x[bid]
    const by     = Position.y[bid]
    const dmg    = Bomb.damage[bid]
    const radius = Bomb.radius[bid]
    const rSq    = radius * radius
    const enemies = enemyQuery(world)

    for (let j = 0; j < enemies.length; j++) {
      const eid = enemies[j]
      const dx  = Position.x[eid] - bx
      const dy  = Position.y[eid] - by
      if (dx * dx + dy * dy > rSq) continue

      // KNOCKBACK from explosion centre
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 0) {
        const kb = 110
        Position.x[eid] += (dx / dist) * kb
        Position.y[eid] += (dy / dist) * kb
      }

      Health.current[eid] -= dmg
      if (Health.current[eid] <= 0) {
        world.score += spk
        if (Enemy.splitsOnDeath[eid] === 1) {
          world.pendingSplits.push({ x: Position.x[eid], y: Position.y[eid] })
        }
        removeEntity(world, eid)
      }
    }

    removeEntity(world, bid)
  }
}

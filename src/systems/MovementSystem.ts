import { defineQuery, hasComponent } from 'bitecs'
import { Position, Velocity, Enemy, Health, Projectile, Seeker, Boomerang, IsNexus } from '../ecs/components'
import { GameWorld } from '../ecs/world'
import type { InputManager } from '../input/InputManager'
import { NEXUS_MOVE_SPEED, NEXUS_ACCELERATION, NEXUS_FRICTION } from '../constants'

const movableQuery   = defineQuery([Position, Velocity])
const seekerQuery    = defineQuery([Seeker, Projectile, Position, Velocity])
const boomerangQuery = defineQuery([Boomerang, Projectile, Position, Velocity])
const enemyQuery     = defineQuery([Enemy, Position, Health])

const SEEKER_TURN_RATE = Math.PI * 2.0   // radians/s max turn speed

function findNearestEnemyPos(world: GameWorld, ox: number, oy: number): { x: number; y: number } | null {
  const enemies = enemyQuery(world)
  let best = -1, bestSq = Infinity
  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i]
    const dx = Position.x[eid] - ox, dy = Position.y[eid] - oy
    const d2 = dx * dx + dy * dy
    if (d2 < bestSq) { bestSq = d2; best = eid }
  }
  return best < 0 ? null : { x: Position.x[best], y: Position.y[best] }
}

/** Integrate velocity into position, then apply SEEKER/BOOMERANG steering */
export function movementSystem(world: GameWorld, input: InputManager): void {
  if (world.paused) return
  const dt = world.delta

  // ── Nexus player movement ─────────────────────────────────────────────────
  const neid = world.nexusEid
  if (neid >= 0 && hasComponent(world, IsNexus, neid)) {
    const dir = input.getMovementVector()
    const maxSpd = NEXUS_MOVE_SPEED * world.moveSpeedMult

    if (dir.x !== 0 || dir.y !== 0) {
      // Accelerate toward input direction
      Velocity.x[neid] += dir.x * NEXUS_ACCELERATION * dt
      Velocity.y[neid] += dir.y * NEXUS_ACCELERATION * dt

      // Clamp to max speed
      const spd = Math.sqrt(Velocity.x[neid] ** 2 + Velocity.y[neid] ** 2)
      if (spd > maxSpd) {
        const scale = maxSpd / spd
        Velocity.x[neid] *= scale
        Velocity.y[neid] *= scale
      }
    } else {
      // Apply friction when no input
      const decay = Math.exp(-NEXUS_FRICTION * dt)
      Velocity.x[neid] *= decay
      Velocity.y[neid] *= decay
    }
  }

  // ── Standard movement ─────────────────────────────────────────────────────
  const entities = movableQuery(world)
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]
    Position.x[eid] += Velocity.x[eid] * dt
    Position.y[eid] += Velocity.y[eid] * dt
  }

  // ── SEEKER: steer projectiles toward nearest enemy ────────────────────────
  const seekers = seekerQuery(world)
  for (let i = 0; i < seekers.length; i++) {
    const eid    = seekers[i]
    const target = findNearestEnemyPos(world, Position.x[eid], Position.y[eid])
    if (!target) continue

    const dx = target.x - Position.x[eid]
    const dy = target.y - Position.y[eid]
    const targetAngle  = Math.atan2(dy, dx)
    const currentAngle = Math.atan2(Velocity.y[eid], Velocity.x[eid])
    const speed        = Math.sqrt(Velocity.x[eid] ** 2 + Velocity.y[eid] ** 2)

    let diff = targetAngle - currentAngle
    if (diff >  Math.PI) diff -= 2 * Math.PI
    if (diff < -Math.PI) diff += 2 * Math.PI

    const turn      = Math.max(-SEEKER_TURN_RATE * dt, Math.min(SEEKER_TURN_RATE * dt, diff))
    const newAngle  = currentAngle + turn
    Velocity.x[eid] = Math.cos(newAngle) * speed
    Velocity.y[eid] = Math.sin(newAngle) * speed
  }

  // ── BOOMERANG: redirect toward Nexus after 45% of lifetime ───────────────
  if (neid < 0) return
  const bx = Position.x[neid]
  const by = Position.y[neid]

  const spawnBH = world.stats.behaviors.has('SPAWN_BLACKHOLE')

  const booms = boomerangQuery(world)
  for (let i = 0; i < booms.length; i++) {
    const eid = booms[i]
    const pivot = Projectile.lifetime[eid] * 0.45

    // Record apex for Event Horizon at the moment the boomerang pivots
    if (spawnBH && Projectile.apexSet[eid] === 0 && Projectile.elapsed[eid] >= pivot) {
      Projectile.apexX[eid]  = Position.x[eid]
      Projectile.apexY[eid]  = Position.y[eid]
      Projectile.apexSet[eid] = 1
    }

    if (Projectile.elapsed[eid] < pivot) continue

    const dx   = bx - Position.x[eid]
    const dy   = by - Position.y[eid]
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) continue

    const speed     = Math.sqrt(Velocity.x[eid] ** 2 + Velocity.y[eid] ** 2)
    Velocity.x[eid] = (dx / dist) * speed
    Velocity.y[eid] = (dy / dist) * speed
  }
}

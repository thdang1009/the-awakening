import { defineQuery, hasComponent, removeEntity } from 'bitecs'
import {
  Position, Collider, Enemy, Projectile, Health, IsNexus, PassThrough,
} from '../ecs/components'
import { GameWorld } from '../ecs/world'
import { SpatialHashGrid } from '../utils/SpatialHashGrid'
import { SPATIAL_CELL_SIZE } from '../constants'

const enemyQuery     = defineQuery([Enemy, Position, Collider, Health])
const projectileQuery = defineQuery([Projectile, Position, Collider])
const nexusQuery     = defineQuery([IsNexus, Position, Collider, Health])

const grid = new SpatialHashGrid(SPATIAL_CELL_SIZE)

function overlaps(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx
  const dy = ay - by
  const rSum = ar + br
  return dx * dx + dy * dy <= rSum * rSum
}

export function collisionSystem(world: GameWorld): void {
  if (world.gameOver || world.paused) return

  const { stats } = world
  // Score per kill: additive bonus pool × multiplicative product (scoreMultiplier handles OMNISCIENT)
  const scorePerKill = Math.floor(10 * (1 + stats.scoreBonus) * stats.scoreMultiplier)
  // Incoming damage: reduced by armor flat reduction × damageTakenMultiplier (handles INDESTRUCTIBLE CORE)
  const damageMult = Math.max(0.1, (1 - stats.armorFlat) * stats.damageTakenMultiplier)

  // --- Rebuild spatial grid with all enemies ---
  grid.clear()
  const enemies = enemyQuery(world)
  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i]
    grid.insert(eid, Position.x[eid], Position.y[eid], Collider.radius[eid])
  }

  // --- Projectile vs Enemy ---
  const deadEnemies     = new Set<number>()
  const deadProjectiles = new Set<number>()

  const projectiles = projectileQuery(world)
  for (let i = 0; i < projectiles.length; i++) {
    const peid = projectiles[i]
    if (deadProjectiles.has(peid)) continue

    const px = Position.x[peid]
    const py = Position.y[peid]
    const pr = Collider.radius[peid]
    const isPassThrough = hasComponent(world, PassThrough, peid)

    const candidates = grid.queryCircle(px, py, pr)
    for (const eeid of candidates) {
      if (deadEnemies.has(eeid)) continue
      if (!overlaps(px, py, pr, Position.x[eeid], Position.y[eeid], Collider.radius[eeid])) continue

      // Deal damage to enemy
      Health.current[eeid] -= Projectile.damage[peid]
      if (Health.current[eeid] <= 0) {
        deadEnemies.add(eeid)
        world.score += scorePerKill
        // Splitter: schedule 2 mini-enemy fragments at death position
        if (Enemy.splitsOnDeath[eeid] === 1) {
          world.pendingSplits.push({ x: Position.x[eeid], y: Position.y[eeid] })
        }
      }

      if (!isPassThrough) {
        // Normal projectile: consumed on first hit
        deadProjectiles.add(peid)
        break
      }
      // PassThrough: keep going, hit more enemies (breaks inner loop per candidate only)
    }
  }

  for (const eid of deadEnemies)     removeEntity(world, eid)
  for (const eid of deadProjectiles) removeEntity(world, eid)

  // --- Enemy vs Nexus (contact damage, cooldown-gated) ---
  const nexii = nexusQuery(world)
  if (nexii.length === 0) return
  const neid = nexii[0]
  const nx   = Position.x[neid]
  const ny   = Position.y[neid]
  const nr   = Collider.radius[neid]

  const now = performance.now()
  const livingEnemies = enemyQuery(world)
  for (let i = 0; i < livingEnemies.length; i++) {
    const eeid = livingEnemies[i]
    if (!overlaps(nx, ny, nr, Position.x[eeid], Position.y[eeid], Collider.radius[eeid])) continue

    const cooldownMs = Enemy.attackCooldown[eeid] * 1000
    if (now - Enemy.lastAttack[eeid] < cooldownMs) continue

    Enemy.lastAttack[eeid] = now
    const rawDmg = Enemy.damage[eeid]
    Health.current[neid] -= rawDmg * damageMult

    if (Health.current[neid] <= 0) {
      Health.current[neid] = 0
      world.gameOver = true
    }
  }
}

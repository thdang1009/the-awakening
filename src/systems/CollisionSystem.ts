import { addComponent, addEntity, defineQuery, hasComponent, removeEntity } from 'bitecs'
import {
  Position, Collider, Enemy, Projectile, Health, IsNexus, PassThrough,
  Bomb, Renderable,
} from '../ecs/components'
import { GameWorld } from '../ecs/world'
import { SpatialHashGrid } from '../utils/SpatialHashGrid'
import { SPATIAL_CELL_SIZE, TextureId } from '../constants'

const enemyQuery      = defineQuery([Enemy, Position, Collider, Health])
const projectileQuery = defineQuery([Projectile, Position, Collider])
const nexusQuery      = defineQuery([IsNexus, Position, Collider, Health])

const grid = new SpatialHashGrid(SPATIAL_CELL_SIZE)

function overlaps(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx, dy = ay - by, r = ar + br
  return dx * dx + dy * dy <= r * r
}

function scorePerKillFor(world: GameWorld): number {
  const { stats } = world
  return Math.floor(10 * (1 + stats.scoreBonus) * stats.scoreMultiplier)
}

// ---------------------------------------------------------------------------
// Post-kill effect sources collected during the projectile loop
// ---------------------------------------------------------------------------
interface KillPos { x: number; y: number; dmg: number }

export function collisionSystem(world: GameWorld): void {
  if (world.gameOver || world.paused) return

  const { stats } = world
  const spk       = scorePerKillFor(world)
  const damageMult = Math.max(0.1, (1 - stats.armorFlat) * stats.damageTakenMultiplier)

  // ── Rebuild spatial grid ─────────────────────────────────────────────────
  grid.clear()
  const enemies = enemyQuery(world)
  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i]
    grid.insert(eid, Position.x[eid], Position.y[eid], Collider.radius[eid])
  }

  const deadEnemies     = new Set<number>()
  const deadProjectiles = new Set<number>()
  const chainSources:   KillPos[] = []   // CHAIN_LIGHTNING arcs
  const harvestSources: KillPos[] = []   // KINETIC_HARVEST pulses

  // ── Projectile vs Enemy ──────────────────────────────────────────────────
  const projectiles = projectileQuery(world)
  for (let i = 0; i < projectiles.length; i++) {
    const peid = projectiles[i]
    if (deadProjectiles.has(peid)) continue

    const px = Position.x[peid], py = Position.y[peid], pr = Collider.radius[peid]
    const isPassThrough = hasComponent(world, PassThrough, peid)
    const pdmg = Projectile.damage[peid]

    const candidates = grid.queryCircle(px, py, pr)
    for (const eeid of candidates) {
      if (deadEnemies.has(eeid)) continue
      if (!overlaps(px, py, pr, Position.x[eeid], Position.y[eeid], Collider.radius[eeid])) continue

      // ── KNOCKBACK: push enemy away from Nexus ─────────────────────────
      if (stats.behaviors.has('KNOCKBACK')) {
        const nx = Position.x[world.nexusEid], ny = Position.y[world.nexusEid]
        const kx = Position.x[eeid] - nx, ky = Position.y[eeid] - ny
        const kd = Math.sqrt(kx * kx + ky * ky)
        if (kd > 0) {
          Position.x[eeid] += (kx / kd) * 90
          Position.y[eeid] += (ky / kd) * 90
        }
      }

      // ── Deal damage ───────────────────────────────────────────────────
      Health.current[eeid] -= pdmg
      if (Health.current[eeid] <= 0) {
        deadEnemies.add(eeid)
        world.score += spk
        world.pendingGems.push({ x: Position.x[eeid], y: Position.y[eeid] })

        if (stats.behaviors.has('CHAIN_LIGHTNING')) {
          chainSources.push({ x: Position.x[eeid], y: Position.y[eeid], dmg: pdmg * 0.55 })
        }
        if (stats.behaviors.has('KINETIC_HARVEST')) {
          harvestSources.push({ x: Position.x[eeid], y: Position.y[eeid], dmg: pdmg * 0.8 })
        }
        if (Enemy.splitsOnDeath[eeid] === 1) {
          world.pendingSplits.push({ x: Position.x[eeid], y: Position.y[eeid] })
        }
      }

      if (!isPassThrough) {
        // ── DELAYED_EXPLOSION: spawn timed bomb at impact point ────────
        if (stats.behaviors.has('DELAYED_EXPLOSION')) {
          const bid = addEntity(world)
          addComponent(world, Position, bid)
          Position.x[bid] = Position.x[eeid]
          Position.y[bid] = Position.y[eeid]
          addComponent(world, Bomb, bid)
          Bomb.timer[bid]  = 0.75
          Bomb.radius[bid] = 110
          Bomb.damage[bid] = pdmg * 2.0
          addComponent(world, Renderable, bid)
          Renderable.textureId[bid] = TextureId.Bomb
          Renderable.tint[bid]      = 0xff6600
          Renderable.scale[bid]     = 0.4
        }
        deadProjectiles.add(peid)
        break
      }
    }
  }

  // ── CHAIN_LIGHTNING: arc to nearby living enemies ────────────────────────
  if (chainSources.length > 0) {
    for (const src of chainSources) {
      for (let i = 0; i < enemies.length; i++) {
        const ceid = enemies[i]
        if (deadEnemies.has(ceid)) continue
        const cdx = src.x - Position.x[ceid], cdy = src.y - Position.y[ceid]
        if (cdx * cdx + cdy * cdy > 160 * 160) continue
        Health.current[ceid] -= src.dmg
        if (Health.current[ceid] <= 0) {
          deadEnemies.add(ceid)
          world.score += spk
          world.pendingGems.push({ x: Position.x[ceid], y: Position.y[ceid] })
          if (Enemy.splitsOnDeath[ceid] === 1) {
            world.pendingSplits.push({ x: Position.x[ceid], y: Position.y[ceid] })
          }
        }
      }
    }
  }

  // ── KINETIC_HARVEST: radiation pulse at kill positions ──────────────────
  if (harvestSources.length > 0) {
    for (const src of harvestSources) {
      for (let i = 0; i < enemies.length; i++) {
        const ceid = enemies[i]
        if (deadEnemies.has(ceid)) continue
        const cdx = src.x - Position.x[ceid], cdy = src.y - Position.y[ceid]
        if (cdx * cdx + cdy * cdy > 90 * 90) continue
        Health.current[ceid] -= src.dmg
        if (Health.current[ceid] <= 0) {
          deadEnemies.add(ceid)
          world.score += spk
          world.pendingGems.push({ x: Position.x[ceid], y: Position.y[ceid] })
          if (Enemy.splitsOnDeath[ceid] === 1) {
            world.pendingSplits.push({ x: Position.x[ceid], y: Position.y[ceid] })
          }
        }
      }
    }
  }

  for (const eid of deadEnemies)     removeEntity(world, eid)
  for (const eid of deadProjectiles) removeEntity(world, eid)

  // ── Enemy vs Nexus (contact damage, cooldown-gated) ─────────────────────
  const nexii = nexusQuery(world)
  if (nexii.length === 0) return
  const neid = nexii[0]
  const nx = Position.x[neid], ny = Position.y[neid], nr = Collider.radius[neid]

  const now = performance.now()
  const livingEnemies = enemyQuery(world)
  for (let i = 0; i < livingEnemies.length; i++) {
    const eeid = livingEnemies[i]
    if (!overlaps(nx, ny, nr, Position.x[eeid], Position.y[eeid], Collider.radius[eeid])) continue

    const cooldownMs = Enemy.attackCooldown[eeid] * 1000
    if (now - Enemy.lastAttack[eeid] < cooldownMs) continue

    Enemy.lastAttack[eeid] = now
    Health.current[neid] -= Enemy.damage[eeid] * damageMult

    if (Health.current[neid] <= 0) {
      Health.current[neid] = 0
      world.gameOver = true
    }
  }
}

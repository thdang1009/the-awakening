import { addComponent, addEntity, defineQuery } from 'bitecs'
import {
  Position, Velocity, Projectile, Renderable, Collider,
  Enemy, Weapon, IsNexus, PassThrough,
} from '../ecs/components'
import { GameWorld } from '../ecs/world'
import { PROJECTILE_RADIUS, PROJECTILE_LIFETIME, TextureId } from '../constants'

const nexusQuery        = defineQuery([IsNexus, Position, Weapon])
const enemyPositionQuery = defineQuery([Enemy, Position])

function findNearestEnemy(world: GameWorld, ox: number, oy: number, range: number): number {
  const enemies = enemyPositionQuery(world)
  let nearest = -1
  let nearestDistSq = range * range

  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i]
    const dx = Position.x[eid] - ox
    const dy = Position.y[eid] - oy
    const distSq = dx * dx + dy * dy
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq
      nearest = eid
    }
  }
  return nearest
}

/** Spawn a single projectile flying in direction (angleDeg from +X axis) */
function spawnProjectile(
  world: GameWorld,
  ox: number, oy: number,
  angleDeg: number,
  damage: number, speed: number,
  passThrough: boolean,
): void {
  const rad = (angleDeg * Math.PI) / 180
  const eid = addEntity(world)

  addComponent(world, Position, eid)
  Position.x[eid] = ox
  Position.y[eid] = oy

  addComponent(world, Velocity, eid)
  Velocity.x[eid] = Math.cos(rad) * speed
  Velocity.y[eid] = Math.sin(rad) * speed

  addComponent(world, Projectile, eid)
  Projectile.damage[eid] = damage
  Projectile.elapsed[eid] = 0
  Projectile.lifetime[eid] = PROJECTILE_LIFETIME

  addComponent(world, Collider, eid)
  Collider.radius[eid] = PROJECTILE_RADIUS

  addComponent(world, Renderable, eid)
  Renderable.textureId[eid] = TextureId.Projectile
  Renderable.tint[eid] = 0xffee44
  Renderable.scale[eid] = 1.0

  if (passThrough) addComponent(world, PassThrough, eid)
}

/** Auto-aim and fire at the nearest enemy, respecting multishot and nova modes */
export function weaponSystem(world: GameWorld): void {
  if (world.gameOver || world.paused) return

  const nexii = nexusQuery(world)
  if (nexii.length === 0) return

  const neid      = nexii[0]
  const nx        = Position.x[neid]
  const ny        = Position.y[neid]
  const fireRate  = Weapon.fireRate[neid]
  const cooldownMs = 1000 / fireRate

  const now = performance.now()
  if (now - Weapon.lastFire[neid] < cooldownMs) return

  const { stats } = world
  const dmg   = Weapon.damage[neid]
  const spd   = Weapon.projectileSpeed[neid]
  const range = Weapon.range[neid]
  const pt    = stats.quantumTunneling

  Weapon.lastFire[neid] = now

  // --- Nova Burst: fire 8 projectiles in all directions ---
  if (stats.novaBurst) {
    for (let i = 0; i < 8; i++) {
      spawnProjectile(world, nx, ny, i * 45, dmg, spd, pt)
    }
    return
  }

  // --- Normal targeting ---
  const targetEid = findNearestEnemy(world, nx, ny, range)
  if (targetEid < 0) return

  const dx = Position.x[targetEid] - nx
  const dy = Position.y[targetEid] - ny
  const baseAngle = Math.atan2(dy, dx) * (180 / Math.PI)

  const totalShots = 1 + Math.floor(stats.multishotAdd)

  if (totalShots === 1) {
    spawnProjectile(world, nx, ny, baseAngle, dmg, spd, pt)
  } else {
    // Fan centered on the target direction with a fixed 14° gap between shots.
    // halfSpan = (N-1)/2 * step  →  startAngle is always symmetric around baseAngle.
    // Even N (2 shots): ±7°  — both shots bracket the target tightly.
    // Odd  N (3 shots): −14°, 0°, +14°  — center shot goes straight at target.
    const STEP_DEG   = 7
    const halfSpan   = ((totalShots - 1) / 2) * STEP_DEG
    const startAngle = baseAngle - halfSpan
    for (let i = 0; i < totalShots; i++) {
      spawnProjectile(world, nx, ny, startAngle + i * STEP_DEG, dmg, spd, pt)
    }
  }
}

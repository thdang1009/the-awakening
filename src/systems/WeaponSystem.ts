import { addComponent, addEntity, defineQuery } from 'bitecs'
import {
  Position, Velocity, Projectile, Renderable, Collider,
  Enemy, Weapon, IsNexus, PassThrough, Health,
  Seeker, Boomerang,
} from '../ecs/components'
import { GameWorld } from '../ecs/world'
import { PROJECTILE_RADIUS, PROJECTILE_LIFETIME, TextureId } from '../constants'

const nexusQuery         = defineQuery([IsNexus, Position, Weapon])
const enemyPositionQuery = defineQuery([Enemy, Position, Health])

// ---------------------------------------------------------------------------
// Target-selection helpers
// ---------------------------------------------------------------------------

function findNearestEnemy(world: GameWorld, ox: number, oy: number, range: number): number {
  const enemies = enemyPositionQuery(world)
  let best = -1
  let bestDistSq = range * range
  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i]
    const dx = Position.x[eid] - ox
    const dy = Position.y[eid] - oy
    const d2 = dx * dx + dy * dy
    if (d2 < bestDistSq) { bestDistSq = d2; best = eid }
  }
  return best
}

/** SMART_TARGETING: target the enemy with the highest current HP */
function findHighestHPEnemy(world: GameWorld, ox: number, oy: number, range: number): number {
  const enemies = enemyPositionQuery(world)
  let best = -1
  let bestHP = -1
  const rangeSq = range * range
  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i]
    const dx = Position.x[eid] - ox
    const dy = Position.y[eid] - oy
    if (dx * dx + dy * dy > rangeSq) continue
    const hp = Health.current[eid]
    if (hp > bestHP) { bestHP = hp; best = eid }
  }
  return best
}

// ---------------------------------------------------------------------------
// Projectile factory
// ---------------------------------------------------------------------------

function spawnProjectile(
  world: GameWorld,
  ox: number, oy: number,
  angleDeg: number,
  damage: number, speed: number,
  passThrough: boolean,
  tint  = 0xffee44,
  scale = 1.0,
  seeker    = false,
  boomerang = false,
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
  Projectile.damage[eid]  = damage
  Projectile.elapsed[eid] = 0
  Projectile.lifetime[eid] = PROJECTILE_LIFETIME

  addComponent(world, Collider, eid)
  Collider.radius[eid] = PROJECTILE_RADIUS

  addComponent(world, Renderable, eid)
  Renderable.textureId[eid] = TextureId.Projectile
  Renderable.tint[eid]      = tint
  Renderable.scale[eid]     = scale

  if (passThrough) addComponent(world, PassThrough, eid)
  if (seeker)      addComponent(world, Seeker, eid)
  // Boomerang projectiles are pass-through so they hit on both legs of the arc
  if (boomerang) {
    addComponent(world, Boomerang, eid)
    addComponent(world, PassThrough, eid)
  }
}

// ---------------------------------------------------------------------------
// Main system
// ---------------------------------------------------------------------------

export function weaponSystem(world: GameWorld): void {
  if (world.gameOver || world.paused) return

  const nexii = nexusQuery(world)
  if (nexii.length === 0) return

  const neid   = nexii[0]
  const nx     = Position.x[neid]
  const ny     = Position.y[neid]
  const dt     = world.delta
  const { stats } = world

  // Phase 4: Keystones run in parallel — RADIANT SUPERNOVA no longer suppresses projectile fire.
  // AURA_DAMAGE + SCALES_WITH_HP (Supernova) now STACKS with all other weapon modes.

  // ── THERMAL_ACCELERATION: ramp fire rate during sustained fire ───────────
  const now        = performance.now()
  const lastFireMs = Weapon.lastFire[neid]
  if (stats.behaviors.has('THERMAL_ACCELERATION')) {
    if (now - lastFireMs < 400) {
      world.thermalHeat = Math.min(1.0, world.thermalHeat + dt * 0.35)
    } else {
      world.thermalHeat = Math.max(0.0, world.thermalHeat - dt * 0.8)
    }
  } else {
    world.thermalHeat = 0
  }

  const thermalMult = 1 + world.thermalHeat * 1.5
  const fireRate    = Weapon.fireRate[neid] * world.buffs.fireRateMult * thermalMult
  const cooldownMs  = 1000 / fireRate

  if (now - lastFireMs < cooldownMs) return

  let dmg   = Weapon.damage[neid]
  const spd   = Weapon.projectileSpeed[neid]
  const range = Weapon.range[neid]

  // ── DAMAGE_SCALES_WITH_SCORE ─────────────────────────────────────────────
  if (stats.behaviors.has('DAMAGE_SCALES_WITH_SCORE')) {
    dmg *= (1 + Math.sqrt(world.score) / 50)
  }

  const pt = stats.behaviors.has('INFINITE_PIERCE')

  Weapon.lastFire[neid] = now

  // ── BEAM_MODE: auto-aim sweeps toward nearest / highest-HP enemy ─────────
  if (stats.behaviors.has('BEAM_MODE')) {
    const beamEnemies = enemyPositionQuery(world)
    if (beamEnemies.length === 0) return

    // Select beam target: SMART_TARGETING → highest HP, else nearest
    const beamTarget = stats.behaviors.has('SMART_TARGETING')
      ? findHighestHPEnemy(world, nx, ny, range * 2)
      : findNearestEnemy(world, nx, ny, range * 2)   // wider range for beam

    if (beamTarget >= 0) {
      const tx = Position.x[beamTarget] - nx
      const ty = Position.y[beamTarget] - ny
      const targetAngle = Math.atan2(ty, tx)

      // Smooth rotation toward target
      let diff = targetAngle - world.beamAngle
      while (diff >  Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI

      const BEAM_TURN_RATE = Math.PI * 2.5   // 450°/s — responsive but smooth
      world.beamAngle += Math.max(-BEAM_TURN_RATE * dt, Math.min(BEAM_TURN_RATE * dt, diff))
    }

    const sweepDeg   = world.beamAngle * (180 / Math.PI)
    const totalShots = Math.max(1, 1 + Math.floor(stats.multishotAdd))

    // QUASAR_BEAM evolution: much larger bolts, higher damage, tighter spread
    const isQuasar   = stats.behaviors.has('QUASAR_BEAM')
    const beamScale  = isQuasar ? 5.5 : 2.2
    const beamDmg    = isQuasar ? dmg * 2.5 : dmg
    const beamTint   = isQuasar ? 0xff88ff : 0xffffff
    const beamSpread = isQuasar ? 5 : 7

    for (let i = 0; i < totalShots; i++) {
      const offset = (i - (totalShots - 1) / 2) * beamSpread
      spawnProjectile(world, nx, ny, sweepDeg + offset, beamDmg, spd, true,
        beamTint, beamScale)
    }
    return
  }

  // ── Normal targeting ─────────────────────────────────────────────────────
  const targetEid = stats.behaviors.has('SMART_TARGETING')
    ? findHighestHPEnemy(world, nx, ny, range)
    : findNearestEnemy(world, nx, ny, range)
  if (targetEid < 0) return

  const dx        = Position.x[targetEid] - nx
  const dy        = Position.y[targetEid] - ny
  const baseAngle = Math.atan2(dy, dx) * (180 / Math.PI)

  const totalShots = 1 + Math.floor(stats.multishotAdd)

  const isSeeker    = stats.behaviors.has('SEEKER')
  const isBoomerang = stats.behaviors.has('BOOMERANG')
  const isStorm     = stats.behaviors.has('STORM_NETWORK')

  // STORM_NETWORK evolution: fire at top 4 enemies simultaneously (chain-style)
  if (isStorm || stats.behaviors.has('CHAIN_LIGHTNING')) {
    const CHAIN_TARGETS = isStorm ? 4 : 2
    const CHAIN_RANGE   = isStorm ? range * 1.8 : range * 1.2
    const allEnemies    = enemyPositionQuery(world)
    const byDist: Array<{ eid: number; d2: number }> = []
    for (let i = 0; i < allEnemies.length; i++) {
      const eid = allEnemies[i]
      const dx = Position.x[eid] - nx
      const dy = Position.y[eid] - ny
      const d2 = dx * dx + dy * dy
      if (d2 < CHAIN_RANGE * CHAIN_RANGE) byDist.push({ eid, d2 })
    }
    byDist.sort((a, b) => a.d2 - b.d2)
    const targets = byDist.slice(0, CHAIN_TARGETS)
    const lightningTint = isStorm ? 0x88ffff : 0xaaaaff
    const lightningScale = isStorm ? 1.8 : 1.0
    for (const { eid } of targets) {
      const ex = Position.x[eid]
      const ey = Position.y[eid]
      const a  = Math.atan2(ey - ny, ex - nx) * (180 / Math.PI)
      spawnProjectile(world, nx, ny, a, isStorm ? dmg * 1.5 : dmg,
        spd * 1.4, true, lightningTint, lightningScale)
    }
    return
  }

  // Tint and scale by firing mode
  const tint  = isSeeker    ? 0xcc44ff   // purple seeker
              : isBoomerang ? 0x44ffff   // cyan boomerang
              : 0xffee44                 // default yellow
  const scale = isBoomerang ? 1.2 : 1.0

  if (totalShots === 1) {
    spawnProjectile(world, nx, ny, baseAngle, dmg, spd, pt, tint, scale, isSeeker, isBoomerang)
  } else {
    const STEP_DEG   = 7
    const halfSpan   = ((totalShots - 1) / 2) * STEP_DEG
    const startAngle = baseAngle - halfSpan
    for (let i = 0; i < totalShots; i++) {
      spawnProjectile(world, nx, ny, startAngle + i * STEP_DEG, dmg, spd, pt,
        tint, scale, isSeeker, isBoomerang)
    }
  }
}

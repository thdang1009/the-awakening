// ---------------------------------------------------------------------------
// DroneSystem — ORBITAL_DRONES (co_key) & QUANTUM_HARVESTER (Phase 4)
// ---------------------------------------------------------------------------
// Drones orbit the Nexus at a fixed radius, automatically attacking the
// nearest enemy within their strike range every second.
//
// Spawn trigger:
//   ORBITAL_DRONES alone    → 1 drone per 500 lifetime XP collected
//   QUANTUM_HARVESTER evo   → 1 drone per 250 lifetime XP (halved threshold),
//                             each drone deals 2× base damage
//
// Max drones: 8 (to keep performance reasonable).
// ---------------------------------------------------------------------------

import { addComponent, addEntity, defineQuery, hasComponent, removeEntity } from 'bitecs'
import { Position, Velocity, Renderable, Collider, Drone, Enemy, Health, IsElite } from '../ecs/components'
import { GameWorld } from '../ecs/world'
import { TextureId } from '../constants'

const droneQuery = defineQuery([Drone, Position])
const enemyQuery = defineQuery([Enemy, Position, Health])

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DRONE_BASE_RADIUS   = 75    // px orbit radius for first drone
const DRONE_RADIUS_STEP   = 28    // additional radius per extra drone ring
const DRONE_ORBIT_SPEED   = 1.8   // radians per second
const DRONE_ATTACK_RATE   = 1.0   // attacks per second
const DRONE_STRIKE_RANGE  = 55    // px — max range to hit an enemy per attack
const DRONE_BASE_DAMAGE   = 8     // damage per attack
const MAX_DRONES          = 8

const XP_PER_DRONE_NORMAL   = 500
const XP_PER_DRONE_QUANTUM  = 250

// Track how many drones have been spawned (consume from world.xpCollected milestones)
let _lastSpawnThreshold = 0

// ---------------------------------------------------------------------------

function spawnDrone(world: GameWorld, index: number, damageMultiplier: number): void {
  const eid = addEntity(world)

  // Spread drones around a ring — evenly distribute angles
  const angle  = (index / Math.max(1, index)) * Math.PI * 2 * (index / MAX_DRONES)
  const radius = DRONE_BASE_RADIUS + Math.floor(index / 4) * DRONE_RADIUS_STEP

  addComponent(world, Position, eid)
  const neid = world.nexusEid
  Position.x[eid] = Position.x[neid] + Math.cos(angle) * radius
  Position.y[eid] = Position.y[neid] + Math.sin(angle) * radius

  addComponent(world, Velocity, eid)
  Velocity.x[eid] = 0
  Velocity.y[eid] = 0

  addComponent(world, Collider, eid)
  Collider.radius[eid] = 10

  addComponent(world, Drone, eid)
  Drone.orbitAngle[eid]  = angle
  Drone.orbitRadius[eid] = radius
  Drone.damage[eid]      = DRONE_BASE_DAMAGE * damageMultiplier
  Drone.lastAttack[eid]  = 0

  addComponent(world, Renderable, eid)
  Renderable.textureId[eid] = TextureId.Projectile
  Renderable.tint[eid]      = damageMultiplier > 1 ? 0x00ffff : 0x88ff44  // cyan = evolved, green = normal
  Renderable.scale[eid]     = damageMultiplier > 1 ? 2.2 : 1.5
}

// ---------------------------------------------------------------------------
// Main system
// ---------------------------------------------------------------------------

export function droneSystem(world: GameWorld): void {
  if (world.gameOver || world.paused) return

  const { stats } = world
  if (!stats.behaviors.has('ORBITAL_DRONES') && !stats.behaviors.has('QUANTUM_HARVESTER')) return

  const isQuantum     = stats.behaviors.has('QUANTUM_HARVESTER')
  const xpThreshold   = isQuantum ? XP_PER_DRONE_QUANTUM : XP_PER_DRONE_NORMAL
  const damageMult    = isQuantum ? 2.0 : 1.0

  // ── Spawn new drones based on lifetime XP milestones ─────────────────────
  const currentDrones = droneQuery(world).length
  const shouldExist   = Math.min(MAX_DRONES, Math.floor(world.xpCollected / xpThreshold))

  if (currentDrones < shouldExist) {
    const toSpawn = Math.min(shouldExist - currentDrones, MAX_DRONES - currentDrones)
    for (let s = 0; s < toSpawn; s++) {
      spawnDrone(world, currentDrones + s, damageMult)
    }
  }

  // ── Orbit + attack ────────────────────────────────────────────────────────
  const neid    = world.nexusEid
  if (neid < 0) return
  const nx      = Position.x[neid]
  const ny      = Position.y[neid]
  const dt      = world.delta
  const now     = performance.now()
  const spk     = Math.floor(10 * (1 + stats.scoreBonus) * stats.scoreMultiplier)

  const drones  = droneQuery(world)
  const enemies = enemyQuery(world)

  for (let i = 0; i < drones.length; i++) {
    const did = drones[i]

    // Advance orbit angle
    Drone.orbitAngle[did] += DRONE_ORBIT_SPEED * dt
    const angle  = Drone.orbitAngle[did]
    const radius = Drone.orbitRadius[did]

    // Move drone to its orbital position relative to the Nexus
    Position.x[did] = nx + Math.cos(angle) * radius
    Position.y[did] = ny + Math.sin(angle) * radius

    // Attack cooldown
    const cooldownMs = 1000 / DRONE_ATTACK_RATE
    if (now - Drone.lastAttack[did] < cooldownMs) continue

    Drone.lastAttack[did] = now
    const dx_pos = Position.x[did]
    const dy_pos = Position.y[did]
    const strikeSq = DRONE_STRIKE_RANGE * DRONE_STRIKE_RANGE

    // Find nearest enemy within strike range and deal damage
    let bestDist = Infinity
    let bestEid  = -1
    for (let j = 0; j < enemies.length; j++) {
      const eid = enemies[j]
      const ex  = Position.x[eid]
      const ey  = Position.y[eid]
      const d2  = (ex - dx_pos) ** 2 + (ey - dy_pos) ** 2
      if (d2 < strikeSq && d2 < bestDist) { bestDist = d2; bestEid = eid }
    }

    if (bestEid < 0) continue

    Health.current[bestEid] -= Drone.damage[did]
    if (Health.current[bestEid] <= 0) {
      world.score += hasComponent(world, IsElite, bestEid) ? spk * 5 : spk
      world.pendingGems.push({ x: Position.x[bestEid], y: Position.y[bestEid] })
      if (hasComponent(world, IsElite, bestEid))
        world.pendingChests.push({ x: Position.x[bestEid], y: Position.y[bestEid] })
      if (Enemy.splitsOnDeath[bestEid] === 1)
        world.pendingSplits.push({ x: Position.x[bestEid], y: Position.y[bestEid] })
      removeEntity(world, bestEid)
    }
  }
}

/** Reset drone spawn tracking — call when a new session starts */
export function resetDroneSystem(): void {
  _lastSpawnThreshold = 0
}

// ---------------------------------------------------------------------------
// AuraSystem — AURA_DAMAGE (bw_n1) and RADIANT SUPERNOVA (bw_key)
// ---------------------------------------------------------------------------
// Fires every PULSE_INTERVAL seconds, dealing AoE damage to all enemies
// within the aura radius.  When SCALES_WITH_HP is also active (Supernova),
// both radius and damage scale with max HP.
// ---------------------------------------------------------------------------

import { defineQuery, hasComponent, removeEntity } from 'bitecs'
import { Position, Health, Enemy, IsElite } from '../ecs/components'
import { GameWorld } from '../ecs/world'
import { BASE_NEXUS_MAX_HP } from '../constants'

const enemyQuery = defineQuery([Enemy, Position, Health])

const PULSE_INTERVAL = 1.2   // seconds between pulses
const BASE_RADIUS    = 130   // px at 100 HP
const BASE_DAMAGE    = 6     // damage per pulse at 100 HP

export function auraSystem(world: GameWorld): void {
  if (world.gameOver || world.paused) return

  const { stats } = world
  if (!stats.behaviors.has('AURA_DAMAGE')) return

  world.auraTimer += world.delta
  if (world.auraTimer < PULSE_INTERVAL) return
  world.auraTimer -= PULSE_INTERVAL

  const neid  = world.nexusEid
  if (neid < 0) return
  const nx    = Position.x[neid]
  const ny    = Position.y[neid]
  const maxHP = Health.max[neid]

  // SCALES_WITH_HP (Supernova): radius and damage grow with HP pool
  const hpRatio = stats.behaviors.has('SCALES_WITH_HP')
    ? maxHP / BASE_NEXUS_MAX_HP
    : 1
  const radius    = BASE_RADIUS + hpRatio * 80
  const auraDmg   = BASE_DAMAGE * hpRatio
  const radiusSq  = radius * radius
  const spk       = Math.floor(10 * (1 + stats.scoreBonus) * stats.scoreMultiplier)

  const enemies = enemyQuery(world)
  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i]
    const dx = Position.x[eid] - nx
    const dy = Position.y[eid] - ny
    if (dx * dx + dy * dy > radiusSq) continue

    Health.current[eid] -= auraDmg
    if (Health.current[eid] <= 0) {
      world.score += hasComponent(world, IsElite, eid) ? spk * 5 : spk
      world.pendingGems.push({ x: Position.x[eid], y: Position.y[eid] })
      if (hasComponent(world, IsElite, eid))
        world.pendingChests.push({ x: Position.x[eid], y: Position.y[eid] })
      if (Enemy.splitsOnDeath[eid] === 1) {
        world.pendingSplits.push({ x: Position.x[eid], y: Position.y[eid] })
      }
      removeEntity(world, eid)
    }
  }
}

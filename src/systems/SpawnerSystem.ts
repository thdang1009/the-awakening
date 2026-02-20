import { addComponent, addEntity } from 'bitecs'
import {
  Position, Velocity, Health, Renderable, Enemy, Collider, IsElite,
} from '../ecs/components'
import { GameWorld } from '../ecs/world'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, SPAWN_MARGIN,
  ENEMY_RADIUS, ENEMY_BASE_SPEED, ENEMY_BASE_HP, ENEMY_DAMAGE,
  ENEMY_ATTACK_COOLDOWN, WAVE_BASE_ENEMY_COUNT, WAVE_ENEMY_COUNT_SCALING,
  WAVE_SPEED_SCALING, WAVE_GRACE_PERIOD, WAVE_SPAWN_DELAY,
  BOSS_RADIUS, BOSS_HP, BOSS_SPEED, BOSS_DAMAGE, BOSS_ATTACK_COOLDOWN,
  ELITE_HP_MULT, ELITE_SPEED_MULT, ELITE_SCALE, ELITE_DAMAGE_MULT,
  TextureId,
} from '../constants'
import { type EnemyArchetype, selectArchetype, contextTintOverride } from '../enemies/enemyTypes'

interface SpawnerState {
  inGrace: boolean
  graceTimer: number
  enemiesRemaining: number
  spawnTimer: number
  elitesPending: number   // elites queued to spawn this wave
}

const state: SpawnerState = {
  inGrace: true,
  graceTimer: 0,
  enemiesRemaining: 0,
  spawnTimer: 0,
  elitesPending: 0,
}

let _onWaveStart:    ((wave: number) => void) | null = null
let _onWaveComplete: ((wave: number) => void) | null = null

export function setSpawnerCallbacks(
  onWaveStart:    (wave: number) => void,
  onWaveComplete: (wave: number) => void,
): void {
  _onWaveStart    = onWaveStart
  _onWaveComplete = onWaveComplete
}

export function resetSpawner(): void {
  state.inGrace = true
  state.graceTimer = 0
  state.enemiesRemaining = 0
  state.spawnTimer = 0
  state.elitesPending = 0
}

function enemyCountForWave(wave: number): number {
  return WAVE_BASE_ENEMY_COUNT + (wave - 1) * WAVE_ENEMY_COUNT_SCALING
}

function enemySpeedForWave(wave: number): number {
  return ENEMY_BASE_SPEED + (wave - 1) * WAVE_SPEED_SCALING
}

/**
 * Spawn position just outside the player's visible viewport.
 * Uses Nexus world-space position as the camera centre so enemies always
 * appear at the screen edges regardless of how far the Nexus has moved.
 */
function randomOffscreenPos(world: GameWorld): { x: number; y: number } {
  const cx = world.nexusEid >= 0 ? Position.x[world.nexusEid] : CANVAS_WIDTH  / 2
  const cy = world.nexusEid >= 0 ? Position.y[world.nexusEid] : CANVAS_HEIGHT / 2

  const hw = CANVAS_WIDTH  / 2 + SPAWN_MARGIN
  const hh = CANVAS_HEIGHT / 2 + SPAWN_MARGIN

  const side = Math.floor(Math.random() * 4)
  switch (side) {
    case 0: return { x: cx + (Math.random() * 2 - 1) * hw, y: cy - hh }  // top
    case 1: return { x: cx + hw,                            y: cy + (Math.random() * 2 - 1) * hh }  // right
    case 2: return { x: cx + (Math.random() * 2 - 1) * hw, y: cy + hh }  // bottom
    default:return { x: cx - hw,                            y: cy + (Math.random() * 2 - 1) * hh }  // left
  }
}

function spawnBoss(world: GameWorld): void {
  const eid = addEntity(world)
  const { x, y } = randomOffscreenPos(world)

  addComponent(world, Position, eid)
  Position.x[eid] = x
  Position.y[eid] = y

  addComponent(world, Velocity, eid)
  Velocity.x[eid] = 0
  Velocity.y[eid] = 0

  addComponent(world, Health, eid)
  Health.current[eid] = BOSS_HP
  Health.max[eid]     = BOSS_HP

  addComponent(world, Enemy, eid)
  Enemy.speed[eid]          = BOSS_SPEED
  Enemy.damage[eid]         = BOSS_DAMAGE
  Enemy.attackCooldown[eid] = BOSS_ATTACK_COOLDOWN
  Enemy.lastAttack[eid]     = 0
  Enemy.splitsOnDeath[eid]  = 0

  addComponent(world, Collider, eid)
  Collider.radius[eid] = BOSS_RADIUS

  addComponent(world, Renderable, eid)
  Renderable.textureId[eid] = TextureId.Boss
  Renderable.tint[eid]      = 0xffffff
  Renderable.scale[eid]     = 1.0
}

/** Spawn a single Elite enemy — tanky, gold-tinted, always drops a chest */
function spawnElite(world: GameWorld): void {
  const eid  = addEntity(world)
  const wave = world.wave
  const { x, y } = randomOffscreenPos(world)

  addComponent(world, Position, eid)
  Position.x[eid] = x
  Position.y[eid] = y

  addComponent(world, Velocity, eid)
  Velocity.x[eid] = 0
  Velocity.y[eid] = 0

  const baseHP = ENEMY_BASE_HP + Math.floor(wave / 2)
  const hp     = Math.max(8, Math.round(baseHP * ELITE_HP_MULT))
  addComponent(world, Health, eid)
  Health.current[eid] = hp
  Health.max[eid]     = hp

  addComponent(world, Enemy, eid)
  Enemy.speed[eid]          = enemySpeedForWave(wave) * ELITE_SPEED_MULT
  Enemy.damage[eid]         = ENEMY_DAMAGE * ELITE_DAMAGE_MULT
  Enemy.attackCooldown[eid] = ENEMY_ATTACK_COOLDOWN * 0.8
  Enemy.lastAttack[eid]     = 0
  Enemy.splitsOnDeath[eid]  = 0

  addComponent(world, Collider, eid)
  Collider.radius[eid] = ENEMY_RADIUS * ELITE_SCALE

  addComponent(world, IsElite, eid)

  addComponent(world, Renderable, eid)
  Renderable.textureId[eid] = TextureId.Elite
  Renderable.tint[eid]      = 0xffd700   // gold
  Renderable.scale[eid]     = ELITE_SCALE
}

/** Spawn a single enemy entity using the given archetype */
function spawnEnemyEntity(world: GameWorld, archetype: EnemyArchetype): void {
  const eid  = addEntity(world)
  const wave = world.wave
  const { x, y } = randomOffscreenPos(world)

  addComponent(world, Position, eid)
  Position.x[eid] = x
  Position.y[eid] = y

  addComponent(world, Velocity, eid)
  Velocity.x[eid] = 0
  Velocity.y[eid] = 0

  const baseHP = ENEMY_BASE_HP + Math.floor(wave / 2)
  const hp     = Math.max(1, Math.round(baseHP * archetype.hpMult))
  addComponent(world, Health, eid)
  Health.current[eid] = hp
  Health.max[eid]     = hp

  addComponent(world, Enemy, eid)
  Enemy.speed[eid]          = enemySpeedForWave(wave) * archetype.speedMult
  Enemy.damage[eid]         = ENEMY_DAMAGE * archetype.damageMult
  Enemy.attackCooldown[eid] = ENEMY_ATTACK_COOLDOWN * archetype.cooldownMult
  Enemy.lastAttack[eid]     = 0
  Enemy.splitsOnDeath[eid]  = archetype.splitsOnDeath ? 1 : 0

  addComponent(world, Collider, eid)
  Collider.radius[eid] = ENEMY_RADIUS * archetype.scale

  const tint = contextTintOverride(archetype.tint, world.context)
  addComponent(world, Renderable, eid)
  Renderable.textureId[eid] = archetype.textureId
  Renderable.tint[eid]      = tint
  Renderable.scale[eid]     = archetype.scale
}

/** Spawn one archetype "slot" — may create multiple entities (e.g. Swarm) */
function spawnEnemy(world: GameWorld): void {
  const archetype = selectArchetype(world.wave, world.context)
  for (let i = 0; i < archetype.spawnGroupSize; i++) {
    spawnEnemyEntity(world, archetype)
  }
}

/** Mini-enemy spawned when a Splitter dies */
export function spawnSplitFragment(world: GameWorld, ox: number, oy: number): void {
  const wave = world.wave
  for (let i = 0; i < 2; i++) {
    const eid = addEntity(world)
    const angle = Math.random() * Math.PI * 2
    const spread = 16

    addComponent(world, Position, eid)
    Position.x[eid] = ox + Math.cos(angle) * spread
    Position.y[eid] = oy + Math.sin(angle) * spread

    addComponent(world, Velocity, eid)
    Velocity.x[eid] = 0
    Velocity.y[eid] = 0

    const hp = Math.max(1, Math.floor((ENEMY_BASE_HP + Math.floor(wave / 2)) * 0.4))
    addComponent(world, Health, eid)
    Health.current[eid] = hp
    Health.max[eid]     = hp

    addComponent(world, Enemy, eid)
    Enemy.speed[eid]          = enemySpeedForWave(wave) * 1.3
    Enemy.damage[eid]         = ENEMY_DAMAGE * 0.6
    Enemy.attackCooldown[eid] = ENEMY_ATTACK_COOLDOWN
    Enemy.lastAttack[eid]     = 0
    Enemy.splitsOnDeath[eid]  = 0    // fragments do NOT split again

    addComponent(world, Collider, eid)
    Collider.radius[eid] = ENEMY_RADIUS * 0.6

    const tint = contextTintOverride(0xffaa33, world.context)
    addComponent(world, Renderable, eid)
    Renderable.textureId[eid] = TextureId.EnemySwarm
    Renderable.tint[eid]      = tint
    Renderable.scale[eid]     = 0.6
  }
}

/**
 * Wave-based enemy spawner.
 * @param aliveEnemyCount - query result length AFTER collision/death processing
 */
export function spawnerSystem(world: GameWorld, aliveEnemyCount: number): void {
  if (world.gameOver || world.paused) return

  // ── Process pending Splitter fragments ──────────────────────────────────
  while (world.pendingSplits.length > 0) {
    const pos = world.pendingSplits.pop()!
    spawnSplitFragment(world, pos.x, pos.y)
  }

  // ── Handle one-shot viewer requests from Streamer Mode ─────────────────
  if (world.buffs.spawnBossRequest) {
    world.buffs.spawnBossRequest = false
    spawnBoss(world)
  }
  if (world.buffs.spawnWaveRequest) {
    world.buffs.spawnWaveRequest = false
    const extraCount = 5 + Math.floor(world.wave * 0.5)
    for (let i = 0; i < extraCount; i++) spawnEnemy(world)
  }

  const dt = world.delta

  if (state.inGrace) {
    state.graceTimer += dt
    if (state.graceTimer >= WAVE_GRACE_PERIOD) {
      world.wave++
      state.graceTimer       = 0
      state.inGrace          = false
      state.enemiesRemaining = enemyCountForWave(world.wave)
      state.spawnTimer       = 0
      // Elites first appear at wave 8; +1 extra every 4 waves after that
      state.elitesPending    = world.wave >= 8 ? 1 + Math.floor((world.wave - 8) / 4) : 0
      _onWaveStart?.(world.wave)
    }
    return
  }

  if (state.enemiesRemaining > 0) {
    state.spawnTimer += dt
    if (state.spawnTimer >= WAVE_SPAWN_DELAY) {
      state.spawnTimer = 0
      spawnEnemy(world)
      state.enemiesRemaining--

      // Spawn an elite at the midpoint of the wave's spawn queue
      if (state.elitesPending > 0 && state.enemiesRemaining === Math.floor(enemyCountForWave(world.wave) / 2)) {
        spawnElite(world)
        state.elitesPending--
      }
    }
  } else if (aliveEnemyCount === 0) {
    // All enemies spawned and killed — wave complete
    _onWaveComplete?.(world.wave)
    state.inGrace    = true
    state.graceTimer = 0
  }
}

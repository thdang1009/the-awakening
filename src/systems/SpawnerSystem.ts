import { addComponent, addEntity } from 'bitecs'
import {
  Position, Velocity, Health, Renderable, Enemy, Collider,
} from '../ecs/components'
import { GameWorld } from '../ecs/world'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, SPAWN_MARGIN,
  ENEMY_RADIUS, ENEMY_BASE_SPEED, ENEMY_BASE_HP, ENEMY_DAMAGE,
  ENEMY_ATTACK_COOLDOWN, WAVE_BASE_ENEMY_COUNT, WAVE_ENEMY_COUNT_SCALING,
  WAVE_SPEED_SCALING, WAVE_GRACE_PERIOD, WAVE_SPAWN_DELAY, TextureId,
} from '../constants'

interface SpawnerState {
  inGrace: boolean
  graceTimer: number
  enemiesRemaining: number
  spawnTimer: number
}

const state: SpawnerState = {
  inGrace: true,
  graceTimer: 0,
  enemiesRemaining: 0,
  spawnTimer: 0,
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
}

function enemyCountForWave(wave: number): number {
  return WAVE_BASE_ENEMY_COUNT + (wave - 1) * WAVE_ENEMY_COUNT_SCALING
}

function enemySpeedForWave(wave: number): number {
  return ENEMY_BASE_SPEED + (wave - 1) * WAVE_SPEED_SCALING
}

/** Tint shifts red → orange → purple as waves progress */
function enemyTintForWave(wave: number): number {
  if (wave <= 3) return 0xff3333
  if (wave <= 6) return 0xff7733
  return 0xaa33ff
}

function spawnEnemy(world: GameWorld): void {
  const eid = addEntity(world)
  const wave = world.wave

  // Random spawn position outside the screen on any of the 4 sides
  const side = Math.floor(Math.random() * 4)
  let x = 0
  let y = 0
  switch (side) {
    case 0: x = Math.random() * CANVAS_WIDTH; y = -SPAWN_MARGIN; break
    case 1: x = CANVAS_WIDTH + SPAWN_MARGIN; y = Math.random() * CANVAS_HEIGHT; break
    case 2: x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT + SPAWN_MARGIN; break
    default: x = -SPAWN_MARGIN; y = Math.random() * CANVAS_HEIGHT; break
  }

  addComponent(world, Position, eid)
  Position.x[eid] = x
  Position.y[eid] = y

  addComponent(world, Velocity, eid)
  Velocity.x[eid] = 0
  Velocity.y[eid] = 0

  addComponent(world, Health, eid)
  Health.current[eid] = ENEMY_BASE_HP
  Health.max[eid] = ENEMY_BASE_HP

  addComponent(world, Enemy, eid)
  Enemy.speed[eid] = enemySpeedForWave(wave)
  Enemy.damage[eid] = ENEMY_DAMAGE
  Enemy.attackCooldown[eid] = ENEMY_ATTACK_COOLDOWN
  Enemy.lastAttack[eid] = 0

  addComponent(world, Collider, eid)
  Collider.radius[eid] = ENEMY_RADIUS

  addComponent(world, Renderable, eid)
  Renderable.textureId[eid] = TextureId.Enemy
  Renderable.tint[eid] = enemyTintForWave(wave)
  Renderable.scale[eid] = 1.0
}

/**
 * Wave-based enemy spawner.
 * @param aliveEnemyCount - query result length AFTER collision/death processing
 */
export function spawnerSystem(world: GameWorld, aliveEnemyCount: number): void {
  if (world.gameOver || world.paused) return

  const dt = world.delta

  if (state.inGrace) {
    state.graceTimer += dt
    if (state.graceTimer >= WAVE_GRACE_PERIOD) {
      world.wave++
      state.graceTimer = 0
      state.inGrace = false
      state.enemiesRemaining = enemyCountForWave(world.wave)
      state.spawnTimer = 0
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
    }
  } else if (aliveEnemyCount === 0) {
    // All enemies spawned and killed — wave complete
    _onWaveComplete?.(world.wave)
    state.inGrace = true
    state.graceTimer = 0
  }
}

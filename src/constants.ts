// Canvas
export const CANVAS_WIDTH = 1280
export const CANVAS_HEIGHT = 720

// Nexus (player core)
export const NEXUS_X = CANVAS_WIDTH / 2
export const NEXUS_Y = CANVAS_HEIGHT / 2
export const NEXUS_RADIUS = 30
export const NEXUS_MAX_HP = 100

// Enemies
export const ENEMY_RADIUS = 14
export const ENEMY_BASE_SPEED = 80   // px/s at wave 1
export const ENEMY_BASE_HP = 3
export const ENEMY_DAMAGE = 15        // damage per hit (cooldown-gated)
export const ENEMY_ATTACK_COOLDOWN = 1.0  // seconds between hits

// Projectiles
export const PROJECTILE_RADIUS = 4
export const PROJECTILE_SPEED = 480   // px/s
export const PROJECTILE_DAMAGE = 1
export const PROJECTILE_LIFETIME = 2.5  // seconds

// Weapon
export const WEAPON_FIRE_RATE = 4     // shots per second
export const WEAPON_RANGE = 380       // pixels

// Base stat references (used by skill-tree stat applicator)
export const BASE_FIRE_RATE       = WEAPON_FIRE_RATE
export const BASE_PROJECTILE_DAMAGE = PROJECTILE_DAMAGE
export const BASE_PROJECTILE_SPEED  = PROJECTILE_SPEED
export const BASE_WEAPON_RANGE    = WEAPON_RANGE
export const BASE_NEXUS_MAX_HP    = NEXUS_MAX_HP

// Waves
export const WAVE_BASE_ENEMY_COUNT = 10
export const WAVE_ENEMY_COUNT_SCALING = 5   // +5 enemies per wave
export const WAVE_SPEED_SCALING = 12         // +12 px/s per wave
export const WAVE_GRACE_PERIOD = 4           // seconds between waves
export const WAVE_SPAWN_DELAY = 0.12         // seconds between individual spawns

// Spawn
export const SPAWN_MARGIN = 60   // pixels outside screen edge

// Spatial hash
export const SPATIAL_CELL_SIZE = 64

// Texture IDs (index into textures array)
export enum TextureId {
  Nexus = 0,
  Enemy = 1,
  Projectile = 2,
}

// Canvas
export const CANVAS_WIDTH = 1280
export const CANVAS_HEIGHT = 720

// Nexus (player core)
export const NEXUS_X = CANVAS_WIDTH / 2
export const NEXUS_Y = CANVAS_HEIGHT / 2
export const NEXUS_RADIUS = 30
export const NEXUS_MAX_HP = 100

// Nexus movement (Phase 2)
export const NEXUS_MOVE_SPEED   = 220   // max px/s
export const NEXUS_ACCELERATION = 900   // px/s² ramp-up
export const NEXUS_FRICTION     = 8     // exponential damping factor (v *= exp(-f*dt))

// Pickup / Gem economy (Phase 2)
export const BASE_PICKUP_RADIUS  = 90    // px — magnet activation range
export const GEM_ATTRACT_SPEED   = 280   // px/s — gem moves toward nexus when magnetised
export const GEM_XP_VALUE        = 5     // XP per gem collected
export const GEM_RADIUS          = 5     // collision radius for collection
export const XP_BASE             = 50    // XP needed for level 1→2
export const XP_SCALE            = 25    // +25 XP per subsequent level

// Enemies
export const ENEMY_RADIUS = 14
export const ENEMY_BASE_SPEED = 80   // px/s at wave 1
export const ENEMY_BASE_HP = 3
export const ENEMY_DAMAGE = 15        // damage per hit (cooldown-gated)
export const ENEMY_ATTACK_COOLDOWN = 1.0  // seconds between hits

// Projectiles
export const PROJECTILE_RADIUS = 4
export const PROJECTILE_SPEED = 480   // px/s
export const PROJECTILE_DAMAGE = 2    // raised: 1→2 so base DPS isn't painfully low
export const PROJECTILE_LIFETIME = 2.5  // seconds

// Weapon
export const WEAPON_FIRE_RATE = 5     // shots per second (raised: 4→5)
export const WEAPON_RANGE = 380       // pixels

// Base stat references (used by skill-tree stat applicator)
export const BASE_FIRE_RATE       = WEAPON_FIRE_RATE
export const BASE_PROJECTILE_DAMAGE = PROJECTILE_DAMAGE
export const BASE_PROJECTILE_SPEED  = PROJECTILE_SPEED
export const BASE_WEAPON_RANGE    = WEAPON_RANGE
export const BASE_NEXUS_MAX_HP    = NEXUS_MAX_HP

// Waves
export const WAVE_BASE_ENEMY_COUNT = 8       // slightly lower start
export const WAVE_ENEMY_COUNT_SCALING = 3   // +3 per wave (was 5) — gentler ramp
export const WAVE_SPEED_SCALING = 7         // +7 px/s per wave (was 12)
export const WAVE_GRACE_PERIOD = 4           // seconds between waves
export const WAVE_SPAWN_DELAY = 0.12         // seconds between individual spawns

// Spawn
export const SPAWN_MARGIN = 60   // pixels outside screen edge

// Spatial hash
export const SPATIAL_CELL_SIZE = 64

// Boss enemy
export const BOSS_RADIUS          = 28
export const BOSS_HP              = 50
export const BOSS_SPEED           = 55    // px/s — slower but tanky
export const BOSS_DAMAGE          = 35
export const BOSS_ATTACK_COOLDOWN = 1.2   // seconds between hits

// Elite enemy
export const ELITE_HP_MULT       = 6      // HP multiplier vs normal enemy at same wave
export const ELITE_SPEED_MULT    = 0.65   // slower but tankier
export const ELITE_SCALE         = 1.9    // visual scale
export const ELITE_DAMAGE_MULT   = 1.5
export const ELITE_SCORE_MULT    = 5      // score bonus multiplier per elite kill

// Golden Chest
export const CHEST_RADIUS        = 16     // collision radius for collection

// Texture IDs (index into textures array)
export enum TextureId {
  Nexus       = 0,
  Enemy       = 1,   // standard circle
  Projectile  = 2,
  Boss        = 3,
  EnemyFast   = 4,   // diamond shape — Dasher, Berserker
  EnemyBrute  = 5,   // heavy circle — Brute, Tank, Elite
  EnemySwarm  = 6,   // tiny dot — Swarm, Splitter fragments
  EnemyShadow = 7,   // hollow ring — Shadow, Void
  Bomb        = 8,   // pulsing charge indicator — DELAYED_EXPLOSION
  Blackhole   = 9,   // dark gravity well — SPAWN_BLACKHOLE
  Gem         = 10,  // experience gem dropped by enemies
  Elite       = 11,  // elite enemy — gold heavy circle with crown ring
  Chest       = 12,  // golden chest dropped by elites
}

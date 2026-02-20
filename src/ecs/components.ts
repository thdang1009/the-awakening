import { defineComponent, Types } from 'bitecs'

/** World-space position in pixels */
export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
})

/** Velocity in pixels per second */
export const Velocity = defineComponent({
  x: Types.f32,
  y: Types.f32,
})

/** HP pool */
export const Health = defineComponent({
  current: Types.f32,
  max: Types.f32,
})

/** PixiJS rendering data */
export const Renderable = defineComponent({
  textureId: Types.ui8,   // index into Game's textures array
  tint: Types.ui32,       // 0xRRGGBB
  scale: Types.f32,
})

/** Circle collider radius */
export const Collider = defineComponent({
  radius: Types.f32,
})

/** Enemy behaviour */
export const Enemy = defineComponent({
  speed: Types.f32,
  damage: Types.f32,
  attackCooldown: Types.f32,   // seconds
  lastAttack: Types.f64,       // performance.now() timestamp (ms)
  splitsOnDeath: Types.ui8,    // 1 = spawns 2 mini-enemies when killed
})

/** Projectile lifetime tracking */
export const Projectile = defineComponent({
  damage:   Types.f32,
  elapsed:  Types.f32,    // seconds alive
  lifetime: Types.f32,    // max seconds
  // Event Horizon apex fix: recorded by MovementSystem when a BOOMERANG turns around
  apexX:    Types.f32,
  apexY:    Types.f32,
  apexSet:  Types.ui8,    // 1 once apex position has been recorded
})

/** Experience Gem — dropped by enemies, collected by proximity to Nexus */
export const ExperienceGem = defineComponent({
  value:      Types.f32,   // XP granted on collection
  attracting: Types.ui8,   // 1 when within pickup radius (magnetised toward nexus)
})

/** Tag: marks an entity as an Elite enemy (drops Golden Chest on death) */
export const IsElite = defineComponent()

/** Golden Chest — dropped by elites, triggers Roulette when collected */
export const GoldenChest = defineComponent()

/** Tag: this entity is the Nexus (player) */
export const IsNexus = defineComponent()

/** Tag: projectile passes through enemies without being destroyed */
export const PassThrough = defineComponent()

/** Tag: projectile steers toward nearest enemy each frame (SEEKER behavior) */
export const Seeker = defineComponent()

/** Tag: projectile reverses toward Nexus after 45% of lifetime (BOOMERANG behavior) */
export const Boomerang = defineComponent()

/** Delayed explosive charge — ticks down then detonates in AoE (DELAYED_EXPLOSION behavior) */
export const Bomb = defineComponent({
  timer:  Types.f32,   // seconds until detonation
  radius: Types.f32,   // AoE explosion radius (px)
  damage: Types.f32,   // explosion damage per enemy hit
})

/** Gravity well entity — pulls nearby enemies inward (SPAWN_BLACKHOLE / MAGNETIC_PULL behavior) */
export const Blackhole = defineComponent({
  timer:  Types.f32,   // seconds remaining
  radius: Types.f32,   // pull radius (px)
})

/** Auto-attack weapon mounted on Nexus */
export const Weapon = defineComponent({
  damage: Types.f32,
  fireRate: Types.f32,        // shots per second
  lastFire: Types.f64,        // performance.now() timestamp (ms)
  range: Types.f32,
  projectileSpeed: Types.f32,
})

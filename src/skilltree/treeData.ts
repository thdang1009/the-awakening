// ---------------------------------------------------------------------------
// Skill Tree — Node Graph
// 49 nodes: 1 start + 7×6 branch nodes + 6 cross-junction nodes
// Radial layout: 6 branches at 0°/60°/120°/180°/240°/300° (y-down coords)
// ---------------------------------------------------------------------------

import type { SkillNode } from './types'

/** Polar → cartesian (y-axis down, 0° = right) */
function p(angleDeg: number, r: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.round(Math.cos(rad) * r), y: Math.round(Math.sin(rad) * r) }
}

// Branch base angles
const RF = 0, HS = 60, BW = 120, WP = 180, CH = 240, CO = 300

export const ALL_NODES: SkillNode[] = [
  // =========================================================================
  // START
  // =========================================================================
  {
    id: 'start',
    ...p(0, 0),
    tier: 'start', branch: 'start', cost: 0,
    label: 'Energy Core',
    description: 'The Nexus awakens. All paths lead from here.',
    effects: [],
    connections: ['rf_entry', 'hs_entry', 'bw_entry', 'wp_entry', 'ch_entry', 'co_entry'],
  },

  // =========================================================================
  // RAPID FIRE BRANCH  (0° — East)   Orange
  // Identity: Sustained laser fire that culminates in a sweeping plasma beam
  // =========================================================================
  {
    id: 'rf_entry', ...p(RF, 160),
    tier: 'small', branch: 'rapidFire', cost: 1,
    label: 'Pulse Emitter',
    description: 'A faster cycling emitter reduces the gap between shots.',
    effects: [{ stat: 'fireRateBonus', value: 0.08 }],
    connections: ['rf_s1', 'rf_s2'],
  },
  {
    id: 'rf_s1', ...p(RF - 18, 285),
    tier: 'small', branch: 'rapidFire', cost: 1,
    label: 'Thermal Vent',
    description: 'Heat venting improves emitter cycling speed.',
    effects: [{ stat: 'fireRateBonus', value: 0.06 }],
    connections: ['rf_n1'],
  },
  {
    id: 'rf_s2', ...p(RF + 18, 285),
    tier: 'small', branch: 'rapidFire', cost: 1,
    label: 'Focused Aperture',
    description: 'A narrower bore increases both rate and reach.',
    effects: [{ stat: 'fireRateBonus', value: 0.05 }, { stat: 'rangeBonus', value: 0.05 }],
    connections: ['rf_n1', 'x_rf_hs'],
  },
  {
    id: 'rf_n1', ...p(RF, 430),
    tier: 'notable', branch: 'rapidFire', cost: 2,
    label: 'THERMAL ACCELERATION',
    description: 'Sustained fire superheats the emitter. The longer you hold the trigger, the faster it cycles.',
    effects: [{ stat: 'fireRateBonus', value: 0.20 }],
    behaviors: ['THERMAL_ACCELERATION'],
    connections: ['rf_s3', 'rf_s4'],
  },
  {
    id: 'rf_s3', ...p(RF - 12, 560),
    tier: 'small', branch: 'rapidFire', cost: 1,
    label: 'Superheated Core',
    description: 'Push the reactor core past its thermal ceiling.',
    effects: [{ stat: 'fireRateBonus', value: 0.08 }],
    connections: ['rf_key'],
  },
  {
    id: 'rf_s4', ...p(RF + 12, 560),
    tier: 'small', branch: 'rapidFire', cost: 1,
    label: 'Beam Collimator',
    description: 'Perfectly aligned photons fire more reliably and travel faster.',
    effects: [{ stat: 'fireRateBonus', value: 0.06 }, { stat: 'speedBonus', value: 0.05 }],
    connections: ['rf_key'],
  },
  {
    id: 'rf_key', ...p(RF, 710),
    tier: 'keystone', branch: 'rapidFire', cost: 3,
    label: 'PLASMA BEAM',
    description: 'Replaces all projectiles with a continuous sweeping beam. Fire rate ×3.5, damage ×0.6. The beam arcs across enemy clusters.',
    effects: [
      { stat: 'fireRateMultiplier', value: 3.5 },
      { stat: 'damageMultiplier',   value: 0.6 },
    ],
    behaviors: ['BEAM_MODE', 'SWEEPING'],
    connections: [],
  },

  // =========================================================================
  // HEAVY STRIKE BRANCH  (60° — South-East)   Red
  // Identity: Explosive ordnance, area denial, and knockback
  // =========================================================================
  {
    id: 'hs_entry', ...p(HS, 160),
    tier: 'small', branch: 'heavyStrike', cost: 1,
    label: 'Shockwave Round',
    description: 'Projectiles carry a concussive payload on impact.',
    effects: [{ stat: 'damageBonus', value: 0.08 }],
    connections: ['hs_s1', 'hs_s2'],
  },
  {
    id: 'hs_s1', ...p(HS - 18, 285),
    tier: 'small', branch: 'heavyStrike', cost: 1,
    label: 'Ground Shock',
    description: 'Tremors ripple outward from each impact point.',
    effects: [{ stat: 'damageBonus', value: 0.06 }],
    connections: ['hs_n1', 'x_rf_hs'],
  },
  {
    id: 'hs_s2', ...p(HS + 18, 285),
    tier: 'small', branch: 'heavyStrike', cost: 1,
    label: 'Dense Payload',
    description: 'Heavier rounds carry both more damage and more momentum.',
    effects: [{ stat: 'damageBonus', value: 0.05 }, { stat: 'speedBonus', value: 0.05 }],
    connections: ['hs_n1', 'x_hs_bw'],
  },
  {
    id: 'hs_n1', ...p(HS, 430),
    tier: 'notable', branch: 'heavyStrike', cost: 2,
    label: 'KINETIC IMPACT',
    description: 'Each projectile carries massive kinetic force. Enemies are hurled backward from the point of impact.',
    effects: [{ stat: 'damageBonus', value: 0.20 }],
    behaviors: ['KNOCKBACK'],
    connections: ['hs_s3', 'hs_s4'],
  },
  {
    id: 'hs_s3', ...p(HS - 12, 560),
    tier: 'small', branch: 'heavyStrike', cost: 1,
    label: 'Crater Charge',
    description: 'An additional explosive charge is embedded in each round.',
    effects: [{ stat: 'damageBonus', value: 0.08 }],
    connections: ['hs_key'],
  },
  {
    id: 'hs_s4', ...p(HS + 12, 560),
    tier: 'small', branch: 'heavyStrike', cost: 1,
    label: 'Seismic Range',
    description: 'Tremor waves propagate further across the arena.',
    effects: [{ stat: 'damageBonus', value: 0.05 }, { stat: 'rangeBonus', value: 0.06 }],
    connections: ['hs_key'],
  },
  {
    id: 'hs_key', ...p(HS, 710),
    tier: 'keystone', branch: 'heavyStrike', cost: 3,
    label: 'TECTONIC CRATER',
    description: 'Projectiles embed into enemies and detonate after a delay. Damage ×2.5, fire rate ×0.5. Explosions knock back all nearby enemies.',
    effects: [
      { stat: 'damageMultiplier',   value: 2.5 },
      { stat: 'fireRateMultiplier', value: 0.5 },
    ],
    behaviors: ['DELAYED_EXPLOSION', 'KNOCKBACK'],
    connections: [],
  },

  // =========================================================================
  // BULWARK BRANCH  (120° — South-West)   Blue
  // Identity: The core becomes an offensive weapon scaling with max HP
  // =========================================================================
  {
    id: 'bw_entry', ...p(BW, 160),
    tier: 'small', branch: 'bulwark', cost: 1,
    label: 'Plasma Shell',
    description: 'Hardened plasma plates reinforce the Nexus structure.',
    effects: [{ stat: 'maxHPBonus', value: 0.10 }],
    connections: ['bw_s1', 'bw_s2'],
  },
  {
    id: 'bw_s1', ...p(BW - 18, 285),
    tier: 'small', branch: 'bulwark', cost: 1,
    label: 'Hardened Mantle',
    description: 'Dense protective layers compress the core.',
    effects: [{ stat: 'maxHPBonus', value: 0.08 }],
    connections: ['bw_n1', 'x_hs_bw'],
  },
  {
    id: 'bw_s2', ...p(BW + 18, 285),
    tier: 'small', branch: 'bulwark', cost: 1,
    label: 'Reactive Plating',
    description: 'Plates flex and redistribute incoming force.',
    effects: [{ stat: 'maxHPBonus', value: 0.06 }, { stat: 'armorFlat', value: 0.04 }],
    connections: ['bw_n1', 'x_bw_wp'],
  },
  {
    id: 'bw_n1', ...p(BW, 430),
    tier: 'notable', branch: 'bulwark', cost: 2,
    label: 'THORNS AURA',
    description: 'The Nexus radiates a pulsing damage ring. The stronger the core, the fiercer the aura burns.',
    effects: [{ stat: 'maxHPBonus', value: 0.22 }],
    behaviors: ['AURA_DAMAGE'],
    connections: ['bw_s3', 'bw_s4'],
  },
  {
    id: 'bw_s3', ...p(BW - 12, 560),
    tier: 'small', branch: 'bulwark', cost: 1,
    label: 'Titan Plating',
    description: 'Maximum structural fortification achievable.',
    effects: [{ stat: 'maxHPBonus', value: 0.10 }],
    connections: ['bw_key'],
  },
  {
    id: 'bw_s4', ...p(BW + 12, 560),
    tier: 'small', branch: 'bulwark', cost: 1,
    label: 'Pressure Wave Shielding',
    description: 'Converts impact energy into additional armor and resilience.',
    effects: [{ stat: 'maxHPBonus', value: 0.06 }, { stat: 'armorFlat', value: 0.08 }],
    connections: ['bw_key'],
  },
  {
    id: 'bw_key', ...p(BW, 710),
    tier: 'keystone', branch: 'bulwark', cost: 3,
    label: 'RADIANT SUPERNOVA',
    description: 'The Nexus stops firing and becomes a burning star. Max HP ×2.0. Aura damage scales with HP. Each hit received causes the aura to violently expand.',
    effects: [
      { stat: 'maxHPMultiplier',       value: 2.0  },
      { stat: 'damageTakenMultiplier', value: 0.75 },
    ],
    behaviors: ['AURA_DAMAGE', 'SCALES_WITH_HP'],
    connections: [],
  },

  // =========================================================================
  // WARP BRANCH  (180° — West)   Cyan
  // Identity: Space-time manipulation, crowd control, and black holes
  // =========================================================================
  {
    id: 'wp_entry', ...p(WP, 160),
    tier: 'small', branch: 'warp', cost: 1,
    label: 'Spatial Distortion',
    description: 'Warps the detection field to extend targeting range.',
    effects: [{ stat: 'rangeBonus', value: 0.10 }],
    connections: ['wp_s1', 'wp_s2'],
  },
  {
    id: 'wp_s1', ...p(WP - 18, 285),
    tier: 'small', branch: 'warp', cost: 1,
    label: 'Graviton Field',
    description: 'A subtle gravity bend pushes the sensor horizon outward.',
    effects: [{ stat: 'rangeBonus', value: 0.08 }],
    connections: ['wp_n1', 'x_bw_wp'],
  },
  {
    id: 'wp_s2', ...p(WP + 18, 285),
    tier: 'small', branch: 'warp', cost: 1,
    label: 'Tachyon Pulse',
    description: 'Tachyon-laced projectiles punch through spacetime faster.',
    effects: [{ stat: 'rangeBonus', value: 0.06 }, { stat: 'speedBonus', value: 0.06 }],
    connections: ['wp_n1', 'x_wp_ch'],
  },
  {
    id: 'wp_n1', ...p(WP, 430),
    tier: 'notable', branch: 'warp', cost: 2,
    label: 'BOOMERANG TRAJECTORY',
    description: 'Projectiles curve in a wide arc and return to the Nexus, striking enemies on the way out and back.',
    effects: [{ stat: 'rangeBonus', value: 0.20 }],
    behaviors: ['BOOMERANG'],
    connections: ['wp_s3', 'wp_s4'],
  },
  {
    id: 'wp_s3', ...p(WP - 12, 560),
    tier: 'small', branch: 'warp', cost: 1,
    label: 'Dark Matter Drive',
    description: 'Warped matter accelerates projectiles to near-light speed.',
    effects: [{ stat: 'speedBonus', value: 0.10 }],
    connections: ['wp_key'],
  },
  {
    id: 'wp_s4', ...p(WP + 12, 560),
    tier: 'small', branch: 'warp', cost: 1,
    label: 'Dimensional Reach',
    description: 'Tears the fabric of detection range wider while boosting bolt velocity.',
    effects: [{ stat: 'rangeBonus', value: 0.08 }, { stat: 'speedBonus', value: 0.06 }],
    connections: ['wp_key'],
  },
  {
    id: 'wp_key', ...p(WP, 710),
    tier: 'keystone', branch: 'warp', cost: 3,
    label: 'EVENT HORIZON',
    description: 'Projectiles halt at max range and collapse into black holes. Their immense gravity pulls all enemies inexorably inward.',
    effects: [],
    behaviors: ['SPAWN_BLACKHOLE', 'MAGNETIC_PULL'],
    connections: [],
  },

  // =========================================================================
  // CHAIN BRANCH  (240° — North-West)   Purple
  // Identity: Smart targeting and mathematical wave clear via chain lightning
  // =========================================================================
  {
    id: 'ch_entry', ...p(CH, 160),
    tier: 'small', branch: 'chain', cost: 1,
    label: 'Signal Lock',
    description: 'The Nexus projects a targeting signal, firing two seeking bolts.',
    effects: [{ stat: 'multishotAdd', value: 1 }],
    connections: ['ch_s1', 'ch_s2'],
  },
  {
    id: 'ch_s1', ...p(CH - 18, 285),
    tier: 'small', branch: 'chain', cost: 1,
    label: 'Tracking Array',
    description: 'Enhanced tracking hardware quickens the targeting cycle.',
    effects: [{ stat: 'fireRateBonus', value: 0.06 }],
    connections: ['ch_n1', 'x_wp_ch'],
  },
  {
    id: 'ch_s2', ...p(CH + 18, 285),
    tier: 'small', branch: 'chain', cost: 1,
    label: 'Arc Conductor',
    description: 'Each bolt carries an additional charge on impact.',
    effects: [{ stat: 'damageBonus', value: 0.08 }],
    connections: ['ch_n1', 'x_ch_co'],
  },
  {
    id: 'ch_n1', ...p(CH, 430),
    tier: 'notable', branch: 'chain', cost: 2,
    label: 'SEEKER SWARM',
    description: 'Projectiles develop a hunting instinct, curving mid-flight to intercept enemies anywhere in the arena.',
    effects: [{ stat: 'multishotAdd', value: 1 }, { stat: 'damageBonus', value: 0.12 }],
    behaviors: ['SEEKER'],
    connections: ['ch_s3', 'ch_s4'],
  },
  {
    id: 'ch_s3', ...p(CH - 12, 560),
    tier: 'small', branch: 'chain', cost: 1,
    label: 'Chain Capacitor',
    description: 'Stores enough charge for rapid follow-up arcs.',
    effects: [{ stat: 'fireRateBonus', value: 0.08 }],
    connections: ['ch_key'],
  },
  {
    id: 'ch_s4', ...p(CH + 12, 560),
    tier: 'small', branch: 'chain', cost: 1,
    label: 'Resonance Field',
    description: 'A resonating field spawns an additional seeker bolt.',
    effects: [{ stat: 'multishotAdd', value: 1 }],
    connections: ['ch_key'],
  },
  {
    id: 'ch_key', ...p(CH, 710),
    tier: 'keystone', branch: 'chain', cost: 3,
    label: 'TESLA NETWORK',
    description: 'Replaces projectiles with arcing chain lightning. Always fires at the nearest enemy and jumps to two more on kill. Damage ×1.5.',
    effects: [{ stat: 'damageMultiplier', value: 1.5 }],
    behaviors: ['CHAIN_LIGHTNING', 'SMART_TARGETING'],
    connections: [],
  },

  // =========================================================================
  // COLLECTOR BRANCH  (300° — North-East)   Gold
  // Identity: Economy-based scaling and orbital combat helpers
  // =========================================================================
  {
    id: 'co_entry', ...p(CO, 160),
    tier: 'small', branch: 'collector', cost: 1,
    label: 'Resource Extractor',
    description: 'Precision kills yield richer data dividends.',
    effects: [{ stat: 'scoreBonus', value: 0.20 }],
    connections: ['co_s1', 'co_s2'],
  },
  {
    id: 'co_s1', ...p(CO - 18, 285),
    tier: 'small', branch: 'collector', cost: 1,
    label: 'Market Analysis',
    description: 'Refined extraction algorithms improve kill yield.',
    effects: [{ stat: 'scoreBonus', value: 0.15 }],
    connections: ['co_n1', 'x_ch_co'],
  },
  {
    id: 'co_s2', ...p(CO + 18, 285),
    tier: 'small', branch: 'collector', cost: 1,
    label: 'Compound Interest',
    description: 'Accumulated wealth flows back into firing systems.',
    effects: [{ stat: 'scoreBonus', value: 0.15 }, { stat: 'fireRateBonus', value: 0.05 }],
    connections: ['co_n1', 'x_co_rf'],
  },
  {
    id: 'co_n1', ...p(CO, 430),
    tier: 'notable', branch: 'collector', cost: 2,
    label: 'KINETIC HARVEST',
    description: 'Score pickups irradiate on contact. Enemies that walk over dropped data take continuous damage. +1 Skill Point per wave.',
    effects: [{ stat: 'scoreBonus', value: 0.35 }, { stat: 'bonusSPPerWave', value: 1 }],
    behaviors: ['KINETIC_HARVEST'],
    connections: ['co_s3', 'co_s4'],
  },
  {
    id: 'co_s3', ...p(CO - 12, 560),
    tier: 'small', branch: 'collector', cost: 1,
    label: 'Portfolio Expansion',
    description: 'Compound returns multiply on every archived kill.',
    effects: [{ stat: 'scoreBonus', value: 0.20 }],
    connections: ['co_key'],
  },
  {
    id: 'co_s4', ...p(CO + 12, 560),
    tier: 'small', branch: 'collector', cost: 1,
    label: 'Long Range Acquisition',
    description: 'Extends the resource-gathering network across the arena.',
    effects: [{ stat: 'scoreBonus', value: 0.15 }, { stat: 'rangeBonus', value: 0.08 }],
    connections: ['co_key'],
  },
  {
    id: 'co_key', ...p(CO, 710),
    tier: 'keystone', branch: 'collector', cost: 3,
    label: 'CAPITALIST CORE',
    description: 'Your wealth becomes your weapon. Score ×2.0. Damage scales with current Score. Spending skill points spawns a permanent orbital combat drone.',
    effects: [{ stat: 'scoreMultiplier', value: 2.0 }],
    behaviors: ['DAMAGE_SCALES_WITH_SCORE', 'ORBITAL_DRONES'],
    connections: [],
  },

  // =========================================================================
  // CROSS-JUNCTION NODES  (between adjacent branch pairs, r=340)
  // =========================================================================
  {
    id: 'x_rf_hs', ...p(30, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Incendiary Stream',
    description: 'Rapid beam fire carrying explosive charge — fast and devastating.',
    effects: [{ stat: 'fireRateBonus', value: 0.06 }, { stat: 'damageBonus', value: 0.05 }],
    connections: ['rf_s2', 'hs_s1'],
  },
  {
    id: 'x_hs_bw', ...p(90, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Blast Armor',
    description: 'Defensive plating imbued with reactive explosives — tough and lethal.',
    effects: [{ stat: 'damageBonus', value: 0.06 }, { stat: 'maxHPBonus', value: 0.08 }],
    connections: ['hs_s2', 'bw_s1'],
  },
  {
    id: 'x_bw_wp', ...p(150, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Warped Barrier',
    description: 'A shield that folds incoming attacks into another dimension.',
    effects: [{ stat: 'maxHPBonus', value: 0.08 }, { stat: 'rangeBonus', value: 0.06 }],
    connections: ['bw_s2', 'wp_s1'],
  },
  {
    id: 'x_wp_ch', ...p(210, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Phantom Seekers',
    description: 'Space-warped projectiles that relentlessly hunt their targets.',
    effects: [{ stat: 'rangeBonus', value: 0.06 }, { stat: 'speedBonus', value: 0.06 }],
    connections: ['wp_s2', 'ch_s1'],
  },
  {
    id: 'x_ch_co', ...p(270, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Bounty Circuit',
    description: 'Smart targeting ensures every kill is catalogued and richly rewarded.',
    effects: [{ stat: 'scoreBonus', value: 0.15 }, { stat: 'fireRateBonus', value: 0.06 }],
    connections: ['ch_s2', 'co_s1'],
  },
  {
    id: 'x_co_rf', ...p(330, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Profit Beam',
    description: 'The faster the fire rate, the richer the yield.',
    effects: [{ stat: 'scoreBonus', value: 0.15 }, { stat: 'fireRateBonus', value: 0.06 }],
    connections: ['co_s2', 'rf_s1'],
  },
]

// ---------------------------------------------------------------------------
// Derived lookups (built once at module load)
// ---------------------------------------------------------------------------

/** ID → SkillNode */
export const NODE_MAP = new Map<string, SkillNode>(ALL_NODES.map(n => [n.id, n]))

/** Bidirectional adjacency map */
export function buildAdjacency(): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  for (const node of ALL_NODES) {
    if (!adj.has(node.id)) adj.set(node.id, new Set())
    for (const conn of node.connections) {
      adj.get(node.id)!.add(conn)
      if (!adj.has(conn)) adj.set(conn, new Set())
      adj.get(conn)!.add(node.id)
    }
  }
  return adj
}

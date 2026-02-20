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
  // =========================================================================
  {
    id: 'rf_entry', ...p(RF, 160),
    tier: 'small', branch: 'rapidFire', cost: 1,
    label: 'Quick Trigger',
    description: 'Reduces firing hesitation.',
    effects: [{ stat: 'fireRateBonus', value: 0.08 }],
    connections: ['rf_s1', 'rf_s2'],
  },
  {
    id: 'rf_s1', ...p(RF - 18, 285),
    tier: 'small', branch: 'rapidFire', cost: 1,
    label: 'Hair Trigger',
    description: 'Even the slightest delay is shaved away.',
    effects: [{ stat: 'fireRateBonus', value: 0.06 }],
    connections: ['rf_n1'],
  },
  {
    id: 'rf_s2', ...p(RF + 18, 285),
    tier: 'small', branch: 'rapidFire', cost: 1,
    label: 'Steady Aim',
    description: 'Consistency in fire rhythm also extends reach.',
    effects: [{ stat: 'fireRateBonus', value: 0.05 }, { stat: 'rangeBonus', value: 0.05 }],
    connections: ['rf_n1', 'x_rf_hs'],
  },
  {
    id: 'rf_n1', ...p(RF, 430),
    tier: 'notable', branch: 'rapidFire', cost: 2,
    label: 'BULLET STORM',
    description: 'A relentless torrent of energy bolts.',
    effects: [{ stat: 'fireRateBonus', value: 0.22 }],
    connections: ['rf_s3', 'rf_s4'],
  },
  {
    id: 'rf_s3', ...p(RF - 12, 560),
    tier: 'small', branch: 'rapidFire', cost: 1,
    label: 'Overclocked Barrel',
    description: 'Push the emitter beyond its rated limits.',
    effects: [{ stat: 'fireRateBonus', value: 0.08 }],
    connections: ['rf_key'],
  },
  {
    id: 'rf_s4', ...p(RF + 12, 560),
    tier: 'small', branch: 'rapidFire', cost: 1,
    label: 'Swift Mechanism',
    description: 'A lighter mechanism, faster on the draw.',
    effects: [{ stat: 'fireRateBonus', value: 0.06 }, { stat: 'speedBonus', value: 0.05 }],
    connections: ['rf_key'],
  },
  {
    id: 'rf_key', ...p(RF, 710),
    tier: 'keystone', branch: 'rapidFire', cost: 3,
    label: 'MACHINE GUN PROTOCOL',
    description: 'Unleash a storm. Fire rate ×2.8, but damage ×0.7.',
    effects: [],
    keystoneId: 'machineGunProtocol',
    connections: [],
  },

  // =========================================================================
  // HEAVY STRIKE BRANCH  (60° — South-East)   Red
  // =========================================================================
  {
    id: 'hs_entry', ...p(HS, 160),
    tier: 'small', branch: 'heavyStrike', cost: 1,
    label: 'Sharp Edges',
    description: 'Refined energy edges cut deeper.',
    effects: [{ stat: 'damageBonus', value: 0.08 }],
    connections: ['hs_s1', 'hs_s2'],
  },
  {
    id: 'hs_s1', ...p(HS - 18, 285),
    tier: 'small', branch: 'heavyStrike', cost: 1,
    label: 'Piercing Force',
    description: 'Focuses energy into a denser point.',
    effects: [{ stat: 'damageBonus', value: 0.06 }],
    connections: ['hs_n1', 'x_rf_hs'],
  },
  {
    id: 'hs_s2', ...p(HS + 18, 285),
    tier: 'small', branch: 'heavyStrike', cost: 1,
    label: 'Impact Rounds',
    description: 'Heavier bolts travel with more authority.',
    effects: [{ stat: 'damageBonus', value: 0.05 }, { stat: 'speedBonus', value: 0.05 }],
    connections: ['hs_n1', 'x_hs_bw'],
  },
  {
    id: 'hs_n1', ...p(HS, 430),
    tier: 'notable', branch: 'heavyStrike', cost: 2,
    label: 'HEAVY CALIBER',
    description: 'Raw, crushing projectile power.',
    effects: [{ stat: 'damageBonus', value: 0.22 }],
    connections: ['hs_s3', 'hs_s4'],
  },
  {
    id: 'hs_s3', ...p(HS - 12, 560),
    tier: 'small', branch: 'heavyStrike', cost: 1,
    label: 'Devastator',
    description: 'Each bolt carries a payload of devastation.',
    effects: [{ stat: 'damageBonus', value: 0.08 }],
    connections: ['hs_key'],
  },
  {
    id: 'hs_s4', ...p(HS + 12, 560),
    tier: 'small', branch: 'heavyStrike', cost: 1,
    label: 'Power Core Tap',
    description: 'Draws deeper from the nexus core for range.',
    effects: [{ stat: 'damageBonus', value: 0.06 }, { stat: 'rangeBonus', value: 0.05 }],
    connections: ['hs_key'],
  },
  {
    id: 'hs_key', ...p(HS, 710),
    tier: 'keystone', branch: 'heavyStrike', cost: 3,
    label: 'SINGULARITY CANNON',
    description: 'Collapses each shot into a singularity. Damage ×2.0, fire rate ×0.6.',
    effects: [],
    keystoneId: 'singularityCannon',
    connections: [],
  },

  // =========================================================================
  // BULWARK BRANCH  (120° — South-West)   Blue
  // =========================================================================
  {
    id: 'bw_entry', ...p(BW, 160),
    tier: 'small', branch: 'bulwark', cost: 1,
    label: 'Reinforced Core',
    description: 'Denser energy shielding around the Nexus.',
    effects: [{ stat: 'maxHPBonus', value: 0.10 }],
    connections: ['bw_s1', 'bw_s2'],
  },
  {
    id: 'bw_s1', ...p(BW - 18, 285),
    tier: 'small', branch: 'bulwark', cost: 1,
    label: 'Dense Matter',
    description: 'Compressed matter for extra resilience.',
    effects: [{ stat: 'maxHPBonus', value: 0.08 }],
    connections: ['bw_n1', 'x_hs_bw'],
  },
  {
    id: 'bw_s2', ...p(BW + 18, 285),
    tier: 'small', branch: 'bulwark', cost: 1,
    label: 'Energy Barrier',
    description: 'A passive field deflects minor strikes.',
    effects: [{ stat: 'maxHPBonus', value: 0.06 }, { stat: 'armorFlat', value: 0.04 }],
    connections: ['bw_n1', 'x_bw_wp'],
  },
  {
    id: 'bw_n1', ...p(BW, 430),
    tier: 'notable', branch: 'bulwark', cost: 2,
    label: 'FORTRESS PROTOCOL',
    description: 'The Nexus becomes a near-impenetrable fortress.',
    effects: [{ stat: 'maxHPBonus', value: 0.25 }],
    connections: ['bw_s3', 'bw_s4'],
  },
  {
    id: 'bw_s3', ...p(BW - 12, 560),
    tier: 'small', branch: 'bulwark', cost: 1,
    label: 'Adamantine Shell',
    description: 'The hardest known energy composite.',
    effects: [{ stat: 'maxHPBonus', value: 0.10 }],
    connections: ['bw_key'],
  },
  {
    id: 'bw_s4', ...p(BW + 12, 560),
    tier: 'small', branch: 'bulwark', cost: 1,
    label: 'Ancient Plating',
    description: 'Archaic armor techniques layered onto the core.',
    effects: [{ stat: 'maxHPBonus', value: 0.06 }, { stat: 'armorFlat', value: 0.08 }],
    connections: ['bw_key'],
  },
  {
    id: 'bw_key', ...p(BW, 710),
    tier: 'keystone', branch: 'bulwark', cost: 3,
    label: 'INDESTRUCTIBLE CORE',
    description: 'Max HP ×2.0. All incoming damage reduced by 25%.',
    effects: [],
    keystoneId: 'indestructibleCore',
    connections: [],
  },

  // =========================================================================
  // WARP BRANCH  (180° — West)   Cyan
  // =========================================================================
  {
    id: 'wp_entry', ...p(WP, 160),
    tier: 'small', branch: 'warp', cost: 1,
    label: 'Long Reach',
    description: 'Extends the targeting field outward.',
    effects: [{ stat: 'rangeBonus', value: 0.10 }],
    connections: ['wp_s1', 'wp_s2'],
  },
  {
    id: 'wp_s1', ...p(WP - 18, 285),
    tier: 'small', branch: 'warp', cost: 1,
    label: 'Extended Field',
    description: 'Push the sensor grid further.',
    effects: [{ stat: 'rangeBonus', value: 0.08 }],
    connections: ['wp_n1', 'x_bw_wp'],
  },
  {
    id: 'wp_s2', ...p(WP + 18, 285),
    tier: 'small', branch: 'warp', cost: 1,
    label: 'Swift Payload',
    description: 'Faster bolts cover greater distance per second.',
    effects: [{ stat: 'rangeBonus', value: 0.06 }, { stat: 'speedBonus', value: 0.06 }],
    connections: ['wp_n1', 'x_wp_ch'],
  },
  {
    id: 'wp_n1', ...p(WP, 430),
    tier: 'notable', branch: 'warp', cost: 2,
    label: 'WARP SHOTS',
    description: 'Projectiles bend spacetime as they fly.',
    effects: [{ stat: 'rangeBonus', value: 0.22 }],
    connections: ['wp_s3', 'wp_s4'],
  },
  {
    id: 'wp_s3', ...p(WP - 12, 560),
    tier: 'small', branch: 'warp', cost: 1,
    label: 'Quantum Propulsion',
    description: 'Near-light projectile velocity.',
    effects: [{ stat: 'speedBonus', value: 0.10 }],
    connections: ['wp_key'],
  },
  {
    id: 'wp_s4', ...p(WP + 12, 560),
    tier: 'small', branch: 'warp', cost: 1,
    label: 'Far Sight',
    description: 'Lock onto targets across the entire arena.',
    effects: [{ stat: 'rangeBonus', value: 0.08 }, { stat: 'speedBonus', value: 0.06 }],
    connections: ['wp_key'],
  },
  {
    id: 'wp_key', ...p(WP, 710),
    tier: 'keystone', branch: 'warp', cost: 3,
    label: 'QUANTUM TUNNELING',
    description: 'Projectiles phase through enemies, hitting all in their path.',
    effects: [],
    keystoneId: 'quantumTunneling',
    connections: [],
  },

  // =========================================================================
  // CHAIN BRANCH  (240° — North-West)   Purple
  // =========================================================================
  {
    id: 'ch_entry', ...p(CH, 160),
    tier: 'small', branch: 'chain', cost: 1,
    label: 'Split Shot',
    description: 'The Nexus fires two bolts instead of one.',
    effects: [{ stat: 'multishotAdd', value: 1 }],
    connections: ['ch_s1', 'ch_s2'],
  },
  {
    id: 'ch_s1', ...p(CH - 18, 285),
    tier: 'small', branch: 'chain', cost: 1,
    label: 'Fan Fire',
    description: 'The firing rhythm quickens with multiple shots.',
    effects: [{ stat: 'fireRateBonus', value: 0.06 }],
    connections: ['ch_n1', 'x_wp_ch'],
  },
  {
    id: 'ch_s2', ...p(CH + 18, 285),
    tier: 'small', branch: 'chain', cost: 1,
    label: 'Spread',
    description: 'Each bolt carries more punch in the spread.',
    effects: [{ stat: 'damageBonus', value: 0.08 }],
    connections: ['ch_n1', 'x_ch_co'],
  },
  {
    id: 'ch_n1', ...p(CH, 430),
    tier: 'notable', branch: 'chain', cost: 2,
    label: 'VOLLEY',
    description: 'A true volley: three simultaneous projectiles.',
    effects: [{ stat: 'multishotAdd', value: 1 }, { stat: 'fireRateBonus', value: 0.10 }],
    connections: ['ch_s3', 'ch_s4'],
  },
  {
    id: 'ch_s3', ...p(CH - 12, 560),
    tier: 'small', branch: 'chain', cost: 1,
    label: 'Cluster Payload',
    description: 'Higher salvo cadence.',
    effects: [{ stat: 'fireRateBonus', value: 0.08 }],
    connections: ['ch_key'],
  },
  {
    id: 'ch_s4', ...p(CH + 12, 560),
    tier: 'small', branch: 'chain', cost: 1,
    label: 'Cascade',
    description: 'Four simultaneous bolts saturate the field.',
    effects: [{ stat: 'multishotAdd', value: 1 }],
    connections: ['ch_key'],
  },
  {
    id: 'ch_key', ...p(CH, 710),
    tier: 'keystone', branch: 'chain', cost: 3,
    label: 'NOVA BURST',
    description: 'Fires 8 projectiles in all directions simultaneously.',
    effects: [],
    keystoneId: 'novaBurst',
    connections: [],
  },

  // =========================================================================
  // COLLECTOR BRANCH  (300° — North-East)   Gold
  // =========================================================================
  {
    id: 'co_entry', ...p(CO, 160),
    tier: 'small', branch: 'collector', cost: 1,
    label: 'Efficient Slayer',
    description: 'Precision kills yield greater data.',
    effects: [{ stat: 'scoreBonus', value: 0.20 }],
    connections: ['co_s1', 'co_s2'],
  },
  {
    id: 'co_s1', ...p(CO - 18, 285),
    tier: 'small', branch: 'collector', cost: 1,
    label: 'Data Harvest',
    description: 'Extract more value from each destruction.',
    effects: [{ stat: 'scoreBonus', value: 0.15 }],
    connections: ['co_n1', 'x_ch_co'],
  },
  {
    id: 'co_s2', ...p(CO + 18, 285),
    tier: 'small', branch: 'collector', cost: 1,
    label: 'Knowledge Chain',
    description: 'Harvesting knowledge speeds up the rate of fire.',
    effects: [{ stat: 'scoreBonus', value: 0.15 }, { stat: 'fireRateBonus', value: 0.05 }],
    connections: ['co_n1', 'x_co_rf'],
  },
  {
    id: 'co_n1', ...p(CO, 430),
    tier: 'notable', branch: 'collector', cost: 2,
    label: 'ARCHIVE NETWORK',
    description: 'Kills generate experience. +1 skill point per wave clear.',
    effects: [{ stat: 'scoreBonus', value: 0.40 }, { stat: 'bonusSPPerWave', value: 1 }],
    connections: ['co_s3', 'co_s4'],
  },
  {
    id: 'co_s3', ...p(CO - 12, 560),
    tier: 'small', branch: 'collector', cost: 1,
    label: 'Total Recall',
    description: 'Perfect memory for every data fragment.',
    effects: [{ stat: 'scoreBonus', value: 0.20 }],
    connections: ['co_key'],
  },
  {
    id: 'co_s4', ...p(CO + 12, 560),
    tier: 'small', branch: 'collector', cost: 1,
    label: 'Oracle Eye',
    description: 'Omniscient targeting extends the kill zone.',
    effects: [{ stat: 'scoreBonus', value: 0.15 }, { stat: 'rangeBonus', value: 0.08 }],
    connections: ['co_key'],
  },
  {
    id: 'co_key', ...p(CO, 710),
    tier: 'keystone', branch: 'collector', cost: 3,
    label: 'OMNISCIENT',
    description: 'All-seeing. Score per kill ×2.',
    effects: [],
    keystoneId: 'omniscient',
    connections: [],
  },

  // =========================================================================
  // CROSS-JUNCTION NODES  (between adjacent branch pairs, r=340)
  // =========================================================================
  {
    id: 'x_rf_hs', ...p(30, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Aggressive Circuit',
    description: 'Speed of attack meets weight of impact.',
    effects: [{ stat: 'fireRateBonus', value: 0.06 }, { stat: 'damageBonus', value: 0.05 }],
    connections: ['rf_s2', 'hs_s1'],
  },
  {
    id: 'x_hs_bw', ...p(90, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Brutal Resilience',
    description: 'Sheer force and unyielding endurance.',
    effects: [{ stat: 'damageBonus', value: 0.06 }, { stat: 'maxHPBonus', value: 0.08 }],
    connections: ['hs_s2', 'bw_s1'],
  },
  {
    id: 'x_bw_wp', ...p(150, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Enduring Reach',
    description: 'Fortified core extends sensor range.',
    effects: [{ stat: 'maxHPBonus', value: 0.08 }, { stat: 'rangeBonus', value: 0.06 }],
    connections: ['bw_s2', 'wp_s1'],
  },
  {
    id: 'x_wp_ch', ...p(210, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Rapid Spread',
    description: 'Far-reaching fields scatter multiple bolts.',
    effects: [{ stat: 'rangeBonus', value: 0.06 }, { stat: 'speedBonus', value: 0.06 }],
    connections: ['wp_s2', 'ch_s1'],
  },
  {
    id: 'x_ch_co', ...p(270, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Harvest Volley',
    description: 'More kills, more data, faster fire.',
    effects: [{ stat: 'scoreBonus', value: 0.15 }, { stat: 'fireRateBonus', value: 0.06 }],
    connections: ['ch_s2', 'co_s1'],
  },
  {
    id: 'x_co_rf', ...p(330, 340),
    tier: 'small', branch: 'junction', cost: 1,
    label: 'Rapid Collection',
    description: 'Fast kills yield even more score.',
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

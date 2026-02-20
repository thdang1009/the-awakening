// ---------------------------------------------------------------------------
// Build Code — encode/decode active skill tree nodes as a compact string
// Format: "NEXUS-" prefix + Base64 of a bitmask over ALL_NODES indices
// ---------------------------------------------------------------------------

import { ALL_NODES, buildAdjacency } from '../skilltree/treeData'

const NODE_IDS  = ALL_NODES.map(n => n.id)
const BYTE_COUNT = Math.ceil(NODE_IDS.length / 8)
const PREFIX     = 'NEXUS-'

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

/** Encode a set of active node IDs to a shareable build code. */
export function encodeBuild(activeNodes: ReadonlySet<string>): string {
  const bytes = new Uint8Array(BYTE_COUNT)
  for (let i = 0; i < NODE_IDS.length; i++) {
    if (activeNodes.has(NODE_IDS[i])) {
      bytes[Math.floor(i / 8)] |= 1 << (i % 8)
    }
  }
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return PREFIX + btoa(binary)
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

/**
 * Decode a build code back to a node ID set.
 * Returns null if the code is malformed or describes a disconnected graph.
 */
export function decodeBuild(code: string): Set<string> | null {
  const stripped = code.trim()
  if (!stripped.toUpperCase().startsWith(PREFIX)) return null
  try {
    const b64     = stripped.slice(PREFIX.length)
    const binary  = atob(b64)
    const bytes   = Uint8Array.from(binary, c => c.charCodeAt(0))
    const active  = new Set<string>()

    for (let i = 0; i < NODE_IDS.length; i++) {
      const byteIdx = Math.floor(i / 8)
      const bitIdx  = i % 8
      if (byteIdx < bytes.length && (bytes[byteIdx] & (1 << bitIdx))) {
        active.add(NODE_IDS[i])
      }
    }

    // 'start' is always present
    active.add('start')

    // Every active node must be reachable from 'start' via other active nodes
    if (!validateConnectivity(active)) return null

    return active
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateConnectivity(active: Set<string>): boolean {
  const adj     = buildAdjacency()
  const visited = new Set<string>()
  const queue: string[] = ['start']
  visited.add('start')

  while (queue.length > 0) {
    const curr = queue.shift()!
    for (const neighbor of (adj.get(curr) ?? [])) {
      if (active.has(neighbor) && !visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  for (const id of active) {
    if (!visited.has(id)) return false
  }
  return true
}

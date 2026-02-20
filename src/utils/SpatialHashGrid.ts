/**
 * Spatial Hash Grid for O(1) average-case broad-phase collision detection.
 * Divides world space into fixed-size cells; entities register in every cell
 * they overlap. Nearby-entity queries only scan relevant cells.
 */
export class SpatialHashGrid {
  private readonly cells = new Map<number, number[]>()
  private readonly cellSize: number

  constructor(cellSize: number) {
    this.cellSize = cellSize
  }

  /** Cantor-style hash for integer cell coords (offset so negatives work) */
  private hash(cx: number, cy: number): number {
    const x = cx + 2048
    const y = cy + 2048
    return x * 4096 + y
  }

  /** Insert an entity into all cells it overlaps given a circle footprint */
  insert(eid: number, x: number, y: number, radius: number): void {
    const minCX = Math.floor((x - radius) / this.cellSize)
    const maxCX = Math.floor((x + radius) / this.cellSize)
    const minCY = Math.floor((y - radius) / this.cellSize)
    const maxCY = Math.floor((y + radius) / this.cellSize)

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const key = this.hash(cx, cy)
        let cell = this.cells.get(key)
        if (!cell) {
          cell = []
          this.cells.set(key, cell)
        }
        cell.push(eid)
      }
    }
  }

  /** Return candidate entity IDs near the given circle (may include duplicates) */
  queryCircle(x: number, y: number, radius: number): number[] {
    const minCX = Math.floor((x - radius) / this.cellSize)
    const maxCX = Math.floor((x + radius) / this.cellSize)
    const minCY = Math.floor((y - radius) / this.cellSize)
    const maxCY = Math.floor((y + radius) / this.cellSize)

    const seen = new Set<number>()
    const result: number[] = []

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this.hash(cx, cy))
        if (!cell) continue
        for (const eid of cell) {
          if (!seen.has(eid)) {
            seen.add(eid)
            result.push(eid)
          }
        }
      }
    }
    return result
  }

  clear(): void {
    this.cells.clear()
  }
}

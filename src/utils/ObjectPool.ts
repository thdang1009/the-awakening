/**
 * Generic object pool to avoid GC pressure during gameplay.
 * Pre-allocates objects and recycles them instead of allocating new ones.
 */
export class ObjectPool<T> {
  private readonly pool: T[] = []
  private readonly _factory: () => T
  private readonly _reset: (obj: T) => void

  constructor(factory: () => T, reset: (obj: T) => void, initialSize = 0) {
    this._factory = factory
    this._reset = reset
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory())
    }
  }

  acquire(): T {
    return this.pool.length > 0 ? this.pool.pop()! : this._factory()
  }

  release(obj: T): void {
    this._reset(obj)
    this.pool.push(obj)
  }

  get available(): number {
    return this.pool.length
  }
}

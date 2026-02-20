/**
 * Keyboard input manager — tracks WASD / Arrow key states.
 * Produces a normalized movement vector each frame.
 */
export class InputManager {
  private readonly keys = new Set<string>()

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code)
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code)
  }

  constructor() {
    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
  }

  /** Returns a pre-normalized direction vector based on current WASD / Arrow input */
  getMovementVector(): { x: number; y: number } {
    let x = 0
    let y = 0

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    y -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  y += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1

    // Normalize diagonal so diagonal speed equals cardinal speed
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2
      x *= inv
      y *= inv
    }

    return { x, y }
  }

  isPressed(code: string): boolean {
    return this.keys.has(code)
  }

  destroy(): void {
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
    this.keys.clear()
  }
}

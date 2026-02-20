import { defineQuery, enterQuery, exitQuery } from 'bitecs'
import { Container, Sprite, Texture } from 'pixi.js'
import { Position, Renderable } from '../ecs/components'
import { GameWorld } from '../ecs/world'

const renderableQuery = defineQuery([Position, Renderable])
const enteredQuery = enterQuery(renderableQuery)
const exitedQuery = exitQuery(renderableQuery)

/**
 * Synchronises ECS data to PixiJS sprites.
 * Uses enterQuery / exitQuery to create and destroy sprites only when entities
 * are added or removed — no per-frame allocation.
 */
export class RenderSystem {
  private readonly spriteMap = new Map<number, Sprite>()
  private readonly textures: Texture[]
  private readonly container: Container

  constructor(textures: Texture[], container: Container) {
    this.textures = textures
    this.container = container
  }

  update(world: GameWorld): void {
    // Create sprites for newly renderable entities
    const entered = enteredQuery(world)
    for (let i = 0; i < entered.length; i++) {
      const eid = entered[i]
      const textureId = Renderable.textureId[eid]
      const sprite = new Sprite(this.textures[textureId])
      sprite.anchor.set(0.5)
      sprite.tint = Renderable.tint[eid]
      sprite.scale.set(Renderable.scale[eid])
      this.container.addChild(sprite)
      this.spriteMap.set(eid, sprite)
    }

    // Destroy sprites for removed entities
    const exited = exitedQuery(world)
    for (let i = 0; i < exited.length; i++) {
      const eid = exited[i]
      const sprite = this.spriteMap.get(eid)
      if (sprite) {
        this.container.removeChild(sprite)
        sprite.destroy()
        this.spriteMap.delete(eid)
      }
    }

    // Sync position, tint, and scale every frame
    const entities = renderableQuery(world)
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i]
      const sprite = this.spriteMap.get(eid)
      if (!sprite) continue
      sprite.x = Position.x[eid]
      sprite.y = Position.y[eid]
      sprite.tint = Renderable.tint[eid]
      sprite.scale.set(Renderable.scale[eid])
    }
  }

  /** Clean up all managed sprites (called on restart) */
  destroy(): void {
    for (const sprite of this.spriteMap.values()) {
      sprite.destroy()
    }
    this.spriteMap.clear()
  }
}

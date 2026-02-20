import {
  Application, Graphics, Container, Text, TextStyle, Texture,
} from 'pixi.js'
import { addComponent, addEntity, defineQuery } from 'bitecs'
import {
  Position, Health, Collider, IsNexus, Weapon, Renderable, Velocity,
} from '../ecs/components'
import { GameWorld, createGameWorld } from '../ecs/world'
import { RenderSystem } from '../systems/RenderSystem'
import { movementSystem } from '../systems/MovementSystem'
import { enemyAISystem } from '../systems/EnemyAISystem'
import { weaponSystem } from '../systems/WeaponSystem'
import { collisionSystem } from '../systems/CollisionSystem'
import { lifetimeSystem } from '../systems/LifetimeSystem'
import { spawnerSystem, resetSpawner, setSpawnerCallbacks } from '../systems/SpawnerSystem'
import { auraSystem } from '../systems/AuraSystem'
import { bombSystem } from '../systems/BombSystem'
import { blackholeSystem } from '../systems/BlackholeSystem'
import { gemSystem } from '../systems/GemSystem'
import { Enemy } from '../ecs/components'
import { SkillTreeStore } from '../skilltree/SkillTreeStore'
import { SkillTreeUI } from '../skilltree/SkillTreeUI'
import { StreamerMode } from '../streamer/StreamerMode'
import { StreamerUI } from '../streamer/StreamerUI'
import { InputManager } from '../input/InputManager'
import { LevelUpUI, ITEMS } from '../ui/LevelUpUI'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  NEXUS_RADIUS, NEXUS_X, NEXUS_Y,
  NEXUS_MAX_HP, WEAPON_FIRE_RATE, WEAPON_RANGE,
  PROJECTILE_SPEED, PROJECTILE_DAMAGE, TextureId,
  BASE_FIRE_RATE, BASE_PROJECTILE_DAMAGE, BASE_PROJECTILE_SPEED,
  BASE_WEAPON_RANGE, BASE_NEXUS_MAX_HP,
  BOSS_RADIUS, ENEMY_RADIUS,
} from '../constants'
import type { ComputedStats } from '../skilltree/types'

const enemyQuery = defineQuery([Enemy])

// Grid tile size for the infinite background
const GRID_TILE = 64
// How many tiles to draw beyond the viewport in each direction
const GRID_HALF_TILES_X = Math.ceil(CANVAS_WIDTH  / GRID_TILE) + 2
const GRID_HALF_TILES_Y = Math.ceil(CANVAS_HEIGHT / GRID_TILE) + 2

// ---------------------------------------------------------------------------
// Stat applicator — maps ComputedStats → Nexus ECS components
// ---------------------------------------------------------------------------
function applyStatsToNexus(world: GameWorld, stats: ComputedStats): void {
  const neid = world.nexusEid
  if (neid < 0) return

  Weapon.fireRate[neid] =
    BASE_FIRE_RATE * (1 + stats.fireRateBonus) * stats.fireRateMultiplier

  Weapon.damage[neid] =
    BASE_PROJECTILE_DAMAGE * (1 + stats.damageBonus) * stats.damageMultiplier

  Weapon.range[neid]           = BASE_WEAPON_RANGE     * (1 + stats.rangeBonus)
  Weapon.projectileSpeed[neid] = BASE_PROJECTILE_SPEED * (1 + stats.speedBonus)

  const maxHP = BASE_NEXUS_MAX_HP * (1 + stats.maxHPBonus) * stats.maxHPMultiplier
  const ratio = Health.current[neid] / Health.max[neid]
  Health.max[neid]     = maxHP
  Health.current[neid] = Math.min(Health.current[neid], maxHP * ratio + 0.001)
}

export class Game {
  private app!: Application
  private world!: GameWorld
  private renderSystem!: RenderSystem
  private gameContainer!: Container
  private bgGraphics!: Graphics     // tiling world-space background grid
  private textures: Texture[] = []

  // Input
  private input!: InputManager

  // UI refs
  private hpBarFill!: Graphics
  private xpBarFill!: Graphics
  private xpBarBg!: Graphics
  private waveText!: Text
  private scoreText!: Text
  private levelText!: Text
  private spBadge!: Text
  private contextBadge!: Text | null
  private gameOverContainer!: Container
  private waveResultText!: Text
  private inventoryPanel!: Container  // left-side collected items list
  private inventoryOpen = false       // toggled by Shift key

  private treeUI!: SkillTreeUI
  private levelUpUI!: LevelUpUI
  private streamerMode!: StreamerMode
  private streamerUI!: StreamerUI
  private nexusPulseTimer = 0
  private treePrevOpen = false

  async init(): Promise<void> {
    this.app = new Application({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: 0x05050f,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    document.body.appendChild(this.app.view as HTMLCanvasElement)

    this.input    = new InputManager()
    this.textures = this.generateTextures()
    this.buildScene()
    this.buildTreeButton()
    this.treeUI    = new SkillTreeUI(this.app, new Container())
    this.levelUpUI = new LevelUpUI(this.app)

    this.streamerMode = new StreamerMode()
    this.streamerUI   = new StreamerUI(this.app, this.streamerMode)
    this.streamerUI.onCommand((evt) => {
      if (!this.world || this.world.gameOver) return
      switch (evt.command) {
        case 'spawn': this.world.buffs.spawnWaveRequest = true; break
        case 'buff':
          this.world.buffs.fireRateMult  = 2
          this.world.buffs.fireRateTimer = 10
          break
        case 'boss':  this.world.buffs.spawnBossRequest = true; break
        case 'heal':  this.world.buffs.healRequest = true; break
      }
    })

    SkillTreeStore.onChange(() => {
      this.spBadge.text = `SP: ${SkillTreeStore.skillPoints}`
    })

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') { e.preventDefault(); this.toggleTree() }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        e.preventDefault()
        this.inventoryOpen = !this.inventoryOpen
        this.rebuildInventory()
      }
    })

    this.startSession()
    this.app.ticker.add(this.update, this)
  }

  // ---------------------------------------------------------------------------
  // Texture generation
  // ---------------------------------------------------------------------------

  private generateTextures(): Texture[] {
    const r = this.app.renderer

    const ng = new Graphics()
    ng.beginFill(0x1a4aff, 0.15); ng.drawCircle(0, 0, NEXUS_RADIUS + 14); ng.endFill()
    ng.beginFill(0x3377ff, 0.35); ng.drawCircle(0, 0, NEXUS_RADIUS + 6);  ng.endFill()
    ng.beginFill(0x66aaff);       ng.drawCircle(0, 0, NEXUS_RADIUS);       ng.endFill()
    ng.lineStyle(2, 0xffffff, 0.6); ng.drawCircle(0, 0, NEXUS_RADIUS - 6)
    const nexusTex = r.generateTexture(ng); ng.destroy()

    const eg = new Graphics()
    eg.beginFill(0xff2222); eg.drawCircle(0, 0, 14); eg.endFill()
    eg.lineStyle(2, 0xff9999, 0.9); eg.drawCircle(0, 0, 10)
    const enemyTex = r.generateTexture(eg); eg.destroy()

    const pg = new Graphics()
    pg.beginFill(0xffee44); pg.drawCircle(0, 0, 4); pg.endFill()
    pg.beginFill(0xffffff); pg.drawCircle(0, 0, 2); pg.endFill()
    const projTex = r.generateTexture(pg); pg.destroy()

    const bg2 = new Graphics()
    bg2.beginFill(0xcc0066, 0.22); bg2.drawCircle(0, 0, BOSS_RADIUS + 12); bg2.endFill()
    bg2.beginFill(0xaa0044);       bg2.drawCircle(0, 0, BOSS_RADIUS);       bg2.endFill()
    bg2.lineStyle(3, 0xff44ff, 1); bg2.drawCircle(0, 0, BOSS_RADIUS - 8)
    bg2.beginFill(0xff88ff, 0.75); bg2.drawCircle(0, 0, 8);                 bg2.endFill()
    const bossTex = r.generateTexture(bg2); bg2.destroy()

    const R = ENEMY_RADIUS
    const fg = new Graphics()
    fg.beginFill(0xffffff)
    fg.drawPolygon([0, -(R + 2), R - 2, 0, 0, R + 2, -(R - 2), 0])
    fg.endFill()
    fg.lineStyle(1.5, 0xdddddd, 0.7)
    fg.drawPolygon([0, -(R - 5), R - 7, 0, 0, R - 5, -(R - 7), 0])
    const fastTex = r.generateTexture(fg); fg.destroy()

    const brG = new Graphics()
    brG.beginFill(0xffffff, 0.25); brG.drawCircle(0, 0, R + 4); brG.endFill()
    brG.beginFill(0xffffff);       brG.drawCircle(0, 0, R);      brG.endFill()
    brG.lineStyle(3, 0xdddddd, 0.85); brG.drawCircle(0, 0, R - 5)
    const bruteTex = r.generateTexture(brG); brG.destroy()

    const swG = new Graphics()
    swG.beginFill(0xffffff); swG.drawCircle(0, 0, 7); swG.endFill()
    const swarmTex = r.generateTexture(swG); swG.destroy()

    const shG = new Graphics()
    shG.beginFill(0xffffff, 0.12); shG.drawCircle(0, 0, R + 2); shG.endFill()
    shG.lineStyle(2.5, 0xffffff, 0.95); shG.drawCircle(0, 0, R)
    shG.lineStyle(1,   0xffffff, 0.35); shG.drawCircle(0, 0, R - 6)
    const shadowTex = r.generateTexture(shG); shG.destroy()

    const bmG = new Graphics()
    bmG.beginFill(0xffffff, 0.3); bmG.drawCircle(0, 0, 14); bmG.endFill()
    bmG.beginFill(0xffffff);      bmG.drawCircle(0, 0,  8); bmG.endFill()
    bmG.lineStyle(1.5, 0xffffff, 0.9); bmG.drawCircle(0, 0, 12)
    const bombTex = r.generateTexture(bmG); bmG.destroy()

    const bhG = new Graphics()
    bhG.beginFill(0x110022, 0.85); bhG.drawCircle(0, 0, 22); bhG.endFill()
    bhG.lineStyle(2, 0xffffff, 0.7); bhG.drawCircle(0, 0, 20)
    bhG.lineStyle(1, 0xffffff, 0.25); bhG.drawCircle(0, 0, 13)
    const blackholeTex = r.generateTexture(bhG); bhG.destroy()

    // Gem (TextureId.Gem = 10) — small cyan-green diamond
    const gmG = new Graphics()
    gmG.beginFill(0x00ffaa, 0.9)
    gmG.drawPolygon([0, -7, 5, 0, 0, 7, -5, 0])
    gmG.endFill()
    gmG.lineStyle(1, 0xffffff, 0.7)
    gmG.drawPolygon([0, -5, 3, 0, 0, 5, -3, 0])
    const gemTex = r.generateTexture(gmG); gmG.destroy()

    return [nexusTex, enemyTex, projTex, bossTex, fastTex, bruteTex, swarmTex, shadowTex,
            bombTex, blackholeTex, gemTex]
  }

  // ---------------------------------------------------------------------------
  // Scene / UI construction
  // ---------------------------------------------------------------------------

  private buildScene(): void {
    // World-space game container (scrolls with camera)
    this.gameContainer = new Container()
    this.app.stage.addChild(this.gameContainer)

    // Tiling background grid inside the game container (world-space)
    this.bgGraphics = new Graphics()
    this.gameContainer.addChildAt(this.bgGraphics, 0)

    this.buildHUD()
  }

  /** Redraws the tiling grid centred on the Nexus position */
  private updateBackground(nx: number, ny: number): void {
    const g = this.bgGraphics
    g.clear()

    // Snap origin to nearest tile multiple so the grid appears infinite
    const originX = Math.floor(nx / GRID_TILE) * GRID_TILE
    const originY = Math.floor(ny / GRID_TILE) * GRID_TILE

    const startX = originX - GRID_HALF_TILES_X * GRID_TILE
    const startY = originY - GRID_HALF_TILES_Y * GRID_TILE
    const endX   = originX + GRID_HALF_TILES_X * GRID_TILE
    const endY   = originY + GRID_HALF_TILES_Y * GRID_TILE

    g.beginFill(0x05050f)
    g.drawRect(startX, startY, endX - startX, endY - startY)
    g.endFill()

    g.lineStyle(1, 0x101040, 0.5)
    for (let x = startX; x <= endX; x += GRID_TILE) {
      g.moveTo(x, startY); g.lineTo(x, endY)
    }
    for (let y = startY; y <= endY; y += GRID_TILE) {
      g.moveTo(startX, y); g.lineTo(endX, y)
    }
  }

  private buildHUD(): void {
    const ui = new Container()
    this.app.stage.addChild(ui)

    // ── HP bar (top centre) ──────────────────────────────────────────────
    const hpBg = new Graphics()
    hpBg.beginFill(0x222222)
    hpBg.drawRoundedRect(CANVAS_WIDTH / 2 - 110, 14, 220, 14, 7)
    hpBg.endFill()
    ui.addChild(hpBg)

    this.hpBarFill = new Graphics()
    ui.addChild(this.hpBarFill)

    // ── XP bar (directly below HP bar) ──────────────────────────────────
    this.xpBarBg = new Graphics()
    this.xpBarBg.beginFill(0x111133)
    this.xpBarBg.drawRoundedRect(CANVAS_WIDTH / 2 - 110, 32, 220, 8, 4)
    this.xpBarBg.endFill()
    ui.addChild(this.xpBarBg)

    this.xpBarFill = new Graphics()
    ui.addChild(this.xpBarFill)

    // ── Wave text (top left) ─────────────────────────────────────────────
    this.waveText = new Text('Prepare…', new TextStyle({
      fill: '#88bbff', fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    this.waveText.x = 20; this.waveText.y = 14
    ui.addChild(this.waveText)

    // ── Score text (top right) ───────────────────────────────────────────
    this.scoreText = new Text('Score: 0', new TextStyle({
      fill: '#ffee44', fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    this.scoreText.x = CANVAS_WIDTH - 200; this.scoreText.y = 14
    ui.addChild(this.scoreText)

    // ── Level badge (below XP bar, centred) ─────────────────────────────
    this.levelText = new Text('Lv.1', new TextStyle({
      fill: '#00ffaa', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    this.levelText.anchor.set(0.5, 0)
    this.levelText.x = CANVAS_WIDTH / 2; this.levelText.y = 43
    ui.addChild(this.levelText)

    // ── Inventory panel (left side, below wave text) ─────────────────────
    this.inventoryPanel = new Container()
    this.inventoryPanel.x = 10
    this.inventoryPanel.y = 44
    this.app.stage.addChild(this.inventoryPanel)

    // Context event badge
    this.contextBadge = null

    // ── Game-over overlay ────────────────────────────────────────────────
    this.gameOverContainer = new Container()
    this.gameOverContainer.visible = false
    this.app.stage.addChild(this.gameOverContainer)

    const overlay = new Graphics()
    overlay.beginFill(0x000000, 0.78); overlay.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); overlay.endFill()
    this.gameOverContainer.addChild(overlay)

    const title = new Text('NEXUS DESTROYED', new TextStyle({
      fill: '#ff3333', fontSize: 60, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    title.anchor.set(0.5); title.x = CANVAS_WIDTH / 2; title.y = CANVAS_HEIGHT / 2 - 70
    this.gameOverContainer.addChild(title)

    this.waveResultText = new Text('', new TextStyle({
      fill: '#ffffff', fontSize: 28, fontFamily: 'monospace',
    }))
    this.waveResultText.anchor.set(0.5)
    this.waveResultText.x = CANVAS_WIDTH / 2; this.waveResultText.y = CANVAS_HEIGHT / 2
    this.gameOverContainer.addChild(this.waveResultText)

    const clickHint = new Text('Click anywhere to restart', new TextStyle({
      fill: '#888888', fontSize: 22, fontFamily: 'monospace',
    }))
    clickHint.anchor.set(0.5); clickHint.x = CANVAS_WIDTH / 2; clickHint.y = CANVAS_HEIGHT / 2 + 60
    this.gameOverContainer.addChild(clickHint)

    const treeHint = new Text('[Tab]  Open Skill Tree to spend points', new TextStyle({
      fill: '#8899cc', fontSize: 18, fontFamily: 'monospace',
    }))
    treeHint.anchor.set(0.5); treeHint.x = CANVAS_WIDTH / 2; treeHint.y = CANVAS_HEIGHT / 2 + 100
    this.gameOverContainer.addChild(treeHint)

    ;(this.app.view as HTMLCanvasElement).addEventListener('click', () => {
      if (this.world?.gameOver && !this.treeUI?.isOpen) this.restart()
    })
  }

  // ---------------------------------------------------------------------------
  // Inventory panel — left-side list of acquired peripherals & catalysts
  // ---------------------------------------------------------------------------

  private rebuildInventory(): void {
    this.inventoryPanel.removeChildren()

    const all    = [...(this.world?.peripherals ?? []), ...(this.world?.catalysts ?? [])]
    const meta   = new Map(ITEMS.map(it => [it.id, it]))
    const counts = new Map<string, number>()
    for (const id of all) counts.set(id, (counts.get(id) ?? 0) + 1)

    const PAD    = 6
    const panelW = 178
    const HEADER_H = 22

    // ── Header tab — always visible ──────────────────────────────────────
    const arrow     = this.inventoryOpen ? '▼' : '▶'
    const itemCount = all.length
    const headerBg  = new Graphics()
    headerBg.beginFill(0x060c1a, 0.85)
    headerBg.lineStyle(1, 0x2244aa, 0.9)
    headerBg.drawRoundedRect(0, 0, panelW, HEADER_H, 5)
    headerBg.endFill()
    headerBg.interactive = true
    headerBg.cursor = 'pointer'
    headerBg.on('pointertap', () => {
      this.inventoryOpen = !this.inventoryOpen
      this.rebuildInventory()
    })
    this.inventoryPanel.addChild(headerBg)

    const headerLabel = itemCount > 0
      ? `${arrow} ITEMS  (${itemCount})  [Shift]`
      : `${arrow} ITEMS  [Shift]`
    const headerTxt = new Text(headerLabel, new TextStyle({
      fill: '#7799cc', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    headerTxt.x = PAD; headerTxt.y = (HEADER_H - 12) / 2
    this.inventoryPanel.addChild(headerTxt)

    if (!this.inventoryOpen || counts.size === 0) {
      // Collapsed or no items — optionally show empty hint
      if (this.inventoryOpen && counts.size === 0) {
        const emptyBg = new Graphics()
        emptyBg.beginFill(0x060c1a, 0.75)
        emptyBg.lineStyle(1, 0x223355, 0.6)
        emptyBg.drawRoundedRect(0, HEADER_H + 2, panelW, 24, 5)
        emptyBg.endFill()
        this.inventoryPanel.addChild(emptyBg)

        const emptyTxt = new Text('  No items yet', new TextStyle({
          fill: '#445566', fontSize: 11, fontFamily: 'monospace',
        }))
        emptyTxt.x = PAD; emptyTxt.y = HEADER_H + 2 + 5
        this.inventoryPanel.addChild(emptyTxt)
      }
      return
    }

    // ── Expanded item list ────────────────────────────────────────────────
    const ROW_H  = 22
    const DOT    = 8
    const listH  = counts.size * ROW_H + PAD * 2

    const listBg = new Graphics()
    listBg.beginFill(0x060c1a, 0.80)
    listBg.lineStyle(1, 0x223355, 0.7)
    listBg.drawRoundedRect(0, HEADER_H + 2, panelW, listH, 5)
    listBg.endFill()
    this.inventoryPanel.addChild(listBg)

    let row = 0
    for (const [id, count] of counts) {
      const item  = meta.get(id)
      const color = item?.color    ?? 0xaaaaaa
      const name  = item?.name     ?? id
      const cat   = item?.category ?? 'catalyst'

      const y = HEADER_H + 2 + PAD + row * ROW_H

      // Dot: diamond = peripheral, circle = catalyst
      const dot = new Graphics()
      dot.beginFill(color, 0.9)
      if (cat === 'peripheral') {
        dot.drawPolygon([DOT / 2, 0, DOT, DOT / 2, DOT / 2, DOT, 0, DOT / 2])
      } else {
        dot.drawCircle(DOT / 2, DOT / 2, DOT / 2)
      }
      dot.endFill()
      dot.x = PAD
      dot.y = y + (ROW_H - DOT) / 2
      this.inventoryPanel.addChild(dot)

      const label = count > 1 ? `${name}  ×${count}` : name
      const txt   = new Text(label, new TextStyle({
        fill: '#bbccdd', fontSize: 11, fontFamily: 'monospace',
      }))
      txt.x = PAD + DOT + 5
      txt.y = y + (ROW_H - 12) / 2
      this.inventoryPanel.addChild(txt)

      row++
    }
  }

  private buildTreeButton(): void {
    const ui = new Container()
    ui.x = CANVAS_WIDTH - 220
    ui.y = CANVAS_HEIGHT - 46
    this.app.stage.addChild(ui)

    const btnBg = new Graphics()
    btnBg.beginFill(0x111133, 0.9)
    btnBg.lineStyle(1, 0x3355aa)
    btnBg.drawRoundedRect(0, 0, 210, 34, 6)
    btnBg.endFill()
    btnBg.interactive = true
    btnBg.cursor = 'pointer'
    btnBg.on('pointertap', () => this.toggleTree())
    ui.addChild(btnBg)

    const btnLabel = new Text('SKILL TREE  [Tab]', new TextStyle({
      fill: '#aaccff', fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    btnLabel.x = 10; btnLabel.y = 8
    ui.addChild(btnLabel)

    this.spBadge = new Text(`SP: ${SkillTreeStore.skillPoints}`, new TextStyle({
      fill: '#ffee44', fontSize: 15, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    this.spBadge.x = 148; this.spBadge.y = 8
    ui.addChild(this.spBadge)
  }

  // ---------------------------------------------------------------------------
  // Context badge
  // ---------------------------------------------------------------------------

  private refreshContextBadge(label: string, color: string): void {
    if (this.contextBadge) {
      this.contextBadge.parent?.removeChild(this.contextBadge)
      this.contextBadge.destroy()
      this.contextBadge = null
    }
    if (!label) return

    const badge = new Text(label, new TextStyle({
      fill: color, fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold',
      dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2,
    }))
    badge.anchor.set(0.5, 0)
    badge.x = CANVAS_WIDTH / 2
    badge.y = 58
    this.app.stage.addChild(badge)
    this.contextBadge = badge
  }

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  private startSession(): void {
    this.world = createGameWorld()
    this.renderSystem = new RenderSystem(this.textures, this.gameContainer)
    this.nexusPulseTimer = 0

    this.refreshContextBadge(this.world.context.eventLabel, this.world.context.eventColor)

    this.createNexus()

    const stats = SkillTreeStore.computedStats
    this.world.stats = stats
    applyStatsToNexus(this.world, stats)

    setSpawnerCallbacks(
      (wave)  => { this.waveText.text = `Wave ${wave}` },
      (wave)  => { this.onWaveComplete(wave) },
    )
    resetSpawner()

    this.waveText.text   = 'Prepare…'
    this.scoreText.text  = 'Score: 0'
    this.levelText.text  = 'Lv.1'
    this.gameOverContainer.visible = false
    this.rebuildInventory()
  }

  private createNexus(): void {
    const eid = addEntity(this.world)
    this.world.nexusEid = eid

    addComponent(this.world, Position, eid)
    Position.x[eid] = NEXUS_X
    Position.y[eid] = NEXUS_Y

    // Nexus now has Velocity so MovementSystem can drive it
    addComponent(this.world, Velocity, eid)
    Velocity.x[eid] = 0
    Velocity.y[eid] = 0

    addComponent(this.world, Health, eid)
    Health.current[eid] = NEXUS_MAX_HP
    Health.max[eid]     = NEXUS_MAX_HP

    addComponent(this.world, Collider, eid)
    Collider.radius[eid] = NEXUS_RADIUS

    addComponent(this.world, IsNexus, eid)

    addComponent(this.world, Weapon, eid)
    Weapon.damage[eid]           = PROJECTILE_DAMAGE
    Weapon.fireRate[eid]         = WEAPON_FIRE_RATE
    Weapon.lastFire[eid]         = 0
    Weapon.range[eid]            = WEAPON_RANGE
    Weapon.projectileSpeed[eid]  = PROJECTILE_SPEED

    addComponent(this.world, Renderable, eid)
    Renderable.textureId[eid] = TextureId.Nexus
    Renderable.tint[eid]      = 0xffffff
    Renderable.scale[eid]     = 1.0
  }

  private onWaveComplete(wave: number): void {
    const weekendBonus = this.world?.context.isWeekend ? 1 : 0
    const bonus = 2 + Math.floor(SkillTreeStore.computedStats.bonusSPPerWave) + weekendBonus
    SkillTreeStore.addSkillPoints(bonus)
    const weekendTag = weekendBonus ? ' +WKD' : ''
    this.waveText.text = `Wave ${wave} — Clear!  (+${bonus} SP${weekendTag})`

    const neid = this.world.nexusEid
    if (neid >= 0) {
      const heal = Health.max[neid] * 0.25
      Health.current[neid] = Math.min(Health.max[neid], Health.current[neid] + heal)
    }
  }

  private toggleTree(): void {
    this.treeUI?.toggle()
  }

  private restart(): void {
    this.renderSystem.destroy()
    SkillTreeStore.reset()
    this.startSession()
  }

  // ---------------------------------------------------------------------------
  // Main game loop
  // ---------------------------------------------------------------------------

  private update(_delta: number): void {
    const dt = this.app.ticker.deltaMS / 1000

    const treeNowOpen = this.treeUI?.isOpen ?? false
    const justClosed  = this.treePrevOpen && !treeNowOpen
    this.world.paused  = treeNowOpen || this.world.levelUpPause
    this.treePrevOpen  = treeNowOpen

    if (justClosed) {
      const stats = SkillTreeStore.computedStats
      this.world.stats = stats
      applyStatsToNexus(this.world, stats)
    }

    this.treeUI?.animate(dt)
    this.streamerUI?.animate(dt)

    if (this.world.gameOver) {
      this.waveResultText.text =
        `Reached Wave ${this.world.wave}   •   Score: ${this.world.score}`
      this.gameOverContainer.visible = true
      return
    }

    // Level-up card screen: game paused, show overlay if not already visible
    if (this.world.pendingLevelUp && !this.world.levelUpPause) {
      this.world.pendingLevelUp = false
      this.world.levelUpPause   = true
      this.world.paused         = true
      this.levelUpUI.show(this.world, () => {
        this.world.levelUpPause = false
        this.world.paused       = this.treeUI?.isOpen ?? false
        this.levelText.text = `Lv.${this.world.level}`
        this.rebuildInventory()
      })
    }

    if (this.world.paused) return

    this.world.delta   = dt
    this.world.elapsed += dt

    // ── Buff timer tick ────────────────────────────────────────────────
    const buffs = this.world.buffs
    if (buffs.fireRateTimer > 0) {
      buffs.fireRateTimer = Math.max(0, buffs.fireRateTimer - dt)
      if (buffs.fireRateTimer === 0) buffs.fireRateMult = 1
    }
    if (buffs.enemySpeedTimer > 0) {
      buffs.enemySpeedTimer = Math.max(0, buffs.enemySpeedTimer - dt)
      if (buffs.enemySpeedTimer === 0) buffs.enemySpeedMult = 1
    }

    if (buffs.healRequest) {
      buffs.healRequest = false
      const neid = this.world.nexusEid
      if (neid >= 0) {
        Health.current[neid] = Math.min(
          Health.max[neid],
          Health.current[neid] + Health.max[neid] * 0.30,
        )
      }
    }

    // ── ECS Systems ────────────────────────────────────────────────────
    enemyAISystem(this.world)
    weaponSystem(this.world)
    movementSystem(this.world, this.input)
    auraSystem(this.world)
    collisionSystem(this.world)
    bombSystem(this.world)
    blackholeSystem(this.world)
    lifetimeSystem(this.world)
    gemSystem(this.world)

    const aliveEnemies = enemyQuery(this.world).length
    spawnerSystem(this.world, aliveEnemies)

    // ── Camera follow ──────────────────────────────────────────────────
    const neid = this.world.nexusEid
    const nx   = Position.x[neid]
    const ny   = Position.y[neid]
    this.gameContainer.x = CANVAS_WIDTH  / 2 - nx
    this.gameContainer.y = CANVAS_HEIGHT / 2 - ny
    this.updateBackground(nx, ny)

    this.renderSystem.update(this.world)

    // Nexus pulse animation
    this.nexusPulseTimer += dt
    Renderable.scale[neid] = 1 + Math.sin(this.nexusPulseTimer * 3.0) * 0.05

    // Passive HP regen: 3 HP/s
    Health.current[neid] = Math.min(Health.max[neid], Health.current[neid] + 3 * dt)

    // ── HUD refresh ────────────────────────────────────────────────────
    this.refreshHpBar()
    this.refreshXpBar()
    this.scoreText.text = `Score: ${this.world.score}`
  }

  private refreshHpBar(): void {
    const neid  = this.world.nexusEid
    const ratio = Math.max(0, Health.current[neid] / Health.max[neid])
    const barW  = 220
    const barX  = CANVAS_WIDTH / 2 - 110
    const barY  = 14
    const color = ratio > 0.5 ? 0x44ff88 : ratio > 0.25 ? 0xffaa22 : 0xff3333

    this.hpBarFill.clear()
    this.hpBarFill.beginFill(color)
    this.hpBarFill.drawRoundedRect(barX, barY, barW * ratio, 14, 7)
    this.hpBarFill.endFill()
  }

  private refreshXpBar(): void {
    const ratio = this.world.xpToNextLevel > 0
      ? Math.min(1, this.world.xp / this.world.xpToNextLevel)
      : 0
    const barW = 220
    const barX = CANVAS_WIDTH / 2 - 110
    const barY = 32

    this.xpBarFill.clear()
    if (ratio > 0) {
      this.xpBarFill.beginFill(0x0055ff)
      this.xpBarFill.drawRoundedRect(barX, barY, barW * ratio, 8, 4)
      this.xpBarFill.endFill()
    }
  }
}

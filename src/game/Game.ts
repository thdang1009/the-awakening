import {
  Application, Graphics, Container, Text, TextStyle, Texture,
} from 'pixi.js'
import { addComponent, addEntity, defineQuery } from 'bitecs'
import {
  Position, Health, Collider, IsNexus, Weapon, Renderable,
} from '../ecs/components'
import { GameWorld, createGameWorld } from '../ecs/world'
import { RenderSystem } from '../systems/RenderSystem'
import { movementSystem } from '../systems/MovementSystem'
import { enemyAISystem } from '../systems/EnemyAISystem'
import { weaponSystem } from '../systems/WeaponSystem'
import { collisionSystem } from '../systems/CollisionSystem'
import { lifetimeSystem } from '../systems/LifetimeSystem'
import { spawnerSystem, resetSpawner, setSpawnerCallbacks } from '../systems/SpawnerSystem'
import { Enemy } from '../ecs/components'
import { SkillTreeStore } from '../skilltree/SkillTreeStore'
import { SkillTreeUI } from '../skilltree/SkillTreeUI'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  NEXUS_RADIUS, NEXUS_X, NEXUS_Y,
  NEXUS_MAX_HP, WEAPON_FIRE_RATE, WEAPON_RANGE,
  PROJECTILE_SPEED, PROJECTILE_DAMAGE, TextureId,
  BASE_FIRE_RATE, BASE_PROJECTILE_DAMAGE, BASE_PROJECTILE_SPEED,
  BASE_WEAPON_RANGE, BASE_NEXUS_MAX_HP,
} from '../constants'
import type { ComputedStats } from '../skilltree/types'

const enemyQuery = defineQuery([Enemy])

// ---------------------------------------------------------------------------
// Stat applicator — maps ComputedStats → Nexus ECS components
// ---------------------------------------------------------------------------
function applyStatsToNexus(world: GameWorld, stats: ComputedStats): void {
  const neid = world.nexusEid
  if (neid < 0) return

  // Fire rate
  let fr = BASE_FIRE_RATE * (1 + stats.fireRateBonus)
  if (stats.machineGunProtocol) fr *= 2.8
  if (stats.singularityCannon)  fr *= 0.6
  Weapon.fireRate[neid] = fr

  // Damage
  let dmg = BASE_PROJECTILE_DAMAGE * (1 + stats.damageBonus)
  if (stats.singularityCannon)   dmg *= 2.0
  if (stats.machineGunProtocol)  dmg *= 0.7
  Weapon.damage[neid] = dmg

  // Range & speed
  Weapon.range[neid]           = BASE_WEAPON_RANGE    * (1 + stats.rangeBonus)
  Weapon.projectileSpeed[neid] = BASE_PROJECTILE_SPEED * (1 + stats.speedBonus)

  // Max HP (preserve current HP ratio to avoid instant kills)
  let maxHP = BASE_NEXUS_MAX_HP * (1 + stats.maxHPBonus)
  if (stats.indestructibleCore) maxHP *= 2.0
  const ratio = Health.current[neid] / Health.max[neid]
  Health.max[neid]     = maxHP
  Health.current[neid] = Math.min(Health.current[neid], maxHP * ratio + 0.001)
}

export class Game {
  private app!: Application
  private world!: GameWorld
  private renderSystem!: RenderSystem
  private gameContainer!: Container
  private textures: Texture[] = []

  // UI refs
  private hpBarFill!: Graphics
  private waveText!: Text
  private scoreText!: Text
  private spBadge!: Text          // skill-point badge on tree button
  private gameOverContainer!: Container
  private waveResultText!: Text

  private treeUI!: SkillTreeUI
  private nexusPulseTimer = 0
  private treePrevOpen = false  // track tree open state to detect close event

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

    this.textures = this.generateTextures()
    this.buildScene()        // bg, gameContainer, UI layers
    this.buildTreeButton()   // must be before SkillTreeUI (passes container ref)
    this.treeUI = new SkillTreeUI(this.app, new Container())

    // Refresh SP badge whenever store changes
    SkillTreeStore.onChange(() => {
      this.spBadge.text = `SP: ${SkillTreeStore.skillPoints}`
    })

    // Tab key toggles the tree
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') { e.preventDefault(); this.toggleTree() }
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

    return [nexusTex, enemyTex, projTex]
  }

  // ---------------------------------------------------------------------------
  // Scene / UI construction
  // ---------------------------------------------------------------------------

  private buildScene(): void {
    const bg = new Graphics()
    bg.beginFill(0x05050f); bg.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); bg.endFill()
    bg.lineStyle(1, 0x101040, 0.5)
    for (let x = 0; x <= CANVAS_WIDTH; x += 64) { bg.moveTo(x, 0); bg.lineTo(x, CANVAS_HEIGHT) }
    for (let y = 0; y <= CANVAS_HEIGHT; y += 64) { bg.moveTo(0, y); bg.lineTo(CANVAS_WIDTH, y) }
    this.app.stage.addChild(bg)

    this.gameContainer = new Container()
    this.app.stage.addChild(this.gameContainer)

    this.buildHUD()
  }

  private buildHUD(): void {
    const ui = new Container()
    this.app.stage.addChild(ui)

    // HP bar background
    const hpBg = new Graphics()
    hpBg.beginFill(0x222222)
    hpBg.drawRoundedRect(CANVAS_WIDTH / 2 - 110, 16, 220, 16, 8)
    hpBg.endFill()
    ui.addChild(hpBg)

    this.hpBarFill = new Graphics()
    ui.addChild(this.hpBarFill)

    this.waveText = new Text('Prepare…', new TextStyle({
      fill: '#88bbff', fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    this.waveText.x = 20; this.waveText.y = 16
    ui.addChild(this.waveText)

    this.scoreText = new Text('Score: 0', new TextStyle({
      fill: '#ffee44', fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
    }))
    this.scoreText.x = CANVAS_WIDTH - 200; this.scoreText.y = 16
    ui.addChild(this.scoreText)

    // Game-over overlay
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

    // Restart on click (only if tree is NOT open)
    ;(this.app.view as HTMLCanvasElement).addEventListener('click', () => {
      if (this.world?.gameOver && !this.treeUI?.isOpen) this.restart()
    })
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
  // Session lifecycle
  // ---------------------------------------------------------------------------

  private startSession(): void {
    this.world = createGameWorld()
    this.renderSystem = new RenderSystem(this.textures, this.gameContainer)
    this.nexusPulseTimer = 0

    this.createNexus()

    // Apply any existing skill-tree stats (tree persists across restarts)
    const stats = SkillTreeStore.computedStats
    this.world.stats = stats
    applyStatsToNexus(this.world, stats)

    setSpawnerCallbacks(
      (wave)  => { this.waveText.text = `Wave ${wave}` },
      (wave)  => { this.onWaveComplete(wave) },
    )
    resetSpawner()

    this.waveText.text = 'Prepare…'
    this.scoreText.text = 'Score: 0'
    this.gameOverContainer.visible = false
  }

  private createNexus(): void {
    const eid = addEntity(this.world)
    this.world.nexusEid = eid

    addComponent(this.world, Position, eid)
    Position.x[eid] = NEXUS_X
    Position.y[eid] = NEXUS_Y

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
    const bonus = 1 + Math.floor(SkillTreeStore.computedStats.bonusSPPerWave)
    SkillTreeStore.addSkillPoints(bonus)
    this.waveText.text = `Wave ${wave} — Clear!  (+${bonus} SP)`

    // Restore 25% of max HP on each wave clear
    const neid = this.world.nexusEid
    if (neid >= 0) {
      const heal = Health.max[neid] * 0.25
      Health.current[neid] = Math.min(Health.max[neid], Health.current[neid] + heal)
    }
  }

  private toggleTree(): void {
    this.treeUI?.toggle()
    // world.paused is synced from treeUI.isOpen every frame in update()
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

    // Sync world.paused from treeUI every frame — this is the single source of
    // truth and handles ALL close paths (Tab key, [X] button, etc.)
    const treeNowOpen = this.treeUI?.isOpen ?? false
    const justClosed  = this.treePrevOpen && !treeNowOpen
    this.world.paused  = treeNowOpen
    this.treePrevOpen  = treeNowOpen

    // Re-apply skill tree stats the frame the tree closes
    if (justClosed) {
      const stats = SkillTreeStore.computedStats
      this.world.stats = stats
      applyStatsToNexus(this.world, stats)
    }

    // Tree animation runs always (even paused)
    this.treeUI?.animate(dt)

    if (this.world.gameOver) {
      this.waveResultText.text =
        `Reached Wave ${this.world.wave}   •   Score: ${this.world.score}`
      this.gameOverContainer.visible = true
      return
    }

    if (this.world.paused) return

    this.world.delta   = dt
    this.world.elapsed += dt

    // Systems — order matters
    enemyAISystem(this.world)
    weaponSystem(this.world)
    movementSystem(this.world)
    collisionSystem(this.world)
    lifetimeSystem(this.world)

    const aliveEnemies = enemyQuery(this.world).length
    spawnerSystem(this.world, aliveEnemies)

    this.renderSystem.update(this.world)

    // Nexus pulse animation
    this.nexusPulseTimer += dt
    Renderable.scale[this.world.nexusEid] = 1 + Math.sin(this.nexusPulseTimer * 3.0) * 0.05

    // Passive HP regen: 3 HP/s
    const neid = this.world.nexusEid
    Health.current[neid] = Math.min(Health.max[neid], Health.current[neid] + 3 * dt)

    // HUD
    this.refreshHpBar()
    this.scoreText.text = `Score: ${this.world.score}`
  }

  private refreshHpBar(): void {
    const neid  = this.world.nexusEid
    const ratio = Math.max(0, Health.current[neid] / Health.max[neid])
    const barW  = 220
    const barX  = CANVAS_WIDTH / 2 - 110
    const barY  = 16
    const color = ratio > 0.5 ? 0x44ff88 : ratio > 0.25 ? 0xffaa22 : 0xff3333

    this.hpBarFill.clear()
    this.hpBarFill.beginFill(color)
    this.hpBarFill.drawRoundedRect(barX, barY, barW * ratio, 16, 8)
    this.hpBarFill.endFill()
  }
}

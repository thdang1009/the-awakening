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
import { StreamerMode } from '../streamer/StreamerMode'
import { StreamerUI } from '../streamer/StreamerUI'
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

// ---------------------------------------------------------------------------
// Stat applicator — maps ComputedStats → Nexus ECS components
// ---------------------------------------------------------------------------
function applyStatsToNexus(world: GameWorld, stats: ComputedStats): void {
  const neid = world.nexusEid
  if (neid < 0) return

  // Fire rate: additive bonus pool × multiplicative product
  Weapon.fireRate[neid] =
    BASE_FIRE_RATE * (1 + stats.fireRateBonus) * stats.fireRateMultiplier

  // Damage: same two-tier formula
  Weapon.damage[neid] =
    BASE_PROJECTILE_DAMAGE * (1 + stats.damageBonus) * stats.damageMultiplier

  // Range & speed (additive only)
  Weapon.range[neid]           = BASE_WEAPON_RANGE     * (1 + stats.rangeBonus)
  Weapon.projectileSpeed[neid] = BASE_PROJECTILE_SPEED * (1 + stats.speedBonus)

  // Max HP — preserve current HP ratio to avoid instant death on tree change
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
  private textures: Texture[] = []

  // UI refs
  private hpBarFill!: Graphics
  private waveText!: Text
  private scoreText!: Text
  private spBadge!: Text          // skill-point badge on tree button
  private contextBadge!: Text | null  // shows active context event (night/weekend/etc)
  private gameOverContainer!: Container
  private waveResultText!: Text

  private treeUI!: SkillTreeUI
  private streamerMode!: StreamerMode
  private streamerUI!: StreamerUI
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

    // Streamer mode
    this.streamerMode = new StreamerMode()
    this.streamerUI   = new StreamerUI(this.app, this.streamerMode)
    this.streamerUI.onCommand((evt) => {
      if (!this.world || this.world.gameOver) return
      switch (evt.command) {
        case 'spawn':
          this.world.buffs.spawnWaveRequest = true
          break
        case 'buff':
          this.world.buffs.fireRateMult  = 2
          this.world.buffs.fireRateTimer = 10
          break
        case 'boss':
          this.world.buffs.spawnBossRequest = true
          break
        case 'heal':
          this.world.buffs.healRequest = true
          break
      }
    })

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

    // Boss — large magenta circle with inner glow ring
    const bg2 = new Graphics()
    bg2.beginFill(0xcc0066, 0.22); bg2.drawCircle(0, 0, BOSS_RADIUS + 12); bg2.endFill()
    bg2.beginFill(0xaa0044);       bg2.drawCircle(0, 0, BOSS_RADIUS);       bg2.endFill()
    bg2.lineStyle(3, 0xff44ff, 1); bg2.drawCircle(0, 0, BOSS_RADIUS - 8)
    bg2.beginFill(0xff88ff, 0.75); bg2.drawCircle(0, 0, 8);                 bg2.endFill()
    const bossTex = r.generateTexture(bg2); bg2.destroy()

    // EnemyFast (4) — diamond/spear shape for Dasher & Berserker
    // White base so archetype tint drives the color
    const R = ENEMY_RADIUS
    const fg = new Graphics()
    fg.beginFill(0xffffff)
    fg.drawPolygon([0, -(R + 2), R - 2, 0, 0, R + 2, -(R - 2), 0])
    fg.endFill()
    fg.lineStyle(1.5, 0xdddddd, 0.7)
    fg.drawPolygon([0, -(R - 5), R - 7, 0, 0, R - 5, -(R - 7), 0])
    const fastTex = r.generateTexture(fg); fg.destroy()

    // EnemyBrute (5) — heavy circle with thick border for Brute, Tank, Elite
    const brG = new Graphics()
    brG.beginFill(0xffffff, 0.25); brG.drawCircle(0, 0, R + 4); brG.endFill()
    brG.beginFill(0xffffff);       brG.drawCircle(0, 0, R);      brG.endFill()
    brG.lineStyle(3, 0xdddddd, 0.85); brG.drawCircle(0, 0, R - 5)
    const bruteTex = r.generateTexture(brG); brG.destroy()

    // EnemySwarm (6) — tiny plain dot for Swarm & Splitter fragments
    const swG = new Graphics()
    swG.beginFill(0xffffff); swG.drawCircle(0, 0, 7); swG.endFill()
    const swarmTex = r.generateTexture(swG); swG.destroy()

    // EnemyShadow (7) — hollow ghost ring for Shadow & Void
    const shG = new Graphics()
    shG.beginFill(0xffffff, 0.12); shG.drawCircle(0, 0, R + 2); shG.endFill()
    shG.lineStyle(2.5, 0xffffff, 0.95); shG.drawCircle(0, 0, R)
    shG.lineStyle(1,   0xffffff, 0.35); shG.drawCircle(0, 0, R - 6)
    const shadowTex = r.generateTexture(shG); shG.destroy()

    return [nexusTex, enemyTex, projTex, bossTex, fastTex, bruteTex, swarmTex, shadowTex]
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

    // Context event badge (shown only when an active event is detected)
    this.contextBadge = null

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
  // Context badge
  // ---------------------------------------------------------------------------

  private refreshContextBadge(label: string, color: string): void {
    // Remove old badge if any
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
    badge.y = 40
    // Add to stage directly so it sits above gameContainer
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

    // Show/hide context badge based on detected event
    this.refreshContextBadge(this.world.context.eventLabel, this.world.context.eventColor)

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
    const weekendBonus = this.world?.context.isWeekend ? 1 : 0
    const bonus = 2 + Math.floor(SkillTreeStore.computedStats.bonusSPPerWave) + weekendBonus
    SkillTreeStore.addSkillPoints(bonus)
    const weekendTag = weekendBonus ? ' +WKD' : ''
    this.waveText.text = `Wave ${wave} — Clear!  (+${bonus} SP${weekendTag})`

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

    // Streamer feed animation runs always
    this.streamerUI?.animate(dt)

    if (this.world.gameOver) {
      this.waveResultText.text =
        `Reached Wave ${this.world.wave}   •   Score: ${this.world.score}`
      this.gameOverContainer.visible = true
      return
    }

    if (this.world.paused) return

    this.world.delta   = dt
    this.world.elapsed += dt

    // ---- Buff timer tick ----
    const buffs = this.world.buffs
    if (buffs.fireRateTimer > 0) {
      buffs.fireRateTimer = Math.max(0, buffs.fireRateTimer - dt)
      if (buffs.fireRateTimer === 0) buffs.fireRateMult = 1
    }
    if (buffs.enemySpeedTimer > 0) {
      buffs.enemySpeedTimer = Math.max(0, buffs.enemySpeedTimer - dt)
      if (buffs.enemySpeedTimer === 0) buffs.enemySpeedMult = 1
    }

    // One-shot heal request
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

import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'

// Simple pixel-art like visual with Phaser 3
// Scenes: Boot -> World -> Battle -> UIScene

// Helper: persistent storage
const STORAGE_KEY = 'pocket-grove-save-v1'
function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

// Data: Monsters
const MONSTERS = [
  { id: 'semakmon', name: 'Semakmon', element: 'Grass', rarity: 'Common', baseHP: 30, baseAttack: 8, baseDefense: 5, speed: 6, captureRate: 0.6, behavior: 'Patrol' },
  { id: 'tengkukrock', name: 'Tengkukrock', element: 'Rock', rarity: 'Uncommon', baseHP: 40, baseAttack: 7, baseDefense: 12, speed: 4, captureRate: 0.45, behavior: 'Patrol' },
  { id: 'flarepup', name: 'Flarepup', element: 'Fire', rarity: 'Rare', baseHP: 28, baseAttack: 12, baseDefense: 4, speed: 8, captureRate: 0.35, behavior: 'Aggressive' },
  { id: 'dewbud', name: 'Dewbud', element: 'Water', rarity: 'Common', baseHP: 32, baseAttack: 7, baseDefense: 6, speed: 7, captureRate: 0.55, behavior: 'Patrol' },
  { id: 'mossling', name: 'Mossling', element: 'Grass', rarity: 'Uncommon', baseHP: 34, baseAttack: 9, baseDefense: 7, speed: 6, captureRate: 0.5, behavior: 'Ambush' },
  { id: 'sparkit', name: 'Sparkit', element: 'Electric', rarity: 'Rare', baseHP: 26, baseAttack: 11, baseDefense: 5, speed: 10, captureRate: 0.3, behavior: 'Aggressive' },
]

// Element effectiveness (very simple)
const EFF = {
  Fire: { Grass: 1.5, Water: 0.5, Rock: 0.75 },
  Water: { Fire: 1.5, Rock: 1.25, Electric: 0.5 },
  Grass: { Water: 1.5, Fire: 0.5, Rock: 1.25 },
  Electric: { Water: 1.5, Rock: 0.75, Grass: 1.0 },
  Rock: { Fire: 1.25, Electric: 1.25 },
}

function getElementMod(att, def) {
  const row = EFF[att] || {}
  return row[def] || 1.0
}

// Shared registry keys
const REG = {
  PLAYER_STATE: 'playerState',
  START_POS: 'startPos',
  ENCOUNTER_REQ: 'encounterReq',
}

// Simple assets using generated rectangles and text since we can't bundle real pixel art here
class BootScene extends Phaser.Scene {
  constructor() { super('Boot') }
  preload() {
    // Generate placeholder sprites with pixel style
    this.createRectTexture('player', 32, 32, 0x66ccff)
    this.createRectTexture('npc', 32, 48, 0xffcc66)
    this.createRectTexture('ring', 16, 16, 0xffff66)

    // Monsters 48x48
    MONSTERS.forEach((m, i) => {
      this.createRectTexture(m.id, 48, 48, 0x88aa88 + (i * 1111))
    })

    // Tiles
    this.createRectTexture('ground', 32, 32, 0x335533)
    this.createRectTexture('bush', 32, 32, 0x447744)
    this.createRectTexture('rock', 32, 32, 0x777777)

    // UI icons
    this.createRectTexture('ball', 12, 12, 0xffffff)
    this.createRectTexture('hp', 2, 2, 0xff4444)

    // Audio placeholders using oscillator is not possible; skip real audio here but manage flags
  }
  createRectTexture(key, w, h, color) {
    const gfx = this.make.graphics({ x: 0, y: 0, add: false })
    gfx.fillStyle(color, 1)
    gfx.fillRect(0, 0, w, h)
    gfx.generateTexture(key, w, h)
    gfx.destroy()
  }
  create() {
    this.scene.start('World')
  }
}

// World Scene
class WorldScene extends Phaser.Scene {
  constructor() { super('World') }
  init() {
    const saved = loadSave()
    this.playerState = saved?.playerState || {
      hp: 50,
      maxHp: 50,
      coins: 10,
      items: { potion: 2, ball: 5 },
      team: saved?.team || [],
      gotRing: saved?.gotRing || false,
    }
    this.startX = saved?.x || 50
    this.startY = saved?.y || 200
  }
  create() {
    const width = 800 * 4 // roughly four screens @ 800
    const height = 450

    // Tile-like ground
    const ground = this.add.tileSprite(0, height - 32, width, 32, 'ground').setOrigin(0, 0)

    // Parallax foliage and rocks
    const deco = this.add.layer()
    for (let x = 0; x < width; x += 64) {
      if (Math.random() < 0.6) deco.add(this.add.image(x, height - 64, 'bush').setOrigin(0, 1).setAlpha(0.9))
      if (Math.random() < 0.2) deco.add(this.add.image(x + 24, height - 48, 'rock').setOrigin(0, 1).setAlpha(0.8))
    }

    // Spawn zones: 4 areas
    this.spawnZones = [200, 900, 1600, 2300].map((x) => new Phaser.Geom.Rectangle(x, height - 120, 160, 88))

    // NPC hint and duelist and ring NPC
    this.npcHint = this.add.image(500, height - 64, 'npc').setOrigin(0.5, 1)
    this.npcDuel = this.add.image(1500, height - 64, 'npc').setOrigin(0.5, 1)
    this.npcRing = this.add.image(width - 80, height - 64, 'npc').setOrigin(0.5, 1)

    // Physics for player
    this.physics.world.setBounds(0, 0, width, height)
    this.player = this.physics.add.sprite(this.startX, this.startY, 'player')
    this.player.setCollideWorldBounds(true)
    this.player.setGravityY(600)

    // Ground collider via invisible static body
    const platforms = this.physics.add.staticGroup()
    platforms.create(width / 2, height - 16, null).setDisplaySize(width, 32).refreshBody()
    this.physics.add.collider(this.player, platforms)

    // Camera
    this.cameras.main.startFollow(this.player)
    this.cameras.main.setBounds(0, 0, width, height)

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys()
    this.keys = this.input.keyboard.addKeys('A,D,E')

    // HUD scene
    this.scene.launch('UI', { ref: this })

    // Encounter control
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.randomEncounterCheck() })

    // Interact zones list includes NPCs and bushes near them
    this.interactables = [
      { type: 'hint', x: this.npcHint.x, y: this.npcHint.y, r: 40 },
      { type: 'duel', x: this.npcDuel.x, y: this.npcDuel.y, r: 40 },
      { type: 'ring', x: this.npcRing.x, y: this.npcRing.y, r: 50 },
      // Bush ambush spots
      ...this.spawnZones.map((rect) => ({ type: 'bush', x: rect.x + 40, y: rect.y, r: 60 })),
    ]

    // Limit monsters in world (visual-only placeholders)
    this.worldMonsters = this.add.group()
    this.time.addEvent({ delay: 3000, loop: true, callback: () => this.populateWorldMonsters() })

    // Mobile controls overlay
    this.createMobileControls()
  }
  update() {
    const speed = 160
    const onGround = this.player.body.blocked.down

    let vx = 0
    if (this.cursors.left.isDown || this.keys.A.isDown) vx = -speed
    if (this.cursors.right.isDown || this.keys.D.isDown) vx = speed
    this.player.setVelocityX(vx)

    if ((this.cursors.space.isDown) && onGround) this.player.setVelocityY(-300)

    // Interaction
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      const near = this.interactables.find((x) => Phaser.Math.Distance.Between(this.player.x, this.player.y, x.x, x.y) < x.r)
      if (near) this.handleInteract(near)
    }

    // Save lightweight position
    saveState({
      x: Math.floor(this.player.x),
      y: Math.floor(this.player.y),
      playerState: this.playerState,
      team: this.playerState.team,
      gotRing: this.playerState.gotRing,
    })
  }
  handleInteract(obj) {
    if (obj.type === 'hint') {
      this.scene.get('UI').showDialog(['Selamat datang di Pocket Grove!', 'Semak tinggi bisa memicu encounter acak.', 'Tekan E di semak untuk kemungkinan ambush.'])
    } else if (obj.type === 'duel') {
      this.startBattle({ kind: 'npcDuel', enemyTeam: [makeMonster('tengkukrock'), makeMonster('flarepup')] })
    } else if (obj.type === 'ring') {
      if (this.playerState.gotRing) {
        this.scene.get('UI').showDialog(['Kau sudah mendapatkan cincin. Selamat!'])
      } else if ((this.player.x > this.cameras.main.worldView.width - 200) && this.playerState.team.length > 0) {
        this.scene.get('UI').showDialog(['Selamat sampai di ujung!', 'Ini cincin untukmu.']).then(() => {
          this.playerState.gotRing = true
          this.scene.get('UI').showReward('Cincin Legendaris')
          saveState({ x: this.player.x, y: this.player.y, playerState: this.playerState, team: this.playerState.team, gotRing: true })
        })
      } else {
        this.scene.get('UI').showDialog(['Datanglah ke ujung map dan punya minimal satu monster untuk mendapatkan cincin.'])
      }
    } else if (obj.type === 'bush') {
      // Ambush chance
      if (Math.random() < 0.6) this.startBattle({ kind: 'ambush', enemy: pickWild() })
      else this.scene.get('UI').toast('Tidak ada apa-apa di semak ini...')
    }
  }
  populateWorldMonsters() {
    // Keep up to 4 visual monsters
    if (this.worldMonsters.getLength() >= 4) return
    const rect = Phaser.Utils.Array.GetRandom(this.spawnZones)
    const m = Phaser.Utils.Array.GetRandom(MONSTERS)
    const sprite = this.add.image(rect.x + Math.random() * rect.width, rect.y, m.id).setOrigin(0.5, 1).setAlpha(0.9)
    this.worldMonsters.add(sprite)
    this.tweens.add({ targets: sprite, x: sprite.x + Phaser.Math.Between(-40, 40), duration: 2000, yoyo: true, repeat: -1 })
  }
  randomEncounterCheck() {
    // If player inside any spawn zone, chance to trigger
    const inZone = this.spawnZones.some((z) => Phaser.Geom.Rectangle.Contains(z, this.player.x, this.player.y))
    if (inZone && Math.random() < 0.2) this.startBattle({ kind: 'random', enemy: pickWild() })
  }
  startBattle(payload) {
    this.scene.get('UI').playSfx('battle')
    this.scene.pause()
    this.scene.launch('Battle', { origin: this, payload })
  }
}

// Utilities
function makeMonster(id) {
  const base = MONSTERS.find((m) => m.id === id) || MONSTERS[0]
  return {
    id: base.id,
    name: base.name,
    element: base.element,
    rarity: base.rarity,
    maxHP: base.baseHP,
    hp: base.baseHP,
    attack: base.baseAttack,
    defense: base.baseDefense,
    speed: base.speed,
    captureRate: base.captureRate,
  }
}
function pickWild() {
  // Weighted by rarity
  const pool = []
  MONSTERS.forEach((m) => {
    const w = m.rarity === 'Common' ? 6 : m.rarity === 'Uncommon' ? 3 : 1
    for (let i = 0; i < w; i++) pool.push(m.id)
  })
  return makeMonster(Phaser.Utils.Array.GetRandom(pool))
}

// Battle Scene
class BattleScene extends Phaser.Scene {
  constructor() { super('Battle') }
  init(data) {
    this.origin = data.origin
    this.payload = data.payload
    this.playerState = this.origin.playerState
    this.turn = 'player'

    // Prepare teams
    this.playerTeam = this.playerState.team.length ? this.playerState.team.map((t) => ({ ...t })) : [{ name: 'Adventurer', id: 'default', element: 'Neutral', maxHP: 25, hp: 25, attack: 6, defense: 3, speed: 6 }]
    this.enemyTeam = this.payload.enemyTeam || [this.payload.enemy || pickWild()]
    this.activePlayer = 0
    this.activeEnemy = 0

    this.failCaptureStreak = 0
  }
  create() {
    const W = this.scale.width
    const H = this.scale.height
    this.cameras.main.setBackgroundColor('#0b1c10')
    this.add.rectangle(W/2, H/2, W, H, 0x0b1c10, 0.95)

    // Sprites
    this.enemySprite = this.add.image(W*0.7, H*0.5, this.enemyTeam[this.activeEnemy].id || 'npc').setScale(2)
    this.playerSprite = this.add.image(W*0.3, H*0.7, this.playerTeam[this.activePlayer].id === 'default' ? 'player' : this.playerTeam[this.activePlayer].id).setScale(2)

    // HP bars
    this.playerHpBar = this.makeBar(W*0.15, 40, 150, 12, 0x44bb44)
    this.enemyHpBar = this.makeBar(W*0.55, 40, 150, 12, 0xbb4444)
    this.refreshBars()

    // Actions UI simple
    this.actions = this.addContainerButtons(W/2, H-80, [
      { key: 'Attack', onClick: () => this.performAttack('basic') },
      { key: 'Skill', onClick: () => this.performAttack('skill') },
      { key: 'Item', onClick: () => this.useItem() },
      { key: 'Run', onClick: () => this.tryRun() },
      { key: 'Capture', onClick: () => this.tryCapture() },
    ])

    this.shakeIntro()
  }
  makeBar(x, y, w, h, color) {
    const back = this.add.rectangle(x, y, w, h, 0x000000, 0.6).setOrigin(0, 0.5)
    const fill = this.add.rectangle(x, y, w, h, color).setOrigin(0, 0.5)
    return { back, fill, w }
  }
  refreshBars() {
    const p = this.playerTeam[this.activePlayer]
    const e = this.enemyTeam[this.activeEnemy]
    this.playerHpBar.fill.width = this.playerHpBar.w * Math.max(0, p.hp) / p.maxHP
    this.enemyHpBar.fill.width = this.enemyHpBar.w * Math.max(0, e.hp) / e.maxHP
  }
  addContainerButtons(cx, cy, items) {
    const container = this.add.container(cx, cy)
    const spacing = 80
    items.forEach((item, i) => {
      const g = this.add.rectangle(i*spacing - (spacing*items.length/2), 0, 70, 30, 0x222222, 0.8).setStrokeStyle(1, 0xffffff)
      const t = this.add.text(g.x, g.y, item.key, { fontSize: '12px', fontFamily: 'monospace' }).setOrigin(0.5)
      g.setInteractive({ useHandCursor: true }).on('pointerdown', item.onClick)
      container.add([g, t])
    })
    return container
  }
  popupText(x, y, text, color= '#fff') {
    const t = this.add.text(x, y, text, { color, fontFamily: 'monospace' }).setOrigin(0.5)
    this.tweens.add({ targets: t, y: y-20, alpha: 0, duration: 700, onComplete: () => t.destroy() })
  }
  shakeIntro() {
    this.cameras.main.shake(200, 0.004)
    this.time.delayedCall(250, () => this.popupText(this.scale.width/2, 80, 'Battle start!'))
  }
  performAttack(type) {
    if (this.turn !== 'player') return
    const p = this.playerTeam[this.activePlayer]
    const e = this.enemyTeam[this.activeEnemy]
    const mult = type === 'skill' ? 1.4 : 1.0
    const elemMod = getElementMod(p.element, e.element)
    const damage = Math.max(1, Math.floor(p.attack * mult * elemMod - e.defense * 0.5))
    e.hp -= damage
    this.popupText(this.enemySprite.x, this.enemySprite.y - 60, `-${damage}`, '#ff8080')
    this.refreshBars()
    if (e.hp <= 0) return this.win()
    this.turn = 'enemy'
    this.time.delayedCall(600, () => this.enemyAct())
  }
  enemyAct() {
    const p = this.playerTeam[this.activePlayer]
    const e = this.enemyTeam[this.activeEnemy]
    const mult = 1.0
    const elemMod = getElementMod(e.element, p.element)
    const damage = Math.max(1, Math.floor(e.attack * mult * elemMod - p.defense * 0.5))
    p.hp -= damage
    this.popupText(this.playerSprite.x, this.playerSprite.y - 60, `-${damage}`, '#ffd480')
    this.refreshBars()
    if (p.hp <= 0) return this.loseMember()
    this.turn = 'player'
  }
  useItem() {
    const items = this.playerState.items
    if (items.potion > 0) {
      items.potion -= 1
      const p = this.playerTeam[this.activePlayer]
      p.hp = Math.min(p.maxHP, p.hp + 15)
      this.refreshBars()
      this.popupText(this.playerSprite.x, this.playerSprite.y - 60, '+HP', '#80ff80')
      this.turn = 'enemy'
      this.time.delayedCall(500, () => this.enemyAct())
    } else {
      this.popupText(this.scale.width/2, this.scale.height-120, 'Tidak ada potion')
    }
  }
  tryRun() {
    // Chance based on speed
    const p = this.playerTeam[this.activePlayer]
    const e = this.enemyTeam[this.activeEnemy]
    const chance = Math.min(0.9, Math.max(0.2, (p.speed - e.speed + 5) / 10))
    if (Math.random() < chance) return this.endBattle('run')
    // Fail -> enemy bonus attack
    this.popupText(this.scale.width/2, this.scale.height-120, 'Gagal kabur!')
    this.time.delayedCall(300, () => this.enemyAct())
  }
  tryCapture() {
    const e = this.enemyTeam[this.activeEnemy]
    if (e.hp > e.maxHP * 0.5) {
      this.popupText(this.scale.width/2, this.scale.height-120, 'HP musuh terlalu tinggi!')
      return
    }
    if (this.playerState.items.ball <= 0) {
      this.popupText(this.scale.width/2, this.scale.height-120, 'Tidak ada bola!')
      return
    }
    this.playerState.items.ball -= 1

    const base = e.captureRate
    const hpFactor = 1 - (e.hp / e.maxHP)
    let prob = base * hpFactor
    prob = Math.min(0.95, prob)

    this.throwBallAnim(() => {
      if (Math.random() < prob) {
        this.captureSuccess(e)
      } else {
        this.failCaptureStreak += 1
        if (this.failCaptureStreak >= 3 && Math.random() < 0.5) {
          // Enemy flees
          this.popupText(this.scale.width/2, 120, `${e.name} kabur!`)
          this.endBattle('enemyFled')
        } else {
          this.popupText(this.scale.width/2, 120, 'Capture gagal!')
          this.enemyAct()
        }
      }
    })
  }
  throwBallAnim(done) {
    const ball = this.add.image(this.playerSprite.x, this.playerSprite.y - 20, 'ball')
    this.tweens.add({ targets: ball, x: this.enemySprite.x, y: this.enemySprite.y - 20, duration: 400, ease: 'Quad.easeIn', onComplete: () => {
      // bounce 3 times
      this.tweens.add({ targets: ball, y: ball.y - 12, yoyo: true, repeat: 2, duration: 250, onComplete: () => { ball.destroy(); done() } })
    } })
  }
  captureSuccess(e) {
    this.popupText(this.scale.width/2, 120, `${e.name} tertangkap!`, '#80ffb0')
    // Add to team (max 3)
    if (this.playerState.team.length < 3) {
      this.playerState.team.push(e)
    } else {
      // Replace the first for simplicity – could show selector
      this.playerState.team[0] = e
    }
    saveState({ x: this.origin.player.x, y: this.origin.player.y, playerState: this.origin.playerState, team: this.origin.playerState.team, gotRing: this.origin.playerState.gotRing })
    this.endBattle('captured')
  }
  win() {
    // Rewards
    this.playerState.coins += 3
    this.popupText(this.scale.width/2, 120, 'Menang! +3 koin', '#b0ff80')
    this.time.delayedCall(600, () => this.endBattle('win'))
  }
  loseMember() {
    if (this.activePlayer < this.playerTeam.length - 1) {
      this.activePlayer += 1
      this.playerSprite.setTexture(this.playerTeam[this.activePlayer].id === 'default' ? 'player' : this.playerTeam[this.activePlayer].id)
      this.refreshBars()
      this.turn = 'enemy'
      this.time.delayedCall(600, () => this.enemyAct())
    } else {
      // Lose battle
      this.playerState.items.potion = Math.max(0, this.playerState.items.potion - 1)
      this.playerState.coins = Math.max(0, this.playerState.coins - 2)
      // Respawn: handled by world when resumed
      this.endBattle('lose')
    }
  }
  endBattle(reason) {
    this.scene.stop('Battle')
    this.origin.scene.resume()
    if (reason === 'lose') {
      // Reset position to checkpoint (start)
      this.origin.player.x = 50
      this.origin.player.y = 200
    }
    this.origin.scene.get('UI').refreshHUD()
  }
}

// UI Scene (HUD, dialogs, pause, minimap/progress)
class UIScene extends Phaser.Scene {
  constructor() { super('UI') }
  init(data) { this.world = data.ref }
  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)')

    // HUD containers
    this.hud = this.add.container(10, 10)
    this.hpText = this.add.text(0, 0, 'HP', { fontFamily: 'monospace' })
    this.teamText = this.add.text(0, 20, 'Team', { fontFamily: 'monospace' })
    this.hud.add([this.hpText, this.teamText])

    // Progress bar (minimap substitute)
    const width = 200
    this.progressBack = this.add.rectangle(this.scale.width - width - 12, 16, width, 8, 0xffffff, 0.2).setOrigin(0, 0.5)
    this.progressFill = this.add.rectangle(this.progressBack.x, 16, 1, 8, 0x88ccff).setOrigin(0, 0.5)

    // Pause & audio
    this.input.keyboard.on('keydown-ESC', () => this.togglePause())
    this.muted = false

    // Dialog elements
    this.dialogContainer = this.add.container(0, this.scale.height - 120).setDepth(10)
    this.dialogBg = this.add.rectangle(12, 0, this.scale.width - 24, 100, 0x000000, 0.7).setOrigin(0, 0)
    this.dialogText = this.add.text(24, 16, '', { wordWrap: { width: this.scale.width - 60 }, fontFamily: 'monospace' })
    this.nextBtn = this.add.rectangle(this.scale.width - 120, 70, 100, 24, 0x222222).setStrokeStyle(1, 0xffffff)
    this.nextLabel = this.add.text(this.nextBtn.x, this.nextBtn.y, 'Next', { fontFamily: 'monospace' }).setOrigin(0.5)
    this.dialogContainer.add([this.dialogBg, this.dialogText, this.nextBtn, this.nextLabel]).setVisible(false)

    this.nextBtn.setInteractive({ useHandCursor: true })
    this.nextBtn.on('pointerdown', () => this._advanceDialog())

    // Mobile virtual controls
    this.mobile = {}
    if (this.scale.width < 900) this.createVirtualPad()

    this.refreshHUD()

    // SFX placeholders
    this.sfx = {
      battle: () => {}, step: () => {}, attack: () => {}, captureOk: () => {}, captureFail: () => {}, reward: () => {},
    }
  }
  createVirtualPad() {
    const baseY = this.scale.height - 60
    const left = this.add.circle(60, baseY, 28, 0x222222, 0.6).setStrokeStyle(1, 0xffffff)
    const right = this.add.circle(140, baseY, 28, 0x222222, 0.6).setStrokeStyle(1, 0xffffff)
    const jump = this.add.circle(this.scale.width - 80, baseY, 28, 0x222222, 0.6).setStrokeStyle(1, 0xffffff)
    const inter = this.add.circle(this.scale.width - 140, baseY, 28, 0x222222, 0.6).setStrokeStyle(1, 0xffffff)
    this.input.addPointer(2)

    left.setInteractive(); right.setInteractive(); jump.setInteractive(); inter.setInteractive()

    left.on('pointerdown', () => this.world.cursors.left.isDown = true)
    left.on('pointerup', () => this.world.cursors.left.isDown = false)
    right.on('pointerdown', () => this.world.cursors.right.isDown = true)
    right.on('pointerup', () => this.world.cursors.right.isDown = false)
    jump.on('pointerdown', () => this.world.cursors.space.isDown = true)
    jump.on('pointerup', () => this.world.cursors.space.isDown = false)
    inter.on('pointerdown', () => this.world.keys.E.isDown = true)
    inter.on('pointerup', () => this.world.keys.E.isDown = false)
  }
  refreshHUD() {
    const ps = this.world.playerState
    this.hpText.setText(`HP: ${ps.hp}/${ps.maxHp}  Koin: ${ps.coins}`)
    const teamStr = ps.team.length ? ps.team.map((m, i) => `${i+1}.${m.name} ${m.hp}/${m.maxHP}`).join('  ') : 'Tidak ada monster'
    this.teamText.setText(`Tim: ${teamStr}`)

    // Progress calc
    const total = this.world.physics.world.bounds.width
    const progress = Phaser.Math.Clamp(this.world.player.x / total, 0, 1)
    this.progressFill.width = this.progressBack.width * progress
  }
  togglePause() {
    if (this.world.scene.isPaused()) {
      this.world.scene.resume(); this.toast('Lanjut')
    } else {
      this.world.scene.pause(); this.toast('Pause')
    }
  }
  showDialog(lines) {
    return new Promise((resolve) => {
      this.dialogLines = lines
      this.dialogIdx = 0
      this.dialogContainer.setVisible(true)
      this.dialogText.setText(lines[0])
      this._resolver = resolve
    })
  }
  _advanceDialog() {
    if (!this.dialogLines) return
    this.dialogIdx += 1
    if (this.dialogIdx >= this.dialogLines.length) {
      this.dialogContainer.setVisible(false)
      const res = this._resolver; this._resolver = null; this.dialogLines = null
      res && res()
    } else {
      this.dialogText.setText(this.dialogLines[this.dialogIdx])
    }
  }
  showReward(name) {
    const c = this.add.container(this.scale.width/2, this.scale.height/2)
    const bg = this.add.rectangle(0,0,280,120,0x000000,0.7).setStrokeStyle(1,0xffffff)
    const t = this.add.text(0,0,`Mendapatkan: ${name}`, { fontFamily: 'monospace' }).setOrigin(0.5)
    c.add([bg,t])
    this.tweens.add({ targets: c, alpha: 0, duration: 1200, delay: 1200, onComplete: () => c.destroy() })
  }
  toast(text) {
    const t = this.add.text(this.scale.width/2, 60, text, { fontFamily: 'monospace' }).setOrigin(0.5)
    this.tweens.add({ targets: t, y: 40, alpha: 0, duration: 1000, onComplete: () => t.destroy() })
  }
  playSfx(type) { (this.sfx[type]||(()=>{}))() }
}

const config = {
  type: Phaser.AUTO,
  pixelArt: true,
  backgroundColor: '#0b0f0c',
  scale: { mode: Phaser.Scale.RESIZE, parent: null, width: '100%', height: '100%' },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [BootScene, WorldScene, BattleScene, UIScene],
}

export default function Game() {
  const ref = useRef(null)
  useEffect(() => {
    const parent = ref.current
    const game = new Phaser.Game({ ...config, parent })
    return () => { game.destroy(true) }
  }, [])
  return <div ref={ref} className="w-full h-full" />
}

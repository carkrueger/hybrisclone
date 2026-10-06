import Phaser from 'phaser';
import {
  W, H, U, TILE, DEPTH, SCROLL_SPEED, START_LIVES, START_BOMBS,
  EXTRA_LIFE_EVERY, RESPAWN_INVULN_MS, MAX_BOMBS,
} from '../config.js';
import { InputManager } from '../core/input.js';
import { storage } from '../core/storage.js';
import { settings } from '../core/settings.js';
import { generateLevel, DEFAULT_SEED, LEVELS_PER_SECTOR } from '../level/generator.js';
import { themeFor } from '../level/themes.js';
import { paintNebula, paintPlanet } from '../gfx/paint/space.js';
import { ensureThemeTiles } from '../gfx/paint/station.js';
import { applyPost } from '../gfx/post.js';
import { StationView } from '../gfx/stationView.js';
import { MegaView } from '../gfx/megaView.js';
import { LightLayer, GodRays, Flares } from '../gfx/lighting.js';
import { AmbientView } from '../gfx/ambient.js';
import { audio } from '../audio/index.js';
import { SpritePool } from '../entities/pool.js';
import { FX } from '../entities/fx.js';
import { Player } from '../entities/Player.js';
import { WeaponSystem, MAX_POWER } from '../entities/weapons.js';
import { PODS, WEAPON_TYPES, resolvePickup } from '../entities/pickups.js';
import { Specials } from '../entities/specials.js';
import { PlayerLaser } from '../entities/laser.js';
import { Enemy } from '../entities/Enemy.js';
import { EnemyFire } from '../entities/projectiles.js';
import { createBoss } from '../entities/bosses/index.js';
import { COLORS, text } from '../ui/text.js';

const ADD = Phaser.BlendModes.ADD;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.seed = data.seed || DEFAULT_SEED;
    this.startSectorIndex = data.sector || 0;
    this.startLevelIndex = data.level || 0;
    this.continues = data.continues || 0;
  }

  create() {
    this.preset = settings.preset;
    this.rimColor = 0x5ae4ff;
    this.themeBullet = 'eb_orb';
    this.dtSec = 0;
    this.clock = 0;
    this.hitStopUntil = 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.bombs = START_BOMBS;
    this.power = 0;
    this.weaponType = 'vulcan';
    this.nextExtra = EXTRA_LIFE_EVERY;
    this.hiScore = storage.getHighScores()[0].score;
    this.controls = new InputManager(this);
    this.controls.latch();

    this.nebula = this.add.tileSprite(0, 0, W, H, '__DEFAULT').setOrigin(0).setDepth(DEPTH.nebula);
    this.starsFar = this.add.tileSprite(0, 0, W, H, 'stars_far').setOrigin(0).setDepth(DEPTH.farStars);
    this.planet = this.add.image(0, 0, '__DEFAULT').setDepth(DEPTH.planet);
    this.starsNear = this.add.tileSprite(0, 0, W, H, 'stars_near').setOrigin(0).setDepth(DEPTH.nearStars);
    this.station = null;
    this.mega = null;
    this.ambient = null;

    this.pBullets = new SpritePool(this, DEPTH.playerBullets, ADD);
    this.enemies = [];
    this.spawnQueue = [];
    this.pods = [];
    this.fx = new FX(this, this.preset);
    this.fxG = this.add.graphics().setDepth(DEPTH.enemies + 3).setBlendMode(ADD);
    this.player = new Player(this, this.preset);
    this.weapons = new WeaponSystem(this, new PlayerLaser(this));
    this.specials = new Specials(this);
    this.efire = new EnemyFire(this);
    this.boss = null;
    this.phase = 'play';

    this.lightLayer = new LightLayer(this, this.preset);
    this.godRays = null;
    this.flares = null;
    applyPost(this, this.cameras.main, this.preset);
    this.scene.launch('Hud');
    this.startLevel(this.startSectorIndex, this.startLevelIndex);
    this.player.spawn(this.clock, RESPAWN_INVULN_MS);

    this.onBlur = () => {
      if (this.scene.isActive() && this.phase !== 'gameover') this.openPause();
    };
    this.game.events.on('blur', this.onBlur);
    this.events.on('resume', () => {
      this.controls.latch();
      audio.resume();
    });
    this.events.once('shutdown', () => {
      this.game.events.off('blur', this.onBlur);
      this.scene.stop('Hud');
    });
    if (import.meta.env.DEV) this.addDevKeys();
    this.cameras.main.fadeIn(500);
    this.updateHud();
  }

  /** dev builds only: digit keys drop pods right above the ship */
  addDevKeys() {
    const letters = 'PVLHOWTDB';
    this.input.keyboard.on('keydown', (ev) => {
      const k = Number(ev.key);
      if (!(k >= 1 && k <= letters.length) || !this.player.alive) return;
      this.spawnPod(this.player.x, this.player.y - 160, letters[k - 1]);
    });
  }

  // ------------------------------------------------------------------ levels
  startLevel(sector, level) {
    const newSector = this.sector !== sector;
    this.sector = sector;
    this.levelIndex = level;
    this.level = generateLevel(this.seed, sector, level);
    const theme = themeFor(sector);
    this.theme = theme;
    this.themeBullet = theme.bullet;
    this.rimColor = this.level.rim;
    this.efire.budget = this.level.diff.budget;
    if (this.player && this.player.decor.rim) this.player.decor.rim.setTint(this.rimColor);
    this.buildBackdrop();
    this.scroll = 0;
    this.waveIdx = 0;
    this.turretIdx = 0;
    this.phase = 'play';
    this.levelStats = { spawned: 0, killed: 0, deaths: 0, bombs: 0 };
    this.updateBackdrop(0);
    audio.playSector(this.level.music.main, this.level.music.hints);
    audio.prepareBoss(this.level.music.boss, this.level.music.hints);
    const round = this.level.round ? `ROUND ${this.level.round + 1}  ·  ` : '';
    if (newSector && level === 0) {
      this.fx.banner('ENTERING', { size: 34, y: H / 2 - 150, color: COLORS.grey, hold: 2400 });
    }
    this.fx.banner(theme.name, { color: COLORS.yellow, hold: 2400, size: 76 });
    this.fx.banner(`${round}SECTOR ${sector + 1} - ${level + 1}`, { size: 34, y: H / 2 - 30, color: COLORS.cyan, hold: 2400 });
  }

  buildBackdrop() {
    if (this.station) this.station.destroy();
    if (this.mega) this.mega.destroy();
    if (this.ambient) this.ambient.destroy();
    const lv = this.level;
    ensureThemeTiles(this, lv.theme);
    paintNebula(this, 'nebula_cur', lv.space.nebula, lv.space.nebulaPalette);
    this.nebula.setTexture('nebula_cur');
    paintPlanet(this, 'planet_cur', lv.space.planet, lv.space.planetKind);
    this.planet.setTexture('planet_cur');
    this.planetX = lv.space.planetX * W;
    this.station = new StationView(this, lv, this.preset);
    this.mega = new MegaView(this, lv.mega, { tint: lv.tint, preset: this.preset });
    this.ambient = new AmbientView(this, lv, this.station, this.preset);
    if (this.godRays) this.godRays.destroy();
    if (this.flares) this.flares.destroy();
    this.godRays = new GodRays(this, lv.sun, this.preset, lv.sector + lv.level + 3);
    this.flares = new Flares(this, lv.sun, this.preset);
  }

  updateBackdrop(dt) {
    this.station.update(this.scroll, this.clock, dt);
    this.mega.update(this.scroll, this.clock, dt);
    this.ambient.update(this.scroll, this.clock, dt);
    this.godRays.update(this.clock);
    this.flares.update(this.clock);
    this.nebula.tilePositionY -= 6 * dt;
    this.starsFar.tilePositionY -= 14 * dt;
    this.starsNear.tilePositionY -= 34 * dt;
    this.planet.setPosition(this.planetX, -this.planet.height * 0.3 + this.scroll * 0.09);
  }

  clearField() {
    for (const e of this.enemies) if (e.alive) e.leave();
    this.enemies = [];
    this.spawnQueue = [];
    for (const p of this.pods) p.sprite.destroy();
    this.pods = [];
    this.pBullets.releaseAll();
    this.efire.clear();
  }

  hitStop(ms) {
    this.hitStopUntil = this.clock + ms;
  }

  // ------------------------------------------------------------------ main loop
  update(time, delta) {
    let dt = Math.min(delta, 50) / 1000;
    if (this.clock < this.hitStopUntil) dt *= 0.15;
    this.dtSec = dt;
    this.clock += dt * 1000;
    const now = this.clock;
    this.controls.update(delta);

    if (this.controls.pressed('pause') && this.phase !== 'gameover') {
      this.openPause();
      return;
    }

    if (this.scroll < this.level.length) this.scroll = Math.min(this.level.length, this.scroll + SCROLL_SPEED * dt);
    this.updateBackdrop(dt);
    if (this.phase === 'play' && this.scroll >= this.level.length) this.startBossWarning();

    this.spawn(now);
    this.player.update(dt, this.controls, now);
    const armed = this.player.alive && !this.player.entering && this.phase !== 'gameover';
    const firing = armed && this.controls.held('fire');
    if (armed) {
      this.weapons.update(dt, firing, this.player, this.power, this.weaponType);
      if (this.controls.pressed('bomb')) this.useBomb(now);
    } else this.weapons.idle();

    this.updatePlayerBullets(dt);
    this.specials.update(dt, now, firing);
    this.fxG.clear();
    for (const e of this.enemies) e.update(dt, now);
    this.enemies = this.enemies.filter((e) => e.alive);
    if (this.boss) this.boss.update(dt, now);
    this.efire.update(dt);
    this.updatePods(dt);
    this.collide(now);
    this.lightLayer.update(dt);
    this.updateHud();
  }

  spawn(now) {
    const waves = this.level.waves;
    while (this.waveIdx < waves.length && waves[this.waveIdx].d <= this.scroll) {
      const w = waves[this.waveIdx++];
      const stats = { total: w.count, killed: 0 };
      for (let i = 0; i < w.count; i++) this.spawnQueue.push({ at: now + i * w.interval, w, i, stats });
    }
    if (this.spawnQueue.length) {
      const due = this.spawnQueue.filter((q) => q.at <= now);
      if (due.length) {
        this.spawnQueue = this.spawnQueue.filter((q) => q.at > now);
        for (const q of due) {
          const e = new Enemy(this, q.w, q.i);
          e.stats = q.stats;
          e.counted = true;
          this.levelStats.spawned++;
          this.enemies.push(e);
        }
      }
    }
    const turrets = this.level.turrets;
    while (this.turretIdx < turrets.length && turrets[this.turretIdx].d - this.scroll <= H + TILE) {
      const t = turrets[this.turretIdx++];
      const pseudo = { type: t.type, pattern: 'ground', d: t.d, x: t.x, raised: t.raised, fireDelay: t.fireDelay, carrier: -1, elite: -1, canFire: true };
      const e = new Enemy(this, pseudo, 0);
      e.counted = true;
      this.levelStats.spawned++;
      this.enemies.push(e);
    }
  }

  /** spawn a minion (shard splinters, swarmers, mines, boss reinforcements) */
  spawnEnemy(type, x, y, { pattern = 'line', params = {}, count = 1, index = 0 } = {}) {
    if (this.phase === 'gameover') return null;
    const wave = { type, pattern, count, interval: 0, params, fireDelays: Array(count).fill(900), canFire: true, carrier: -1, elite: -1, d: 0 };
    let first = null;
    for (let i = 0; i < count; i++) {
      const e = new Enemy(this, wave, count > 1 ? i : index, count > 1 ? null : { x, y });
      this.enemies.push(e);
      if (!first) first = e;
    }
    return first;
  }

  // ------------------------------------------------------------------ player bullets
  spawnPlayerBullet(tex, x, y, vx, vy, dmg, rotation) {
    const b = this.pBullets.get(tex, x, y);
    b.vx = vx;
    b.vy = vy;
    b.dmg = dmg;
    b.r = 10;
    b.homing = false;
    b.rotation = rotation;
    b.setBlendMode(ADD);
    return b;
  }

  spawnMissile(x, y, angle = -Math.PI / 2) {
    const v = 150 * U;
    const b = this.spawnPlayerBullet('pb_missile', x, y, Math.cos(angle) * v, Math.sin(angle) * v, 2, angle + Math.PI / 2);
    b.setBlendMode(Phaser.BlendModes.NORMAL);
    b.homing = true;
    b.life = 2600;
    b.speed = 150 * U;
    b.target = null;
    b.retarget = 0;
    this.playSfx('missile', x);
  }

  findTarget(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.y < 0 || !e.vuln) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { alive: () => e.alive, pos: () => ({ x: e.x, y: e.y }) };
      }
    }
    const boss = this.boss;
    if (boss) {
      for (const t of boss.targets()) {
        const d = (t.x - x) ** 2 + (t.y - y) ** 2;
        if (d < bestD) {
          bestD = d;
          const p = t.part;
          best = { alive: () => p.alive && boss.state === 'fight', pos: () => boss.partPos(p) };
        }
      }
    }
    return best;
  }

  updatePlayerBullets(dt) {
    const m = 60;
    this.pBullets.forEach((b) => {
      if (b.homing) {
        b.life -= dt * 1000;
        if (b.life <= 0) {
          this.pBullets.release(b);
          return;
        }
        b.retarget -= dt * 1000;
        if (!b.target || !b.target.alive() || b.retarget <= 0) {
          b.target = this.findTarget(b.x, b.y);
          b.retarget = 250;
        }
        b.speed = Math.min(340 * U, b.speed + 320 * U * dt);
        let ang = Math.atan2(b.vy, b.vx);
        if (b.target) {
          const t = b.target.pos();
          ang += Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(Math.atan2(t.y - b.y, t.x - b.x) - ang), -6 * dt, 6 * dt);
        }
        b.vx = Math.cos(ang) * b.speed;
        b.vy = Math.sin(ang) * b.speed;
        b.rotation = ang + Math.PI / 2;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -m || b.y > H + m || b.x < -m || b.x > W + m) this.pBullets.release(b);
    });
  }

  // ------------------------------------------------------------------ collisions
  collide(now) {
    const downed = this.efire.collideShots(this.pBullets);
    if (downed) this.addScore(downed * 50);
    this.pBullets.forEach((b) => {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const rr = e.r + b.r;
        if (dx * dx + dy * dy < rr * rr) {
          this.pBullets.release(b);
          this.fx.hitSpark(b.x, b.y);
          this.hitEnemy(e, b.dmg, now);
          return;
        }
      }
      if (this.boss) {
        const part = this.boss.hitTest(b.x, b.y, b.r);
        if (part) {
          this.pBullets.release(b);
          this.fx.hitSpark(b.x, b.y);
          this.addScore(this.boss.damage(part, b.dmg, now));
        }
      }
    });

    const pl = this.player;
    if (!pl.alive || pl.entering || pl.isInvulnerable(now) || this.phase === 'gameover') return;
    const px = pl.x;
    const py = pl.y;
    let hit = this.efire.collidePlayer(px, py);
    if (!hit) {
      for (const e of this.enemies) {
        if (!e.alive || e.ground || !e.vuln) continue;
        const rr = e.r * 0.8 + 14;
        if ((e.x - px) ** 2 + (e.y - py) ** 2 < rr * rr) {
          hit = true;
          this.hitEnemy(e, 5, now);
          break;
        }
      }
    }
    if (!hit && this.boss && this.boss.hullContains(px, py, -10)) hit = true;
    if (hit && this.specials.absorbHit(now)) return;
    if (hit) this.killPlayer(now);
  }

  hitEnemy(e, dmg, now) {
    if (e.damage(dmg, now)) this.killEnemy(e);
    else this.playSfx('hit', e.x);
  }

  /** a mine went off near the player: no score, just a ring of shrapnel */
  detonateMine(e) {
    e.alive = false;
    e.destroySprites();
    this.mineBurst(e);
  }

  mineBurst(e) {
    this.fx.explode(e.x, e.y, 1.6);
    this.playSfx('explodeSmall', e.x);
    const n = 8;
    const off = Math.random() * Math.PI;
    for (let k = 0; k < n; k++) this.efire.bullet('eb_big', e.x, e.y, off + (k / n) * Math.PI * 2, e.bulletSpeed * 0.7);
  }

  killEnemy(e) {
    this.addScore(e.score);
    if (e.counted) this.levelStats.killed++;
    if (e.def.mine) this.mineBurst(e);
    const big = e.r >= 44 || e.elite;
    this.fx.explode(e.x, e.y, big ? 2.6 : e.ground ? 1.4 : e.r < 20 ? 0.6 : 1);
    this.playSfx(big ? 'explodeBig' : 'explodeSmall', e.x);
    if (big) {
      this.cameras.main.shake(180, 0.006);
      this.hitStop(60);
    }
    if (e.elite) this.spawnPod(e.x, e.y, this.power < MAX_POWER ? 'P' : 'B');
    else if (e.carrier && e.wave.pod) this.spawnPod(e.x, e.y, e.wave.pod);
    if (e.stats) {
      e.stats.killed++;
      if (e.stats.killed === e.stats.total && e.stats.total >= 3) {
        const bonus = e.stats.total * 100;
        this.addScore(bonus);
        this.fx.floatText(e.x, e.y - 30, 'BONUS ' + bonus, COLORS.cyan);
        this.playSfx('bonus', e.x);
      }
    }
  }

  // ------------------------------------------------------------------ pods
  spawnPod(x, y, type) {
    const sprite = this.add.image(x, y, 'pod_' + type).setDepth(DEPTH.pickups);
    this.pods.push({ sprite, type, t: 0 });
  }

  updatePods(dt) {
    const pl = this.player;
    for (const p of this.pods) {
      p.t += dt;
      p.sprite.y += 38 * U * dt;
      p.sprite.x += Math.sin(p.t * 3) * 18 * U * dt;
      p.sprite.setScale(1 + Math.sin(p.t * 10) * 0.08);
      p.sprite.rotation = Math.sin(p.t * 2) * 0.2;
      if (pl.alive && Math.hypot(p.sprite.x - pl.x, p.sprite.y - pl.y) < 52) {
        this.collectPod(p);
        p.dead = true;
      } else if (p.sprite.y > H + 40) p.dead = true;
      if (p.dead) p.sprite.destroy();
    }
    this.pods = this.pods.filter((p) => !p.dead);
  }

  collectPod(p) {
    const { x, y } = p.sprite;
    this.playSfx('pickup', x);
    const pod = PODS[p.type];
    this.fx.sparkle(x, y, pod ? pod.color : 0xffd040);
    const state = { power: this.power, bombs: this.bombs, weapon: this.weaponType, specials: new Set(this.specials.ids()), shield: this.specials.shield };
    const r = resolvePickup(state, p.type, { maxPower: MAX_POWER, maxBombs: MAX_BOMBS });
    this.power = r.state.power;
    this.bombs = r.state.bombs;
    this.weaponType = r.state.weapon;
    if (r.special) this.specials.add(r.special);
    if (r.shieldOn) this.specials.setShield(true);
    this.addScore(r.score);
    const tone = r.tone === 'weapon' ? WEAPON_TYPES[this.weaponType].color : COLORS[r.tone];
    this.fx.floatText(x, y, r.text, tone);
  }

  // ------------------------------------------------------------------ player events
  useBomb(now) {
    if (this.bombs <= 0) return;
    this.bombs--;
    this.levelStats.bombs++;
    this.fx.screenFlash(0xffffff, 700, 0.85);
    this.cameras.main.shake(450, 0.012);
    this.playSfx('bomb', this.player.x);
    this.flares.burst(this.player.x, this.player.y, 1.4);
    this.lightLayer.add(this.player.x, this.player.y, 900, 0xc0e0ff, 700, 1);
    this.fx.shockRing(this.player.x, this.player.y, 14);
    this.efire.clear(true);
    for (const e of this.enemies) {
      if (e.alive && e.y > -20 && e.y < H + 20) this.hitEnemy(e, 25, now);
    }
    if (this.boss && this.boss.state === 'fight') {
      for (const p of [...this.boss.parts]) {
        if (!p.alive) continue;
        this.addScore(this.boss.damage(p, p.core ? 30 : 15, now));
        if (this.boss.state !== 'fight') break;
      }
    }
    this.player.invulnUntil = Math.max(this.player.invulnUntil, now + 800);
  }

  killPlayer() {
    const pl = this.player;
    if (!pl.alive || this.phase === 'gameover') return;
    pl.kill();
    this.weapons.idle();
    this.specials.clear(true);
    this.levelStats.deaths++;
    this.fx.explode(pl.x, pl.y, 3.2);
    this.fx.screenFlash(0xff8040, 320, 0.4);
    this.cameras.main.shake(450, 0.015);
    this.hitStop(120);
    this.playSfx('playerDie', pl.x);
    this.lives--;
    this.power = Math.max(0, this.power - 1);
    this.time.delayedCall(1800, () => {
      if (this.lives <= 0) {
        this.gameOver();
        return;
      }
      this.efire.clear();
      this.bombs = Math.max(this.bombs, 2);
      pl.spawn(this.clock, RESPAWN_INVULN_MS);
    });
  }

  addScore(n) {
    if (!n) return;
    this.score += n;
    if (this.score > this.hiScore) this.hiScore = this.score;
    while (this.score >= this.nextExtra) {
      this.nextExtra += EXTRA_LIFE_EVERY;
      this.lives++;
      this.playSfx('extraLife');
      this.fx.banner('EXTRA SHIP', { size: 44, color: COLORS.green, y: H / 2 + 60, hold: 1200 });
    }
  }

  // ------------------------------------------------------------------ boss
  startBossWarning() {
    this.phase = 'bossWarning';
    const b = this.level.boss;
    audio.stopMusic(0.6);
    this.playSfx('warning');
    this.fx.banner('WARNING', { color: COLORS.red, blink: true, hold: 1800, size: b.mid ? 80 : 110 });
    this.fx.banner(b.name + ' APPROACHING', { size: 36, y: H / 2 - 20, color: COLORS.orange, hold: 1800 });
    this.time.delayedCall(2200, () => {
      this.boss = createBoss(this, b);
      this.phase = 'boss';
      audio.playBoss(this.level.music.boss, this.level.music.hints);
    });
  }

  onBossDying() {
    this.efire.clear(true);
    for (const e of this.enemies) if (e.alive) this.hitEnemy(e, 999, this.clock);
    audio.stopMusic(0.5);
  }

  onBossDefeated() {
    this.boss = null;
    this.phase = 'clear';
    this.time.delayedCall(700, () => this.showTally());
  }

  showTally() {
    const st = this.levelStats;
    const lastLevel = this.levelIndex === LEVELS_PER_SECTOR - 1;
    const pct = st.spawned ? st.killed / st.spawned : 1;
    const mult = 1 + this.level.diff.D * 0.25;
    const killBonus = Math.round(pct * 100) * Math.round(50 * mult);
    const noMiss = st.deaths === 0 ? Math.round(10000 * mult) : 0;
    const bombSaver = st.bombs === 0 ? Math.round(5000 * mult) : 0;
    const sectorBonus = lastLevel ? Math.round(20000 * mult) : 0;
    audio.playJingle('sectorClear');
    const items = [];
    const add = (o) => (items.push(o), o);
    const cx = W / 2;
    let y = H / 2 - 210;
    const boxH = 200 + (lastLevel ? 4 : 3) * 52;
    add(this.add.rectangle(cx, y - 50 + boxH / 2, 860, boxH, 0x04060e, 0.78).setStrokeStyle(2, 0x5ae4ff, 0.5).setDepth(DEPTH.overlay));
    add(text(this, cx, y, lastLevel ? 'SECTOR CLEAR' : 'LEVEL CLEAR', { size: 60, color: COLORS.green, depth: DEPTH.overlay + 1 }));
    y += 80;
    const rows = [
      [`DESTROYED  ${Math.round(pct * 100)}%`, killBonus],
      ['NO MISS', noMiss],
      ['BOMB SAVER', bombSaver],
    ];
    if (lastLevel) rows.push(['SECTOR BONUS', sectorBonus]);
    let total = 0;
    rows.forEach(([label, val], k) => {
      add(text(this, cx - 360, y + k * 52, label, { size: 30, origin: [0, 0.5], color: val ? COLORS.white : COLORS.dim, depth: DEPTH.overlay + 1, glow: false }));
      const t = add(text(this, cx + 360, y + k * 52, '0', { size: 30, origin: [1, 0.5], color: COLORS.yellow, depth: DEPTH.overlay + 1 }));
      this.tweens.addCounter({ from: 0, to: val, duration: 900, delay: 300 + k * 350, onUpdate: (tw) => t.setText(String(Math.round(tw.getValue()))) });
      total += val;
    });
    this.addScore(total);
    this.time.delayedCall(4400, () => {
      this.cameras.main.fadeOut(700);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        items.forEach((o) => o.destroy());
        this.clearField();
        const next = lastLevel ? [this.sector + 1, 0] : [this.sector, this.levelIndex + 1];
        this.startLevel(next[0], next[1]);
        this.cameras.main.fadeIn(700);
      });
    });
  }

  // ------------------------------------------------------------------ flow
  gameOver() {
    if (this.phase === 'gameover') return;
    this.phase = 'gameover';
    audio.stopMusic(0.3);
    this.fx.banner('GAME OVER', { color: COLORS.red, hold: 1800, size: 110 });
    this.time.delayedCall(2200, () => {
      this.cameras.main.fadeOut(500);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameOver', { score: this.score, seed: this.seed, sector: this.sector, level: this.levelIndex, continues: this.continues });
      });
    });
  }

  openPause() {
    if (this.phase === 'gameover' || !this.scene.isActive()) return;
    audio.pause();
    this.scene.launch('Pause');
    this.scene.pause();
  }

  playSfx(name, x) {
    audio.sfx(name, x === undefined ? 0 : Phaser.Math.Clamp((x / W) * 2 - 1, -1, 1) * 0.75);
  }

  updateHud() {
    const b = this.boss;
    this.hudState = {
      score: this.score,
      hi: this.hiScore,
      lives: this.lives,
      bombs: this.bombs,
      power: this.power,
      weapon: this.weaponType,
      specials: [...this.specials.ids(), ...(this.specials.shield ? ['shield'] : [])].join(','),
      seed: this.seed,
      sector: this.sector + 1,
      level: this.levelIndex + 1,
      themeName: this.theme.name,
      round: this.level.round,
      device: this.controls.device,
      boss: b && b.state === 'fight' ? b.hpFraction() : -1,
      bossName: b ? this.level.boss.name : '',
      bossShield: b && b.state === 'fight' && b.core ? !b.coreOpen() : false,
    };
  }
}

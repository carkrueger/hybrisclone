import Phaser from 'phaser';
import {
  W, H, U, TILE, DEPTH, SCROLL_SPEED, START_LIVES, START_BOMBS,
  EXTRA_LIFE_EVERY, RESPAWN_INVULN_MS, PLAYER_HIT_RADIUS, MAX_BOMBS,
} from '../config.js';
import { InputManager } from '../core/input.js';
import { storage } from '../core/storage.js';
import { settings } from '../core/settings.js';
import { generateSector, DEFAULT_SEED } from '../level/generator.js';
import { paintNebula, paintPlanet } from '../gfx/paint/space.js';
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
import { Enemy } from '../entities/Enemy.js';
import { Boss } from '../entities/Boss.js';
import { COLORS } from '../ui/text.js';

const MAX_ENEMY_BULLETS = 500;
const ADD = Phaser.BlendModes.ADD;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.seed = data.seed || DEFAULT_SEED;
    this.startSectorIndex = data.sector || 0;
    this.continues = data.continues || 0;
  }

  create() {
    this.preset = settings.preset;
    this.rimColor = 0x5ae4ff;
    this.dtSec = 0;
    this.clock = 0;
    this.hitStopUntil = 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.bombs = START_BOMBS;
    this.power = 0;
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
    this.eBullets = new SpritePool(this, DEPTH.enemyBullets, ADD);
    this.enemies = [];
    this.spawnQueue = [];
    this.pods = [];
    this.fx = new FX(this, this.preset);
    this.player = new Player(this, this.preset);
    this.weapons = new WeaponSystem(this);
    this.boss = null;
    this.phase = 'play';

    this.lightLayer = new LightLayer(this, this.preset);
    this.godRays = null;
    this.flares = null;
    applyPost(this, this.cameras.main, this.preset);
    this.scene.launch('Hud');
    this.startSector(this.startSectorIndex);
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
    this.cameras.main.fadeIn(500);
    this.updateHud();
  }

  // ------------------------------------------------------------------ sector
  startSector(n) {
    this.sector = n;
    this.level = generateSector(this.seed, n);
    this.rimColor = this.level.rim;
    if (this.player && this.player.decor.rim) this.player.decor.rim.setTint(this.rimColor);
    this.buildBackdrop();
    this.scroll = 0;
    this.waveIdx = 0;
    this.turretIdx = 0;
    this.phase = 'play';
    this.updateBackdrop(0);
    audio.playSector(this.level.music.main);
    audio.prepareBoss(this.level.music.boss);
    this.fx.banner(`SECTOR ${n + 1}`, { color: COLORS.yellow, hold: 2200 });
    this.fx.banner(`SEED ${this.seed}`, { size: 34, y: H / 2 - 30, color: COLORS.grey, hold: 2200 });
  }

  buildBackdrop() {
    if (this.station) this.station.destroy();
    if (this.mega) this.mega.destroy();
    if (this.ambient) this.ambient.destroy();
    const lv = this.level;
    paintNebula(this, 'nebula_cur', lv.space.nebula);
    this.nebula.setTexture('nebula_cur');
    paintPlanet(this, 'planet_cur', lv.space.planet);
    this.planet.setTexture('planet_cur');
    this.planetX = lv.space.planetX * W;
    this.station = new StationView(this, lv, this.preset);
    this.mega = new MegaView(this, lv.mega, { tint: lv.tint, preset: this.preset });
    this.ambient = new AmbientView(this, lv, this.station, this.preset);
    if (this.godRays) this.godRays.destroy();
    if (this.flares) this.flares.destroy();
    this.godRays = new GodRays(this, lv.sun, this.preset, lv.sector + 3);
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
    this.planet.setPosition(this.planetX, -this.planet.height * 0.3 + this.scroll * 0.07);
  }

  clearField() {
    for (const e of this.enemies) if (e.alive) e.leave();
    this.enemies = [];
    this.spawnQueue = [];
    for (const p of this.pods) p.sprite.destroy();
    this.pods = [];
    this.pBullets.releaseAll();
    this.eBullets.releaseAll();
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

    if (this.scroll < this.level.length) {
      this.scroll = Math.min(this.level.length, this.scroll + SCROLL_SPEED * dt);
    }
    this.updateBackdrop(dt);

    if (this.phase === 'play' && this.scroll >= this.level.length) this.startBossWarning();

    this.spawn(now);

    this.player.update(dt, this.controls, now);
    if (this.player.alive && !this.player.entering && this.phase !== 'gameover') {
      this.weapons.update(dt, this.controls.held('fire'), this.player, this.power);
      if (this.controls.pressed('bomb')) this.useBomb(now);
    }

    this.updateBullets(dt);
    for (const e of this.enemies) e.update(dt, now);
    this.enemies = this.enemies.filter((e) => e.alive);
    if (this.boss) this.boss.update(dt, now);
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
          const e = new Enemy(this, q.w, q.i, this.sector);
          e.stats = q.stats;
          this.enemies.push(e);
        }
      }
    }
    const turrets = this.level.turrets;
    while (this.turretIdx < turrets.length && turrets[this.turretIdx].d - this.scroll <= H + TILE) {
      const t = turrets[this.turretIdx++];
      const pseudo = { type: 'turret', pattern: 'ground', d: t.d, x: t.x, raised: t.raised, fireDelay: t.fireDelay, carrier: -1, canFire: true };
      this.enemies.push(new Enemy(this, pseudo, 0, this.sector));
    }
  }

  // ------------------------------------------------------------------ bullets
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

  spawnMissile(x, y) {
    const b = this.spawnPlayerBullet('pb_missile', x, y, 0, -150 * U, 2, 0);
    b.setBlendMode(Phaser.BlendModes.NORMAL);
    b.homing = true;
    b.life = 2600;
    b.speed = 150 * U;
    b.target = null;
    b.retarget = 0;
    this.playSfx('missile', x);
  }

  spawnEnemyBullet(tex, x, y, angle, speed) {
    if (this.eBullets.countActive() >= MAX_ENEMY_BULLETS || this.phase === 'gameover') return;
    const b = this.eBullets.get(tex, x, y);
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.r = tex === 'eb_big' ? 10 : 8;
  }

  findTarget(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.y < 0) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { alive: () => e.alive, pos: () => ({ x: e.x, y: e.y }) };
      }
    }
    const boss = this.boss;
    if (boss && boss.state === 'fight') {
      for (const p of [...boss.guns, boss.core]) {
        if (!p.alive) continue;
        const pos = boss.partPos(p);
        const d = (pos.x - x) ** 2 + (pos.y - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { alive: () => p.alive && boss.state === 'fight', pos: () => boss.partPos(p) };
        }
      }
    }
    return best;
  }

  updateBullets(dt) {
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
          const want = Math.atan2(t.y - b.y, t.x - b.x);
          ang += Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - ang), -6 * dt, 6 * dt);
        }
        b.vx = Math.cos(ang) * b.speed;
        b.vy = Math.sin(ang) * b.speed;
        b.rotation = ang + Math.PI / 2;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -m || b.y > H + m || b.x < -m || b.x > W + m) this.pBullets.release(b);
    });
    this.eBullets.forEach((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -m || b.y > H + m || b.x < -m || b.x > W + m) this.eBullets.release(b);
    });
  }

  // ------------------------------------------------------------------ collisions
  collide(now) {
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
    let hit = false;
    this.eBullets.forEach((b) => {
      if (hit) return;
      const dx = b.x - px;
      const dy = b.y - py;
      const rr = b.r + PLAYER_HIT_RADIUS;
      if (dx * dx + dy * dy < rr * rr) {
        hit = true;
        this.eBullets.release(b);
      }
    });
    if (!hit) {
      for (const e of this.enemies) {
        if (!e.alive || e.ground) continue;
        const dx = e.x - px;
        const dy = e.y - py;
        const rr = e.r * 0.8 + 14;
        if (dx * dx + dy * dy < rr * rr) {
          hit = true;
          this.hitEnemy(e, 5, now);
          break;
        }
      }
    }
    if (!hit && this.boss && this.boss.hullContains(px, py, -10)) hit = true;
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
    const n = 10;
    const off = Math.random() * Math.PI;
    for (let k = 0; k < n; k++) this.spawnEnemyBullet('eb_big', e.x, e.y, off + (k / n) * Math.PI * 2, e.bulletSpeed * 0.75);
  }

  killEnemy(e) {
    this.addScore(e.score);
    if (e.def.mine) this.mineBurst(e);
    const big = e.type === 'bomber';
    this.fx.explode(e.x, e.y, big ? 2.6 : e.ground ? 1.4 : 1);
    this.playSfx(big ? 'explodeBig' : 'explodeSmall', e.x);
    if (big) {
      this.cameras.main.shake(180, 0.006);
      this.hitStop(60);
    }
    if (e.carrier && e.wave.pod) this.spawnPod(e.x, e.y, e.wave.pod);
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
    const colors = { P: 0x5ab0ff, B: 0xff5050, S: 0xffd040 };
    this.fx.sparkle(x, y, colors[p.type]);
    if (p.type === 'P') {
      if (this.power < MAX_POWER) {
        this.power++;
        this.fx.floatText(x, y, 'POWER UP', COLORS.cyan);
      } else {
        this.addScore(5000);
        this.fx.floatText(x, y, '5000', COLORS.yellow);
      }
    } else if (p.type === 'B') {
      if (this.bombs < MAX_BOMBS) {
        this.bombs++;
        this.fx.floatText(x, y, 'BOMB', COLORS.red);
      } else {
        this.addScore(3000);
        this.fx.floatText(x, y, '3000', COLORS.yellow);
      }
    } else {
      this.addScore(2000);
      this.fx.floatText(x, y, '2000', COLORS.yellow);
    }
  }

  // ------------------------------------------------------------------ player events
  useBomb(now) {
    if (this.bombs <= 0) return;
    this.bombs--;
    this.fx.screenFlash(0xffffff, 700, 0.85);
    this.cameras.main.shake(450, 0.012);
    this.playSfx('bomb', this.player.x);
    this.flares.burst(this.player.x, this.player.y, 1.4);
    this.lightLayer.add(this.player.x, this.player.y, 900, 0xc0e0ff, 700, 1);
    const ring = this.fx.sprite('ring', this.player.x, this.player.y).setScale(0.3).setTint(0xb0e0ff);
    this.tweens.add({ targets: ring, scale: 14, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => this.fx.release(ring) });
    this.eBullets.forEach((b) => this.fx.hitSpark(b.x, b.y, 0xb0e0ff));
    this.eBullets.releaseAll();
    for (const e of this.enemies) {
      if (e.alive && e.y > -20 && e.y < H + 20) this.hitEnemy(e, 25, now);
    }
    if (this.boss && this.boss.state === 'fight') {
      for (const g of this.boss.guns) if (g.alive) this.addScore(this.boss.damage(g, 15, now));
      this.addScore(this.boss.damage(this.boss.core, 30, now));
    }
    this.player.invulnUntil = Math.max(this.player.invulnUntil, now + 800);
  }

  killPlayer() {
    const pl = this.player;
    if (!pl.alive || this.phase === 'gameover') return;
    pl.kill();
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
      this.eBullets.releaseAll();
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
    audio.stopMusic(0.6);
    this.playSfx('warning');
    this.fx.banner('WARNING', { color: COLORS.red, blink: true, hold: 1800, size: 110 });
    this.fx.banner(this.level.boss.name + ' APPROACHING', { size: 36, y: H / 2 - 20, color: COLORS.orange, hold: 1800 });
    this.time.delayedCall(2200, () => {
      this.boss = new Boss(this, this.level.boss, `${this.seed}_${this.sector}`);
      this.phase = 'boss';
      audio.playBoss(this.level.music.boss);
    });
  }

  onBossDying() {
    this.eBullets.releaseAll();
    audio.stopMusic(0.5);
  }

  onBossDefeated() {
    this.boss = null;
    this.phase = 'clear';
    const bonus = 2000 * (this.sector + 1);
    this.time.delayedCall(800, () => {
      audio.playJingle('sectorClear');
      this.fx.banner(`SECTOR ${this.sector + 1} CLEAR`, { color: COLORS.green, hold: 2600 });
      this.fx.banner(`BONUS ${bonus}`, { size: 40, y: H / 2 - 20, color: COLORS.yellow, hold: 2600 });
      this.addScore(bonus);
    });
    this.time.delayedCall(4400, () => {
      this.cameras.main.fadeOut(700);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.clearField();
        this.startSector(this.sector + 1);
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
        this.scene.start('GameOver', { score: this.score, seed: this.seed, sector: this.sector, continues: this.continues });
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
    this.hudState = {
      score: this.score,
      hi: this.hiScore,
      lives: this.lives,
      bombs: this.bombs,
      power: this.power,
      seed: this.seed,
      sector: this.sector + 1,
      device: this.controls.device,
      boss: this.boss && this.boss.state === 'fight' ? this.boss.core.hp / this.boss.coreMax : -1,
      bossName: this.boss ? this.level.boss.name : '',
    };
  }
}

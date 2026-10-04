// Special enemy behaviours. Each entry may define:
//   init(e)                 once after construction
//   move(e, dt) -> bool     take over positioning (return true when handled)
//   update(e, dt, now, fireZone)   attacks / state machine (runs after movement)
//   onDeath(e)              when killed by the player
//   cleanup(e)              when sprites are destroyed (killed or left the screen)
import Phaser from 'phaser';
import { W, H, U, DEPTH } from '../config.js';
import { aimed, burst, lobAt, missiles } from './attacks.js';

const tele = (e) => e.scene.level.diff.telegraph;
const toPlayer = (e) => Math.atan2(e.scene.player.y - e.y, e.scene.player.x - e.x);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cool = (e, key, ms) => {
  e[key] = (e[key] ?? ms * 0.6) - e.scene.dtSec * 1000;
  if (e[key] <= 0) {
    e[key] = ms * e.scene.level.diff.fireInterval * (e.elite ? 0.75 : 1);
    return true;
  }
  return false;
};

export const BEHAVIORS = {
  // ---------------------------------------------------------------- shipyard
  tug: {
    init(e) {
      e.crate = e.scene.add.image(e.x, e.y, 'e_mine').setDepth(DEPTH.enemies - 0.5).setScale(0.9);
      e.faceMotion = false;
    },
    update(e, dt, now, fireZone) {
      const pl = e.scene.player;
      if (e.crate) {
        e.crate.setPosition(e.x, e.y + 46).setRotation(e.t * 0.002);
        if (e.onScreen && pl.alive && Math.abs(pl.x - e.x) < 90 && pl.y > e.y + 150) {
          e.crate.destroy();
          e.crate = null;
          e.scene.spawnEnemy('mine', e.x, e.y + 46, { pattern: 'drift', params: { xs: [e.x], speed: 45 * U, y0: e.y + 46 } });
          e.scene.playSfx('telegraph', e.x);
        }
      }
      if (fireZone && cool(e, 'shotT', 2400)) aimed(e.scene, e.x, e.y + 30, { speed: e.bulletSpeed * 0.8 });
    },
    cleanup(e) {
      if (e.crate) e.crate.destroy();
    },
  },

  welder: {
    update(e, dt, now, fireZone) {
      const pl = e.scene.player;
      if (!fireZone || !cool(e, 'coneT', 2800)) return;
      if (dist(e, pl) < 520) {
        const a = toPlayer(e);
        e.scene.efire.hazard({ shape: 'cone', x: e.x, y: e.y, r: 330, angle: a, spread: 0.3, warn: tele(e), dur: 700, color: 0x9ad8ff, owner: e, anchor: () => ({ x: e.x, y: e.y }) });
        e.scene.playSfx('telegraph', e.x);
      } else aimed(e.scene, e.x, e.y, { speed: e.bulletSpeed });
    },
  },

  rail: {
    move(e) {
      e.x = e.wave.x + Math.sin(e.t * 0.0007) * 96;
      e.y = H - (e.wave.d - e.scene.scroll);
      return true;
    },
    update(e, dt, now, fireZone) {
      if (!fireZone || !cool(e, 'railT', 3300)) return;
      const anchor = () => ({ x: e.x, y: e.y });
      e.lockAim = false;
      e.scene.efire.beam({ x: e.x, y: e.y, angle: toPlayer(e), width: 16, warn: tele(e) + 300, dur: 140, color: 0x80d0ff, owner: e, anchor, aim: () => toPlayer(e) });
      e.scene.time.delayedCall(tele(e) + 300, () => {
        if (e.alive) e.recoil = 16;
      });
      e.scene.playSfx('telegraph', e.x);
    },
  },

  // ---------------------------------------------------------------- crystal
  shard: {
    onDeath(e) {
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k - 1) * 0.9 + Math.PI;
        const m = e.scene.spawnEnemy('shardlet', e.x, e.y, { pattern: 'burst' });
        if (m) {
          m.vx = Math.cos(a) * 260;
          m.vy = Math.sin(a) * 260 - 120;
        }
      }
    },
    update(e, dt, now, fireZone) {
      if (fireZone && cool(e, 'shotT', 3000)) aimed(e.scene, e.x, e.y, { speed: e.bulletSpeed * 0.9, tex: 'eb_shard' });
    },
  },
  shardlet: {},

  driller: {
    move(e, dt) {
      if (e.state === 'aim') return true;
      if (e.state === 'dash') {
        e.x += Math.cos(e.dashA) * 950 * dt;
        e.y += Math.sin(e.dashA) * 950 * dt;
        return true;
      }
      return false;
    },
    update(e) {
      const p = e.params;
      if (!e.state && e.y >= p.stopY) {
        e.state = 'aim';
        e.dashA = toPlayer(e);
        e.scene.efire.arrow(e.x, e.y, e.dashA, 260, tele(e), 0xff6040);
        e.scene.playSfx('telegraph', e.x);
        e.scene.time.delayedCall(tele(e), () => {
          if (!e.alive) return;
          e.state = 'dash';
          e.sprite.rotation = e.dashA - Math.PI / 2;
          e.faceMotion = false;
        });
      }
    },
  },

  prism: {
    update(e, dt, now, fireZone) {
      if (!fireZone || !cool(e, 'beamT', 3800)) return;
      const sweep = (e.index % 2 ? 1 : -1) * 0.35;
      e.scene.efire.beam({ x: e.x, y: e.y, angle: toPlayer(e), width: 28, warn: tele(e) + 200, dur: 1000, sweep, color: 0x80f0ff, owner: e, anchor: () => ({ x: e.x, y: e.y }), aim: () => toPlayer(e) });
      e.scene.playSfx('telegraph', e.x);
    },
  },

  // ---------------------------------------------------------------- hive
  swarmer: {
    init(e) {
      const p = e.params;
      e.vx = (Math.random() - 0.5) * 60;
      e.vy = p.speed || 140 * U;
      if (e.x < -100) {
        e.x = (p.x ?? W / 2) + (e.index % 4 - 1.5) * 34;
        e.y = (p.y0 ?? -50) - Math.floor(e.index / 4) * 30;
      }
    },
    move(e, dt) {
      const pl = e.scene.player;
      const sp = Math.hypot(e.vx, e.vy) || 1;
      let ax = 0;
      let ay = 0;
      if (pl.alive && e.y < pl.y - 60) {
        ax += ((pl.x - e.x) / Math.max(80, Math.abs(pl.x - e.x))) * 260;
      }
      for (const o of e.scene.enemies) {
        if (o === e || !o.alive || o.type !== 'swarmer') continue;
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 2200 && d2 > 1) {
          ax += (dx / Math.sqrt(d2)) * 300;
          ay += (dy / Math.sqrt(d2)) * 120;
        }
      }
      e.vx += ax * dt;
      e.vy += ay * dt;
      const target = (e.params.speed || 140 * U) * (1 + 0.15 * Math.sin(e.t * 0.006 + e.index));
      const k = target / (Math.hypot(e.vx, e.vy) || 1);
      e.vx *= k;
      e.vy = Math.max(60, e.vy * k);
      e.x += e.vx * dt + Math.sin(e.t * 0.01 + e.index) * 40 * dt * (sp / sp);
      e.y += e.vy * dt;
      return true;
    },
  },

  spitter: {
    update(e, dt, now, fireZone) {
      if (!fireZone || !cool(e, 'lobT', 2900)) return;
      const pl = e.scene.player;
      lobAt(e.scene, e.x, e.y + 20, pl.x, pl.y, { acid: true, burstN: 0, flight: 1000 });
      e.scene.playSfx('enemyShoot', e.x);
    },
  },

  brood: {
    update(e) {
      e.sprite.setScale(1 + Math.sin(e.t * 0.006) * 0.06);
      const pl = e.scene.player;
      e.hatched = e.hatched || 0;
      if (e.hatched < 2 && e.onScreen && e.y > 60 && (dist(e, pl) < 460 || e.t > 4500) && cool(e, 'hatchT', 3500)) {
        e.hatched++;
        e.scene.fx.explode(e.x, e.y, 0.6);
        for (let k = 0; k < 3; k++) {
          e.scene.spawnEnemy('swarmer', e.x + (k - 1) * 30, e.y, { pattern: 'flock', params: { x: e.x, y0: e.y, speed: 150 * U }, index: k });
        }
        e.scene.playSfx('explodeSmall', e.x);
      }
    },
  },

  // ---------------------------------------------------------------- foundry
  lavabomber: {
    update(e, dt, now, fireZone) {
      if (!e.onScreen || e.y > H - 300 || !cool(e, 'bombT', 1400)) return;
      lobAt(e.scene, e.x, e.y + 30, e.x, Math.min(H - 80, e.y + 300), { flight: 700, cross: true, speed: 200, tex: 'eb_ember' });
    },
  },

  flametank: {
    move(e) {
      e.x = e.wave.x + Math.sin(e.t * 0.0005) * 64;
      e.y = H - (e.wave.d - e.scene.scroll);
      return true;
    },
    update(e, dt, now, fireZone) {
      const pl = e.scene.player;
      if (!e.onScreen || !pl.alive || dist(e, pl) > 440 || !cool(e, 'flameT', 2600)) return;
      const a = toPlayer(e);
      e.scene.efire.hazard({ shape: 'cone', x: e.x, y: e.y, r: 380, angle: a, spread: 0.28, warn: Math.max(400, tele(e) * 0.7), dur: 1100, color: 0xff7020, owner: e, anchor: () => ({ x: e.x, y: e.y }) });
      e.scene.playSfx('telegraph', e.x);
    },
  },

  missilepod: {
    update(e, dt, now, fireZone) {
      if (!fireZone || !cool(e, 'salvoT', 3800)) return;
      e.scene.efire.circleMark(e.x, e.y, 46, 450, 0xff5030);
      e.scene.time.delayedCall(450, () => {
        if (e.alive) missiles(e.scene, e.x, e.y, { n: e.scene.level.diff.D >= 4 ? 3 : 2, speed: 230 });
      });
    },
  },

  // ---------------------------------------------------------------- graveyard
  ghost: {
    init(e) {
      e.spot = 0;
      e.state = 'in';
      e.st = 0;
      e.vuln = false;
      const s = e.params.spots[e.index * 3];
      e.x = s[0];
      e.y = s[1];
      e.sprite.setAlpha(0);
    },
    move(e, dt) {
      e.st += dt * 1000;
      const set = (a) => {
        e.sprite.setAlpha(a);
        e.vuln = a > 0.8;
      };
      if (e.state === 'in') {
        set(Math.min(1, e.st / 500));
        if (e.st > 500) {
          e.state = 'solid';
          e.st = 0;
          burst(e.scene, () => (e.alive && e.state === 'solid' ? { x: e.x, y: e.y } : null), { count: 3, gap: 160, speed: e.bulletSpeed, tex: 'eb_ghost' });
        }
      } else if (e.state === 'solid') {
        if (e.st > 1700) {
          e.state = 'out';
          e.st = 0;
        }
      } else if (e.state === 'out') {
        set(Math.max(0, 1 - e.st / 500));
        if (e.st > 500) {
          e.spot++;
          if (e.spot >= 3) {
            e.leave();
            return true;
          }
          const s = e.params.spots[e.index * 3 + e.spot];
          e.x = s[0];
          e.y = s[1];
          e.state = 'in';
          e.st = 0;
        }
      }
      e.y += Math.sin(e.t * 0.002) * 0.3;
      return true;
    },
  },

  claw: {
    update(e, dt, now, fireZone) {
      if (e.thrown || !fireZone || e.t < e.params.dur * 0.35) return;
      e.thrown = true;
      const chunk = e.scene.add.image(e.x, e.y + 30, 'debris1').setScale(3).setDepth(DEPTH.enemies + 1);
      const a = toPlayer(e);
      e.scene.efire.line(e.x, e.y, e.x + Math.cos(a) * 900, e.y + Math.sin(a) * 900, 520, 0xffa040);
      e.scene.time.delayedCall(520, () => {
        chunk.destroy();
        if (!e.alive) return;
        const b = e.scene.efire.bullet('eb_big', e.x, e.y + 30, toPlayer(e), 260, { scale: 2.4, r: 22 });
        if (b) b.setTint(0xb0b0a0);
      });
    },
  },

  sniper: {
    update(e, dt, now, fireZone) {
      if (!fireZone || !cool(e, 'snipeT', 3600)) return;
      const anchor = () => ({ x: e.x, y: e.y });
      e.scene.efire.beam({ x: e.x, y: e.y, angle: toPlayer(e), width: 14, warn: tele(e) + 800, dur: 120, color: 0xa0ffc0, owner: e, anchor, aim: () => toPlayer(e) });
      e.scene.time.delayedCall(tele(e) + 800, () => {
        if (e.alive) e.recoil = 18;
      });
      e.scene.playSfx('telegraph', e.x);
    },
  },

  // ---------------------------------------------------------------- citadel
  elite: {
    init(e) {
      e.dodge = 0;
      e.dodgeV = 0;
    },
    move(e, dt) {
      // sidestep incoming player shots
      if (!e.dodgeCD || e.dodgeCD <= 0) {
        let threat = 0;
        e.scene.pBullets.forEach((b) => {
          if (threat || b.homing) return;
          if (Math.abs(b.x - e.x) < 46 && b.y > e.y && b.y - e.y < 280 && b.vy < 0) threat = b.x < e.x ? 1 : -1;
        });
        if (threat) {
          e.dodgeV = threat * 620;
          e.dodgeCD = 600;
        }
      } else e.dodgeCD -= dt * 1000;
      e.dodge += e.dodgeV * dt;
      e.dodgeV *= Math.exp(-dt * 6);
      e.dodge *= Math.exp(-dt * 0.6); // drift back to the strafe line
      e.dodge = Phaser.Math.Clamp(e.dodge, -260, 260);
      return false;
    },
    update(e, dt, now, fireZone) {
      // the strafe pattern sets the base position; add the dodge offset on top
      e.x = Phaser.Math.Clamp(e.x + e.dodge, 40, W - 40);
      e.sprite.x = e.x;
      if (fireZone && cool(e, 'burstT', 1800)) burst(e.scene, () => (e.alive ? { x: e.x, y: e.y + 20 } : null), { count: 3, gap: 110, speed: e.bulletSpeed * 1.25, tex: 'eb_gold' });
    },
  },

  shield: {
    update(e) {
      const sc = e.scene;
      if (e.target && (!e.target.alive || e.target.destroyed)) e.target = null;
      if (!e.target && e.onScreen) {
        let best = null;
        let bd = 700;
        for (const o of sc.enemies) {
          if (!o.alive || o === e || o.ground || o.type === 'shielddrone' || o.shieldedBy) continue;
          const d = dist(e, o);
          if (d < bd) {
            bd = d;
            best = o;
          }
        }
        if (best) {
          e.target = best;
          best.shieldedBy = e;
          best.setShielded(true);
          e.custom = true;
        }
      }
      if (e.target) {
        const a = e.t * 0.002;
        e.x += (e.target.x + Math.cos(a) * 110 - e.x) * Math.min(1, sc.dtSec * 3);
        e.y += (e.target.y - 70 + Math.sin(a) * 40 - e.y) * Math.min(1, sc.dtSec * 3);
        sc.fxG.lineStyle(4, 0x80c8ff, 0.5 + 0.3 * Math.sin(e.t * 0.02));
        sc.fxG.lineBetween(e.x, e.y, e.target.x, e.target.y);
      } else if (e.custom) {
        e.y += 160 * sc.dtSec;
      }
    },
    cleanup(e) {
      if (e.target && e.target.alive) {
        e.target.setShielded(false);
        e.target.shieldedBy = null;
      }
    },
  },

  gate: {
    init(e) {
      const w = e.wave;
      w.gate = w.gate || { y: 140 * U, arrived: 0, beam: null, pylons: [] };
      w.gate.pylons[e.index] = e;
      e.side = e.index === 0 ? -1 : 1;
      e.x = e.side < 0 ? -80 : W + 80;
      e.y = w.gate.y;
    },
    move(e, dt) {
      const g = e.wave.gate;
      const p = e.params;
      const tx = e.side < 0 ? p.xL : p.xR;
      if (!e.arrived) {
        e.x += (tx - e.x) * Math.min(1, dt * 2.5);
        if (Math.abs(tx - e.x) < 4) {
          e.arrived = true;
          g.arrived++;
        }
      } else if (g.beamOn) {
        g.y += p.speed * dt;
      }
      e.y = g.y;
      if (g.arrived === 2 && !g.beam && e.index === 0) {
        const [a, b] = g.pylons;
        const owner = { get alive() { return a.alive && b.alive; } };
        g.beamOn = true;
        g.beam = e.scene.efire.beam({
          x: a.x, y: a.y, angle: 0, len: Math.abs(b.x - a.x), width: 26, warn: tele(e) + 300, dur: 30000, color: 0xffd060, owner,
          anchor: () => ({ x: a.x, y: a.y }),
        });
        e.scene.playSfx('telegraph', e.x);
      }
      if (g.beam && g.pylons[0] && g.pylons[1]) g.beam.len = Math.abs(g.pylons[1].x - g.pylons[0].x);
      return true;
    },
  },
};

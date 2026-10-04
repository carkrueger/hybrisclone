// Ambient life: distant traffic convoys, drifting space dust, welding sparks,
// steam/smoke from vents and cooling towers, and maintenance drones.
import Phaser from 'phaser';
import { W, H, DEPTH, SCROLL_SPEED, MEGA_PARALLAX, TILE } from '../config.js';

const ADD = Phaser.BlendModes.ADD;

export class AmbientView {
  constructor(scene, level, station, preset) {
    this.scene = scene;
    this.station = station;
    this.enabled = !!preset.ambient;
    this.objects = [];
    if (!this.enabled) return;
    const amb = level.ambient;
    this.traffic = amb.traffic;
    this.tIdx = 0;
    this.convoys = [];

    this.dustFar = scene.add.tileSprite(0, 0, W, H, 'dust_far').setOrigin(0).setDepth(DEPTH.mid + 0.5).setAlpha(0.5);
    this.objects.push(this.dustFar);
    if (preset.dust) {
      this.dustNear = scene.add.tileSprite(0, 0, W, H, 'dust_near').setOrigin(0).setDepth(DEPTH.fx - 1).setAlpha(0.3).setBlendMode(ADD);
      this.objects.push(this.dustNear);
    }

    this.sparks = scene.add
      .particles(0, 0, 'spark', {
        emitting: false,
        speed: { min: 60, max: 260 },
        angle: { min: 200, max: 340 },
        gravityY: 520,
        lifespan: { min: 200, max: 520 },
        scale: { start: 0.9, end: 0 },
        color: [0xffffff, 0xfff0a0, 0xffa030],
        blendMode: ADD,
      })
      .setDepth(DEPTH.props + 0.5);
    this.objects.push(this.sparks);

    this.smokeBox = scene.add.container(0, 0).setDepth(DEPTH.props + 0.4);
    this.droneBox = scene.add.container(0, 0).setDepth(DEPTH.drones);
    this.objects.push(this.smokeBox, this.droneBox);
    this.smokePool = [];

    const rows = level.backdrop.rows;
    this.drones = amb.drones.map((d) => {
      const x = d.col * TILE + TILE / 2;
      const y = (rows - 1 - d.row) * TILE + TILE / 2;
      const shadow = scene.add.image(x + 10, y + 14, 'mdrone').setTint(0x000000).setAlpha(0.35).setScale(0.9);
      const img = scene.add.image(x, y, 'mdrone');
      const light = scene.add.image(x, y, 'glow').setBlendMode(ADD).setTint(d.path === 'hover' ? 0x40ff80 : 0xff5030).setScale(0.18);
      this.droneBox.add([shadow, img, light]);
      return { ...d, x, y, img, light, shadow };
    });
    this.sparkTimer = 600;
    this.smokeTimer = 0;
  }

  spawnConvoy(c) {
    const s = this.scene;
    const dir = (c.fromLeft ? 0 : Math.PI) + c.angle;
    const vx = Math.cos(dir) * c.speed;
    const vy = Math.sin(dir) * c.speed + SCROLL_SPEED * MEGA_PARALLAX;
    const x0 = c.fromLeft ? -80 : W + 80;
    const y0 = c.y * H;
    const members = [];
    for (let k = 0; k < c.count; k++) {
      const back = k * (c.kind === 'freighter' ? 110 : 60);
      const side = (k % 2 ? 1 : -1) * (k ? 26 : 0);
      const x = x0 - Math.cos(dir) * back - Math.sin(dir) * side;
      const y = y0 - Math.sin(dir) * back + Math.cos(dir) * side;
      const img = s.add.image(x, y, 'traffic_' + c.kind).setDepth(DEPTH.traffic).setTint(0xa8b4cc).setAlpha(0.9);
      img.rotation = Math.atan2(vy, vx) + Math.PI / 2;
      const eng = s.add.image(x, y, 'glow').setDepth(DEPTH.traffic + 0.1).setBlendMode(ADD).setTint(0x80b0ff).setScale(0.22);
      members.push({ img, eng });
    }
    this.convoys.push({ members, vx, vy });
  }

  puff(src, top) {
    let p = this.smokePool.find((o) => !o.active);
    if (!p) {
      p = this.scene.add.image(0, 0, 'smoke');
      this.smokeBox.add(p);
      this.smokePool.push(p);
    }
    p.setActive(true).setVisible(true).setPosition(src.x + (Math.random() - 0.5) * 10, src.y).setScale(src.big ? 0.4 : 0.22).setAlpha(src.big ? 0.5 : 0.35);
    p.setTint(src.hot ? 0xffa060 : 0xb8c0d0);
    p.rotation = Math.random() * 6.28;
    this.scene.tweens.add({
      targets: p,
      scale: src.big ? 1.6 : 0.9,
      alpha: 0,
      x: p.x + (Math.random() - 0.5) * 40,
      y: p.y - (src.big ? 40 : 18),
      rotation: p.rotation + 1,
      duration: src.big ? 2200 : 1300,
      onComplete: () => p.setActive(false).setVisible(false),
    });
  }

  update(scroll, now, dt) {
    if (!this.enabled) return;
    this.dustFar.tilePositionY -= SCROLL_SPEED * 0.4 * dt;
    if (this.dustNear) {
      this.dustNear.tilePositionY -= SCROLL_SPEED * 1.8 * dt;
      this.dustNear.tilePositionX = Math.sin(now * 0.0002) * 40;
    }

    while (this.tIdx < this.traffic.length && this.traffic[this.tIdx].d <= scroll) {
      const c = this.traffic[this.tIdx++];
      if (c.d > scroll - 400) this.spawnConvoy(c); // skip stale convoys after a jump
    }
    for (const c of this.convoys) {
      let alive = false;
      for (const m of c.members) {
        m.img.x += c.vx * dt;
        m.img.y += c.vy * dt;
        const back = 18;
        m.eng.setPosition(m.img.x - Math.sin(m.img.rotation) * back, m.img.y + Math.cos(m.img.rotation) * back);
        m.eng.alpha = 0.6 + Math.random() * 0.4;
        if (m.img.x > -200 && m.img.x < W + 200 && m.img.y > -200 && m.img.y < H + 200) alive = true;
      }
      if (!alive) {
        for (const m of c.members) {
          m.img.destroy();
          m.eng.destroy();
        }
        c.dead = true;
      }
    }
    this.convoys = this.convoys.filter((c) => !c.dead);

    const st = this.station;
    const top = st.topY;
    this.smokeBox.y = top;
    this.droneBox.y = top;
    const visible = (y) => y + top > -60 && y + top < H + 60;

    // drones hover and patrol over the plating
    for (const d of this.drones) {
      const vis = visible(d.y);
      d.img.visible = d.light.visible = d.shadow.visible = vis;
      if (!vis) continue;
      const t = now * 0.001 * d.speed + d.phase;
      let x = d.x;
      let y = d.y;
      if (d.path === 'patrol') x += Math.sin(t) * d.span * TILE * 0.5;
      else if (d.path === 'circle') {
        x += Math.cos(t) * d.span * 20;
        y += Math.sin(t) * d.span * 20;
      } else {
        x += Math.sin(t * 2.1) * 6;
        y += Math.cos(t * 1.7) * 6;
      }
      const bob = 1 + Math.sin(t * 6) * 0.05;
      d.img.setPosition(x, y).setScale(bob).setRotation(t * 3);
      d.shadow.setPosition(x + 12, y + 16);
      d.light.setPosition(x, y);
      d.light.alpha = Math.sin(now * 0.012 + d.phase) > 0.5 ? 1 : 0.15;
    }

    // welding sparks
    this.sparkTimer -= dt * 1000;
    if (this.sparkTimer <= 0 && st.sparkCells.length) {
      this.sparkTimer = 250 + Math.random() * 900;
      const vis = st.sparkCells.filter((c) => visible(c.y));
      if (vis.length) {
        const c = vis[Math.floor(Math.random() * vis.length)];
        this.sparks.explode(6 + Math.floor(Math.random() * 10), c.x + (Math.random() - 0.5) * 30, c.y + top);
        if (this.scene.lightLayer) this.scene.lightLayer.add(c.x, c.y + top, 120, 0xfff0c0, 160, 0.9);
      }
    }
    // steam
    this.smokeTimer -= dt * 1000;
    if (this.smokeTimer <= 0 && st.steam.length) {
      this.smokeTimer = 110;
      const vis = st.steam.filter((c) => visible(c.y));
      if (vis.length) this.puff(vis[Math.floor(Math.random() * vis.length)], top);
    }
  }

  destroy() {
    for (const o of this.objects) o.destroy(true);
    for (const c of this.convoys || []) for (const m of c.members) {
      m.img.destroy();
      m.eng.destroy();
    }
    this.objects = [];
    this.convoys = [];
  }
}

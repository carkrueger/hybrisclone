// Renders a generated sector backdrop: girder parallax layer, station plating
// (dual-grid), raised plateaus, their drop shadows, decorations, big props,
// animated parts (fans, dishes, chase lights) and pulsing lights.
import Phaser from 'phaser';
import { H, U, TILE, DEPTH, MID_PARALLAX } from '../config.js';
import { dualGridTiles } from '../level/dualgrid.js';
import { DECO, LIGHT_TILES } from '../level/tileIds.js';
import { PROP_ANCHORS } from './paint/props.js';

const ADD = Phaser.BlendModes.ADD;

export class StationView {
  constructor(scene, level, preset) {
    this.scene = scene;
    this.preset = preset;
    this.maps = [];
    this.layers = [];
    const Color = Phaser.Display.Color;
    const { base, raised, deco, rows, props = [] } = level.backdrop;
    const topDown = (g) => g.slice().reverse();
    const baseTiles = dualGridTiles(topDown(base));
    const raisedTiles = dualGridTiles(topDown(raised));
    this.rows = rows;
    this.mapHeight = rows * TILE;
    this.midHeight = level.mid.length * TILE;
    const tint = level.tint;
    const h = -TILE / 2;

    this.mid = this.makeLayer(topDown(level.mid), 'midtiles', 0, 0, DEPTH.mid);
    this.mid.setAlpha(0.6).setTint(Color.ValueToColor(tint).darken(40).color);

    const add = (data, set, dx, dy, depth, tintColor, alpha = 1) => {
      const l = this.makeLayer(data, set, dx, dy, depth).setTint(tintColor).setAlpha(alpha);
      l.oy = dy;
      this.layers.push(l);
    };
    if (preset.shadows) add(baseTiles, 'plates', h + 16 * U, h + 22 * U, DEPTH.stationShadow, 0x000000, 0.5);
    add(baseTiles, 'plates', h, h, DEPTH.station, tint);
    if (preset.shadows) add(raisedTiles, 'raised', h + 7 * U, h + 10 * U, DEPTH.raisedShadow, 0x000000, 0.45);
    add(raisedTiles, 'raised', h, h, DEPTH.raised, tint);
    add(topDown(deco), 'deco', 0, 0, DEPTH.deco, Color.ValueToColor(tint).lighten(8).color);

    // containers that move with the station
    this.animBox = scene.add.container(0, 0).setDepth(DEPTH.deco + 0.05);
    this.propShadowBox = scene.add.container(0, 0).setDepth(DEPTH.propShadow);
    this.propBox = scene.add.container(0, 0).setDepth(DEPTH.props);
    this.lightBox = scene.add.container(0, 0).setDepth(DEPTH.lights);
    this.boxes = [this.animBox, this.propShadowBox, this.propBox, this.lightBox];

    const cellY = (r) => (rows - 1 - r) * TILE + TILE / 2; // bottom-up row -> y from map top
    this.lights = [];
    this.spinners = [];
    this.steam = [];
    this.sparkCells = [];
    const glow = (x, y, color, scale, mode, phase, speed = 0.003) => {
      const g = scene.add.image(x, y, 'glow').setBlendMode(ADD).setTint(color).setScale(scale);
      g.mode = mode;
      g.phase = phase;
      g.speed = speed;
      this.lightBox.add(g);
      this.lights.push(g);
      return g;
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < deco[r].length; c++) {
        const d = deco[r][c];
        const x = c * TILE + TILE / 2;
        const y = cellY(r);
        if (preset.lights && LIGHT_TILES[d]) glow(x, y, LIGHT_TILES[d], 0.9, 'pulse', (r * 7 + c * 13) % 17, 0.002 + ((r * 3 + c) % 5) * 0.0007);
        if (d === DECO.FAN) {
          const s = scene.add.image(x, y, 'fan_rotor').setTint(tint);
          s.spin = 4 + ((r + c) % 3) * 2;
          this.animBox.add(s);
          this.spinners.push(s);
        } else if (d === DECO.DISH) {
          const s = scene.add.image(x, y, 'dish_head').setTint(tint);
          s.sweep = 0.6 + ((r * 5 + c) % 4) * 0.25;
          s.phase = r + c;
          this.animBox.add(s);
          this.spinners.push(s);
        } else if (d === DECO.HAZARD && preset.lights) {
          for (const dx of [-16, 16]) glow(x + dx, y - 22, 0xffc040, 0.22, 'chase', (c * 2 + (dx > 0 ? 1 : 0)) * 0.55, 0.009);
        } else if (d === DECO.VENT || d === DECO.VENT_GLOW) {
          this.steam.push({ x, y, row: r, hot: d === DECO.VENT_GLOW });
        } else if (d === DECO.TERMINAL || d === DECO.GREEBLE || d === DECO.CONDUIT) {
          this.sparkCells.push({ x, y, row: r });
        }
      }
    }

    // big props
    for (const p of props) {
      const x0 = p.col * TILE;
      const y0 = (rows - p.row - p.h) * TILE;
      const cx = x0 + (p.w * TILE) / 2;
      const cy = y0 + (p.h * TILE) / 2;
      if (preset.shadows) {
        const sh = scene.add.image(cx + 10 * U, cy + 14 * U, 'prop_' + p.type).setTint(0x000000).setAlpha(0.45);
        this.propShadowBox.add(sh);
      }
      const img = scene.add.image(cx, cy, 'prop_' + p.type).setTint(Color.ValueToColor(tint).lighten(10).color);
      this.propBox.add(img);
      const anchors = PROP_ANCHORS[p.type] || {};
      if (preset.lights) {
        (anchors.glows || []).forEach((a, k) => glow(x0 + a.x, y0 + a.y, a.color, a.scale, a.mode, a.phase ?? k, a.mode === 'pulse' ? 0.004 : 0.005));
      }
      for (const s of anchors.steam || []) this.steam.push({ x: x0 + s.x, y: y0 + s.y, row: p.row, big: true });
    }
  }

  makeLayer(data, tileset, x, y, depth) {
    const map = this.scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const ts = map.addTilesetImage(tileset, tileset, TILE, TILE, 0, 0);
    const layer = map.createLayer(0, ts, x, y).setDepth(depth);
    this.maps.push(map);
    return layer;
  }

  /** current y of the map top on screen */
  get top() {
    return this.topY;
  }

  /** scroll: distance travelled from the bottom of the map */
  update(scroll, now, dt = 0) {
    const top = H + scroll - this.mapHeight;
    this.topY = top;
    for (const l of this.layers) l.y = Math.round(top + l.oy);
    for (const b of this.boxes) b.y = Math.round(top);
    this.mid.y = Math.round(H + scroll * MID_PARALLAX - this.midHeight);
    const vis = (g) => {
      const vy = g.y + top;
      return vy > -120 && vy < H + 120;
    };
    for (const g of this.lights) {
      g.visible = vis(g);
      if (!g.visible) continue;
      if (g.mode === 'chase') g.alpha = Math.max(0, Math.sin(now * g.speed - g.phase)) ** 6;
      else if (g.mode === 'blink') g.alpha = Math.sin(now * g.speed + g.phase) > 0.6 ? 1 : 0.1;
      else g.alpha = 0.45 + 0.55 * Math.max(0, Math.sin(now * g.speed + g.phase));
    }
    if (this.preset.animate) {
      for (const s of this.spinners) {
        if (!vis(s)) continue;
        if (s.spin) s.rotation += s.spin * dt;
        else s.rotation = Math.sin(now * 0.0006 * s.sweep + s.phase) * 1.4;
      }
    }
  }

  /** screen position of a map-space point */
  toScreen(p) {
    return { x: p.x, y: p.y + this.topY };
  }

  setAlpha(a) {
    for (const l of this.layers) l.setAlpha(l.alpha > 0.55 ? a : l.alpha);
  }

  destroy() {
    for (const m of this.maps) m.destroy();
    for (const b of this.boxes) b.destroy(true);
    this.maps = [];
    this.layers = [];
    this.lights = [];
    this.spinners = [];
  }
}

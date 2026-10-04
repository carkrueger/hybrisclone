// Reusable attack building blocks for enemies and bosses (all go through EnemyFire).
export function aimAt(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** n bullets fanned around the aim at the player */
export function aimed(scene, x, y, { n = 1, spread = 0.16, speed = 300, tex, scale = 1 } = {}) {
  const pl = scene.player;
  const a = Math.atan2(pl.y - y, pl.x - x);
  for (let k = 0; k < n; k++) scene.efire.bullet(tex || scene.themeBullet, x, y, a + (k - (n - 1) / 2) * spread, speed, { scale });
}

export function ring(scene, x, y, { n = 8, speed = 220, tex, offset = Math.random() * Math.PI } = {}) {
  for (let k = 0; k < Math.min(n, 12); k++) scene.efire.bullet(tex || scene.themeBullet, x, y, offset + (k / n) * Math.PI * 2, speed);
}

/** repeated aimed shots from a moving source; pos() returns {x, y} or null when dead */
export function burst(scene, pos, { count = 3, gap = 130, ...opts } = {}) {
  for (let k = 0; k < count; k++) {
    scene.time.delayedCall(k * gap, () => {
      const p = pos();
      if (p) aimed(scene, p.x, p.y, opts);
    });
  }
}

export function missiles(scene, x, y, { n = 2, speed = 240, spread = 0.6 } = {}) {
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k - (n - 1) / 2) * spread;
    scene.time.delayedCall(k * 160, () => scene.efire.missile(x, y, a + Math.PI, { speed }));
  }
  scene.playSfx('missile', x);
}

/** grenade that bursts into a small ring (or an acid puddle) where it lands */
export function lobAt(scene, x, y, tx, ty, { flight = 950, burstN = 5, speed = 200, acid = false, cross = false, tex } = {}) {
  scene.efire.lob(x, y, tx, ty, {
    flight,
    color: acid ? 0x90ff50 : 0xff8030,
    tex: acid ? 'eb_acid' : 'eb_big',
    onLand: (lx, ly) => {
      if (acid) scene.efire.hazard({ shape: 'circle', x: lx, y: ly, r: 75, dur: 2600, color: 0x80ff40, sprite: 'acid_pool' });
      if (cross) {
        for (let k = 0; k < 4; k++) scene.efire.bullet(tex || 'eb_big', lx, ly, (k * Math.PI) / 2, speed);
      } else if (burstN) {
        const off = Math.random() * Math.PI;
        for (let k = 0; k < burstN; k++) scene.efire.bullet(tex || scene.themeBullet, lx, ly, off + (k / burstN) * Math.PI * 2, speed);
      }
      scene.playSfx('explodeSmall', lx);
    },
  });
}

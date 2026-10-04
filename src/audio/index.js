// Audio facade used by the scenes. The AudioContext is created lazily on the
// first user gesture (browser autoplay policy); music requested before that is queued.
import { Chip } from './chip.js';
import { Sequencer } from './sequencer.js';
import { composeSong, JINGLES, TITLE_SEED } from './songs.js';
import { SFX, SFX_THROTTLE } from './sfx.js';
import { storage } from '../core/storage.js';

class AudioSystem {
  constructor() {
    this.chip = new Chip();
    this.seq = new Sequencer(this.chip);
    this.pending = null;
    this.songCache = new Map();
    this.lastPlayed = {};
    const s = storage.getSettings();
    this.chip.musicVol = s.music;
    this.chip.sfxVol = s.sfx;
    this.currentKey = null;
  }

  installUnlock() {
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchend', 'mousedown']) {
      window.addEventListener(ev, unlock, { capture: true });
    }
  }

  unlock() {
    const hadCtx = this.chip.ready;
    if (!this.chip.unlock()) return;
    if (!hadCtx && this.pending) {
      const p = this.pending;
      this.pending = null;
      this.seq.play(p.song, p.opts);
    }
  }

  get unlocked() {
    return this.chip.ready;
  }

  setVolumes(music, sfx) {
    this.chip.setVolumes(music, sfx);
    storage.saveSettings({ music, sfx });
  }

  get volumes() {
    return { music: this.chip.musicVol, sfx: this.chip.sfxVol };
  }

  song(seed, style) {
    const key = style + ':' + seed;
    if (!this.songCache.has(key)) this.songCache.set(key, composeSong(seed, style));
    return this.songCache.get(key);
  }

  play(song, key, opts = { loop: true }) {
    if (key && key === this.currentKey && this.seq.song) return;
    this.currentKey = key;
    if (!this.chip.ready) {
      this.pending = { song, opts };
      return;
    }
    this.seq.play(song, opts);
  }

  playTitle() {
    this.play(this.song(TITLE_SEED, 'title'), 'title');
  }

  playSector(seed) {
    this.play(this.song(seed, 'sector'), 'sector:' + seed);
  }

  playBoss(seed) {
    this.play(this.song(seed, 'boss'), 'boss:' + seed);
  }

  playJingle(name, onEnd) {
    this.currentKey = 'jingle:' + name;
    if (!this.chip.ready) {
      if (onEnd) setTimeout(onEnd, 1500);
      return;
    }
    this.seq.play(JINGLES[name](), { loop: false, onEnd });
  }

  stopMusic(fade = 0.08) {
    this.currentKey = null;
    this.pending = null;
    this.seq.stop(fade);
  }

  sfx(name) {
    if (!this.chip.ready || this.chip.ctx.state !== 'running') return;
    const now = performance.now();
    const gap = SFX_THROTTLE[name] || 0;
    if (gap && now - (this.lastPlayed[name] || 0) < gap) return;
    this.lastPlayed[name] = now;
    SFX[name](this.chip, this.chip.now());
  }

  pause() {
    if (this.chip.ctx && this.chip.ctx.state === 'running') {
      this.chip.userSuspended = true;
      this.chip.ctx.suspend();
    }
  }

  resume() {
    this.chip.userSuspended = false;
    if (this.chip.ctx && this.chip.ctx.state === 'suspended') this.chip.ctx.resume();
  }
}

export const audio = new AudioSystem();

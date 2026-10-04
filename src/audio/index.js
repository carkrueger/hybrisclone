// Audio facade used by the scenes.
// Music: songs are composed from seeds (composer/arrange.js) and rendered offline
// section by section (render.js) through a small render queue. A lookahead
// scheduler plays the rendered sections back to back on the live AudioContext,
// looping from the first section after the intro.
// The live AudioContext is created on the first user gesture (autoplay policy).
import { composeSong, JINGLES, TITLE_SEED } from './composer/arrange.js';
import { renderSegment, songSegments } from './render.js';
import { SfxPlayer, SFX_THROTTLE } from './sfx.js';
import { storage } from '../core/storage.js';

const CACHE_MAX = 5;
const MAX_JOBS = 2;
const LOOKAHEAD = 2.5;

class Stream {
  constructor(sys, key, song) {
    this.sys = sys;
    this.key = key;
    this.song = song;
    this.segs = songSegments(song);
    this.buffers = new Array(this.segs.length).fill(null);
    this.jobs = new Array(this.segs.length).fill(null);
    const li = this.segs.findIndex((s) => s.from >= song.introSteps);
    this.loopFrom = song.loopSteps ? li : -1;
  }

  /** queue segment i for rendering; lower priority renders first */
  request(i, priority = 1) {
    if (i < 0 || i >= this.segs.length) return null;
    if (!this.jobs[i]) {
      const seg = this.segs[i];
      this.jobs[i] = this.sys.enqueue(priority, () =>
        renderSegment(this.song, seg.from, seg.to).then((buf) => {
          this.buffers[i] = buf;
          return buf;
        })
      );
    } else this.sys.bump(this.jobs[i], priority);
    return this.jobs[i];
  }

  next(i) {
    if (i + 1 < this.segs.length) return i + 1;
    return this.loopFrom >= 0 ? this.loopFrom : -1;
  }
}

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.streams = new Map();
    this.queue = [];
    this.running = 0;
    this.playing = null;
    this.lastPlayed = {};
    const s = storage.getSettings();
    this.musicVol = s.music;
    this.sfxVol = s.sfx;
    this.timer = setInterval(() => this.tick(), 100);
  }

  // ------------------------------------------------------------ context
  installUnlock() {
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchend', 'mousedown']) window.addEventListener(ev, unlock, { capture: true });
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -6;
      comp.ratio.value = 6;
      this.master.connect(comp).connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.applyVolumes();
      this.sfxPlayer = new SfxPlayer(ctx, this.sfxBus);
    }
    if (this.ctx.state === 'suspended' && !this.userPaused) this.ctx.resume().catch(() => {});
  }

  get unlocked() {
    return !!this.ctx;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicVol * this.musicVol, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.sfxVol * this.sfxVol, t, 0.03);
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
    storage.saveSettings({ music, sfx });
  }

  get volumes() {
    return { music: this.musicVol, sfx: this.sfxVol };
  }

  // ------------------------------------------------------------ render queue
  enqueue(priority, run) {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const job = { priority, run, resolve, reject, promise, seq: (this.seq = (this.seq || 0) + 1) };
    promise.job = job;
    this.queue.push(job);
    this.pump();
    return promise;
  }

  bump(promise, priority) {
    const job = promise.job;
    if (job && priority < job.priority) job.priority = priority;
  }

  pump() {
    while (this.running < MAX_JOBS && this.queue.length) {
      this.queue.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
      const job = this.queue.shift();
      this.running++;
      job
        .run()
        .then(job.resolve, (err) => {
          console.warn('music render failed', err);
          job.resolve(null);
        })
        .finally(() => {
          this.running--;
          this.pump();
        });
    }
  }

  isComposing() {
    const p = this.playing;
    return !!(p && !p.stream.buffers[0]);
  }

  stream(style, seed, hints = null) {
    const key = `${style}:${seed}`;
    let s = this.streams.get(key);
    if (s) {
      this.streams.delete(key);
    } else {
      const song = style === 'jingle' ? JINGLES[seed]() : composeSong(seed, style, hints);
      s = new Stream(this, key, song);
    }
    this.streams.set(key, s); // LRU order
    while (this.streams.size > CACHE_MAX) {
      const oldest = this.streams.keys().next().value;
      if (this.playing && this.playing.stream.key === oldest) break;
      this.streams.delete(oldest);
    }
    return s;
  }

  /** start rendering the first sections in the background */
  prepare(style, seed, hints = null) {
    const s = this.stream(style, seed, hints);
    s.request(0, 3);
    s.request(1, 4);
    return s;
  }

  prepareTitle() {
    this.prepare('title', TITLE_SEED);
  }

  prepareBoss(seed, hints = null) {
    this.prepare('boss', seed, hints);
  }

  // ------------------------------------------------------------ playback
  play(stream, { loop = true, onEnd = null, fade = 1.0 } = {}) {
    if (this.playing && this.playing.stream === stream && loop) return;
    this.stopCurrent(0.6);
    stream.request(0, 0);
    stream.request(1, 1);
    this.playing = { stream, loop, onEnd, fade, index: 0, nextTime: 0, started: false, sources: [], gain: null };
    this.tick();
  }

  tick() {
    const p = this.playing;
    const ctx = this.ctx;
    if (!p || !ctx || ctx.state !== 'running') return;
    const st = p.stream;
    if (!p.gain) {
      p.gain = ctx.createGain();
      p.gain.gain.value = 0;
      p.gain.connect(this.musicBus);
    }
    let guard = 0;
    while (guard++ < 8) {
      if (p.index < 0) {
        if (!p.endNotified && p.onEnd && ctx.currentTime > p.nextTime) {
          p.endNotified = true;
          p.onEnd();
        }
        return;
      }
      const buf = st.buffers[p.index];
      if (!buf) {
        st.request(p.index, 0);
        if (p.nextTime < ctx.currentTime + 0.05) p.nextTime = ctx.currentTime + 0.05; // stall until rendered
        return;
      }
      if (p.nextTime > ctx.currentTime + LOOKAHEAD) return;
      const t = Math.max(p.nextTime, ctx.currentTime + 0.02);
      if (!p.started) {
        p.started = true;
        p.gain.gain.setValueAtTime(0, t);
        p.gain.gain.linearRampToValueAtTime(1, t + p.fade);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(p.gain);
      src.start(t);
      p.sources.push(src);
      src.onended = () => {
        const i = p.sources.indexOf(src);
        if (i >= 0) p.sources.splice(i, 1);
      };
      p.nextTime = t + st.segs[p.index].dur;
      p.index = p.loop ? st.next(p.index) : p.index + 1 < st.segs.length ? p.index + 1 : -1;
      // prefetch what comes next
      if (p.index >= 0) {
        st.request(p.index, 1);
        st.request(st.next(p.index), 2);
      }
    }
  }

  stopCurrent(fade = 0.5) {
    const p = this.playing;
    this.playing = null;
    if (!p || !this.ctx || !p.gain) return;
    const t = this.ctx.currentTime;
    const g = p.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + fade);
    for (const s of p.sources) {
      try {
        s.stop(t + fade + 0.05);
      } catch {
        // not started yet / already stopped
      }
    }
    setTimeout(() => p.gain.disconnect(), (fade + 0.5) * 1000);
  }

  playTitle() {
    this.play(this.stream('title', TITLE_SEED));
  }

  playSector(seed, hints = null) {
    this.play(this.stream('sector', seed, hints));
  }

  playBoss(seed, hints = null) {
    this.play(this.stream('boss', seed, hints), { fade: 0.2 });
  }

  playJingle(name, onEnd) {
    this.play(this.stream('jingle', name), { loop: false, onEnd, fade: 0.01 });
  }

  stopMusic(fade = 0.4) {
    this.stopCurrent(fade);
  }

  // ------------------------------------------------------------ sfx
  sfx(name, pan = 0) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.sfxPlayer) return;
    const now = performance.now();
    const gap = SFX_THROTTLE[name] || 0;
    if (gap && now - (this.lastPlayed[name] || 0) < gap) return;
    this.lastPlayed[name] = now;
    this.sfxPlayer.play(name, pan);
  }

  pause() {
    if (this.ctx && this.ctx.state === 'running') {
      this.userPaused = true;
      this.ctx.suspend();
    }
  }

  resume() {
    this.userPaused = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
}

export const audio = new AudioSystem();

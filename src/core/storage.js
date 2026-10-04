// localStorage wrapper. Every access is guarded: storage may be unavailable.
const PREFIX = 'hybrisclone.';

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore: private mode / quota / disabled storage
  }
}

const DEFAULT_SCORES = [
  { name: 'AMIGA', score: 50000, sector: 4, seed: 'HYBRIS' },
  { name: 'PAULA', score: 40000, sector: 3, seed: 'HYBRIS' },
  { name: 'DENISE', score: 30000, sector: 3, seed: 'HYBRIS' },
  { name: 'AGNUS', score: 20000, sector: 2, seed: 'HYBRIS' },
  { name: 'GARY', score: 15000, sector: 2, seed: 'HYBRIS' },
  { name: 'BLITTER', score: 10000, sector: 1, seed: 'HYBRIS' },
  { name: 'COPPER', score: 7500, sector: 1, seed: 'HYBRIS' },
  { name: 'MC68000', score: 5000, sector: 1, seed: 'HYBRIS' },
  { name: 'KICK13', score: 2500, sector: 1, seed: 'HYBRIS' },
  { name: 'A500', score: 1000, sector: 1, seed: 'HYBRIS' },
];

export const storage = {
  getHighScores() {
    const s = read('highscores', null);
    return Array.isArray(s) && s.length ? s : DEFAULT_SCORES.map((e) => ({ ...e }));
  },
  isHighScore(score) {
    const list = this.getHighScores();
    return list.length < 10 || score > list[list.length - 1].score;
  },
  addHighScore(entry) {
    const list = this.getHighScores();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, 10);
    write('highscores', trimmed);
    return trimmed.indexOf(entry);
  },
  getSettings() {
    return { music: 0.6, sfx: 0.7, ...read('settings', {}) };
  },
  saveSettings(settings) {
    write('settings', { ...read('settings', {}), ...settings });
  },
  getLastSeed() {
    return read('lastSeed', 'HYBRIS');
  },
  setLastSeed(seed) {
    write('lastSeed', seed);
  },
  getLastName() {
    return read('lastName', '');
  },
  setLastName(name) {
    write('lastName', name);
  },
};

// Visual settings (quality preset + CRT overlay), persisted with the other settings.
import { QUALITY } from '../config.js';
import { storage } from './storage.js';

const ORDER = ['low', 'medium', 'high'];

export const settings = {
  get quality() {
    const q = storage.getSettings().quality;
    return ORDER.includes(q) ? q : 'high';
  },
  set quality(q) {
    storage.saveSettings({ ...storage.getSettings(), quality: q });
  },
  get crt() {
    return !!storage.getSettings().crt;
  },
  set crt(v) {
    storage.saveSettings({ ...storage.getSettings(), crt: !!v });
  },
  get preset() {
    return QUALITY[this.quality];
  },
  cycleQuality(d) {
    const i = ORDER.indexOf(this.quality);
    this.quality = ORDER[(i + d + ORDER.length) % ORDER.length];
  },
};

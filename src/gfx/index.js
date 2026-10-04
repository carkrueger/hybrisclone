// Builds every shared texture in code at boot: no image files are shipped.
import { paintShips } from './paint/ships.js';
import { paintFx } from './paint/fxTextures.js';
import { paintStation } from './paint/station.js';
import { paintProps } from './paint/props.js';
import { paintAmbient } from './paint/ambient.js';
import { paintStars, paintNebula, paintPlanet } from './paint/space.js';

export function makeAllTextures(scene) {
  paintShips(scene);
  paintFx(scene);
  paintStation(scene);
  paintProps(scene);
  paintAmbient(scene);
  paintStars(scene, 'stars_far', 1001, 900, { bright: 0.65, big: 0.01 });
  paintStars(scene, 'stars_near', 1002, 220, { bright: 1, big: 0.12 });
  // title-screen backdrop
  paintNebula(scene, 'nebula_title', 77);
  paintPlanet(scene, 'planet_title', 4242);
}

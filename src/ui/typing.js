// Text entry (seed / name) listens to native keydown events: each physical key
// press arrives exactly once, even when several keys land in the same frame.
export function onTypedKey(scene, handler) {
  const fn = (ev) => {
    if (!scene.sys.isActive()) return;
    handler(ev);
  };
  window.addEventListener('keydown', fn);
  scene.events.once('shutdown', () => window.removeEventListener('keydown', fn));
}

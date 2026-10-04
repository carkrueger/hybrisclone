// Unified input: keyboard, mouse/touch and gamepad mapped onto one set of actions.
// The device that was used last decides how the ship moves (digital/analog vs. follow-pointer).

const DEADZONE = 0.22;
const MENU_STICK = 0.5;
const REPEAT_DELAY = 320;
const REPEAT_RATE = 85;

const ACTIONS = ['fire', 'bomb', 'pause', 'confirm', 'back', 'up', 'down', 'left', 'right'];

export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.device = 'keyboard';
    // while typing (seed / name entry) letter keys must not trigger actions
    this.typing = false;
    this.moveX = 0;
    this.moveY = 0;
    this.pointerTarget = null;
    this.cur = {};
    this.prev = {};
    this.holdTime = {};
    this.repeatFlag = {};
    for (const a of ACTIONS) {
      this.cur[a] = false;
      this.prev[a] = false;
      this.holdTime[a] = 0;
    }

    const raw = scene.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,Z,X,C,SHIFT,ENTER,ESC,P,CTRL');
    // keys tapped since the last update count as down for one frame, so sub-frame taps are never lost
    this.tapped = new Set();
    this._onKeyDown = (ev) => this.tapped.add(ev.keyCode);
    scene.input.keyboard.on('keydown', this._onKeyDown);
    this.keys = {};
    for (const [name, key] of Object.entries(raw)) {
      this.keys[name] = { get isDown() { return key.isDown || this._tapped.has(key.keyCode); }, _tapped: this.tapped };
    }

    this.pointerMoved = false;
    this.pointerBomb = false;
    scene.input.mouse?.disableContextMenu();
    this._onMove = (p) => {
      if (Math.abs(p.velocity.x) + Math.abs(p.velocity.y) > 0.5 || p.isDown) this.pointerMoved = true;
    };
    this._onDown = (p) => {
      this.pointerMoved = true;
      if (p.rightButtonDown()) this.pointerBomb = true;
    };
    scene.input.on('pointermove', this._onMove);
    scene.input.on('pointerdown', this._onDown);
    scene.events.once('shutdown', () => this.destroy());
  }

  destroy() {
    this.scene.input.off('pointermove', this._onMove);
    this.scene.input.off('pointerdown', this._onDown);
    this.scene.input.keyboard.off('keydown', this._onKeyDown);
  }

  getPad() {
    const gp = this.scene.input.gamepad;
    if (!gp || gp.total === 0) return null;
    return gp.getAll().find((p) => p && p.connected) || null;
  }

  update(delta) {
    const k = this.keys;
    const pad = this.getPad();
    const p = this.scene.input.activePointer;
    const L = !this.typing; // letter keys enabled

    // --- keyboard ---
    const kUp = k.UP.isDown || (L && k.W.isDown);
    const kDown = k.DOWN.isDown || (L && k.S.isDown);
    const kLeft = k.LEFT.isDown || (L && k.A.isDown);
    const kRight = k.RIGHT.isDown || (L && k.D.isDown);
    const kx = (kRight ? 1 : 0) - (kLeft ? 1 : 0);
    const ky = (kDown ? 1 : 0) - (kUp ? 1 : 0);

    // --- gamepad ---
    let gx = 0;
    let gy = 0;
    let padFire = false;
    let padBomb = false;
    let padPause = false;
    let padConfirm = false;
    let padBack = false;
    let padUp = false;
    let padDown = false;
    let padLeft = false;
    let padRight = false;
    if (pad) {
      const sx = pad.leftStick.x;
      const sy = pad.leftStick.y;
      const mag = Math.hypot(sx, sy);
      if (mag > DEADZONE) {
        const scaled = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE));
        gx = (sx / mag) * scaled;
        gy = (sy / mag) * scaled;
      }
      if (pad.left) gx = -1;
      if (pad.right) gx = 1;
      if (pad.up) gy = -1;
      if (pad.down) gy = 1;
      const btn = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      padFire = btn(0) || btn(5) || btn(7) || btn(2);
      padBomb = btn(1) || btn(4) || btn(6) || btn(3);
      padPause = btn(9) || btn(8);
      padConfirm = btn(0) || btn(9);
      padBack = btn(1);
      padUp = pad.up || sy < -MENU_STICK;
      padDown = pad.down || sy > MENU_STICK;
      padLeft = pad.left || sx < -MENU_STICK;
      padRight = pad.right || sx > MENU_STICK;
      if (gx || gy || padFire || padBomb || padPause) this.device = 'gamepad';
    }

    if (kx || ky) this.device = 'keyboard';

    // --- pointer ---
    const pointerDown = p.isDown && !p.rightButtonDown();
    if (this.pointerMoved) {
      this.device = 'mouse';
      this.pointerMoved = false;
    }
    this.pointerTarget = this.device === 'mouse' ? { x: p.worldX, y: p.worldY } : null;

    // combined movement vector for keyboard/pad
    let mx = kx || gx;
    let my = ky || gy;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    this.moveX = mx;
    this.moveY = my;

    // --- actions ---
    const kFire = (L && (k.SPACE.isDown || k.Z.isDown)) || k.CTRL.isDown;
    const kBomb = (L && (k.X.isDown || k.C.isDown)) || k.SHIFT.isDown;
    const now = {
      fire: kFire || padFire || pointerDown,
      bomb: kBomb || padBomb || this.pointerBomb,
      pause: k.ESC.isDown || (L && k.P.isDown) || padPause,
      confirm: k.ENTER.isDown || (L && (k.SPACE.isDown || k.Z.isDown)) || padConfirm,
      back: k.ESC.isDown || padBack,
      up: kUp || padUp,
      down: kDown || padDown,
      left: kLeft || padLeft,
      right: kRight || padRight,
    };
    this.pointerBomb = false;
    this.tapped.clear();

    for (const a of ACTIONS) {
      this.prev[a] = this.cur[a];
      this.cur[a] = !!now[a];
      this.repeatFlag[a] = false;
      if (this.cur[a]) {
        const before = this.holdTime[a];
        this.holdTime[a] += delta;
        if (before < REPEAT_DELAY && this.holdTime[a] >= REPEAT_DELAY) this.repeatFlag[a] = true;
        else if (before >= REPEAT_DELAY) {
          const n0 = Math.floor((before - REPEAT_DELAY) / REPEAT_RATE);
          const n1 = Math.floor((this.holdTime[a] - REPEAT_DELAY) / REPEAT_RATE);
          if (n1 > n0) this.repeatFlag[a] = true;
        }
      } else {
        this.holdTime[a] = 0;
      }
    }
  }

  held(action) {
    return this.cur[action];
  }

  pressed(action) {
    return this.cur[action] && !this.prev[action];
  }

  /** pressed, or auto-repeating while held (for menus) */
  repeat(action) {
    return this.pressed(action) || this.repeatFlag[action];
  }

  /** Swallow currently-held buttons so they don't trigger again in a new scene. */
  latch() {
    for (const a of ACTIONS) this.prev[a] = this.cur[a] = true;
  }
}

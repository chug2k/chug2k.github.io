(() => {
  // source/public/minigames/lib/progress.js
  var NAMESPACE = "fikaride.exercise-proto.v1";
  var keyOf = (profile, name) => `${NAMESPACE}.${profile}.${name}`;
  var memory = /* @__PURE__ */ new Map();
  var locked = false;
  var volatile = false;
  try {
    volatile = new URLSearchParams(globalThis.location?.search || "").get("nosave") === "1";
  } catch {
  }
  function loadState(profile, name) {
    if (locked) return null;
    const key = keyOf(profile, name);
    if (volatile) return memory.has(key) ? structuredClone(memory.get(key)) : null;
    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (raw) {
        const v = JSON.parse(raw);
        return v && typeof v === "object" ? v : null;
      }
    } catch {
    }
    return memory.has(key) ? structuredClone(memory.get(key)) : null;
  }
  function saveState(profile, name, data) {
    if (locked) return false;
    const key = keyOf(profile, name);
    memory.set(key, structuredClone(data));
    if (volatile) return false;
    try {
      globalThis.localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  // source/public/minigames/lib/ride.js
  var MAX_SAMPLE_GAP = 5;
  var EnergyMeter = class {
    constructor() {
      this.joules = 0;
      this.seconds = 0;
      this.restart();
    }
    /** Forget the previous sample (new source, new session). Totals stay. */
    restart() {
      this.lastSeq = -1;
      this.lastT = null;
      this.source = void 0;
    }
    /** Feed the power view of this step. Returns the joules that this step added. */
    update(view, t) {
      if (!view || !view.fresh) return 0;
      if (view.source !== this.source) {
        this.restart();
        this.source = view.source;
      }
      if (view.seq === this.lastSeq) return 0;
      const at = t - view.age, before = this.lastT;
      this.lastSeq = view.seq;
      this.lastT = at;
      if (before === null) return 0;
      const gap = at - before;
      if (!(gap > 0) || gap > MAX_SAMPLE_GAP) return 0;
      const added = Math.max(0, view.value) * gap;
      this.joules += added;
      if (view.value > 0) this.seconds += gap;
      return added;
    }
  };
  var RESUME_MS = 20 * 60 * 1e3;

  // source/public/minigames/lib/util.js
  var TAU = Math.PI * 2;
  var clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  var follow = (current, target, tau, dt) => tau <= 0 ? target : target + (current - target) * Math.exp(-dt / tau);
  function rng(seed = 1) {
    let a = seed >>> 0;
    const next = () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + (hi - lo) * next();
    next.pick = (list) => list[Math.floor(next() * list.length)];
    next.gauss = () => (next() + next() + next() + next() - 2) * 1.732;
    return next;
  }
  var formatClock = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  // source/public/minigames/games/pocket-life.js
  var HOUR = 36e5;
  var DAY = 24 * HOUR;
  var HATCH = 10;
  var FLEDGE = 480;
  var ADULT = 2700;
  var ASK = 6;
  var FINISH = 13;
  var RITUALS = ["food", "wash", "play", "nest"];
  var GIFTS = {
    food: ["berry", "biscuit", "pear"],
    wash: ["bubbles", "rain"],
    play: ["ball", "kite"],
    nest: ["blanket", "pillow"]
  };
  var FORMS = ["Moon moth", "Clover moth", "Comet moth"];
  var NAMES = ["Mallow", "Clover", "Crumpet", "Bramble", "Pudding", "Cocoa", "Peanut", "Fig", "Bean", "Pebble", "Miso", "Waffle"];
  var limit = (value, max, fallback = 0) => Number.isFinite(value) ? clamp(value, 0, max) : fallback;
  function genes(seed) {
    const r = rng(seed ^ 128006357);
    const sample2 = (count) => Math.floor(r() * count);
    return { name: r.pick(NAMES), cheeks: sample2(3), tuft: sample2(3), wide: sample2(3), fleck: sample2(4), phase: sample2(60) };
  }
  function newPet(seed, now) {
    return {
      kind: "pocket-moth",
      version: 1,
      seed: seed >>> 0,
      seconds: 0,
      days: 0,
      day: -1,
      daySeconds: 0,
      foodUntil: now + 72 * HOUR,
      companyUntil: now + 96 * HOUR,
      pace: 0,
      lively: 0,
      form: "",
      completed: 0,
      ritual: "",
      item: "",
      work: 0,
      delay: 4,
      lastRitual: ""
    };
  }
  function restorePet(saved, seed, now) {
    if (saved?.kind !== "pocket-moth" || saved.version !== 1 || !Number.isInteger(saved.seed)) return newPet(seed, now);
    const p = newPet(saved.seed, now);
    p.seconds = limit(saved.seconds, 1e10);
    p.lively = limit(saved.lively, p.seconds);
    p.pace = limit(saved.pace, 5e3);
    p.days = Math.floor(limit(saved.days, 1e6));
    p.day = Number.isInteger(saved.day) ? saved.day : -1;
    p.daySeconds = limit(saved.daySeconds, 30);
    p.foodUntil = limit(saved.foodUntil, now + 72 * HOUR, p.foodUntil);
    p.companyUntil = limit(saved.companyUntil, now + 96 * HOUR, p.companyUntil);
    p.form = FORMS.includes(saved.form) ? saved.form : "";
    p.completed = Math.floor(limit(saved.completed, 1e9));
    p.ritual = RITUALS.includes(saved.ritual) ? saved.ritual : "";
    p.item = GIFTS[p.ritual]?.includes(saved.item) ? saved.item : GIFTS[p.ritual]?.[0] || "";
    p.lastRitual = RITUALS.includes(saved.lastRitual) ? saved.lastRitual : "";
    p.work = p.ritual ? limit(saved.work, FINISH) : 0;
    p.delay = p.ritual ? 0 : limit(saved.delay, 120, 4);
    return p;
  }
  function newRide() {
    return { moving: false, continuous: 0, high: 0, armed: true, bounce: 0, reunion: 0 };
  }
  function stage(p) {
    if (p.seconds < HATCH) return "Egg";
    return p.form || (p.seconds < FLEDGE ? "Hatchling" : "Fledgling");
  }
  function needs(p, now) {
    return {
      food: clamp((p.foodUntil - now) / (48 * HOUR), 0, 1),
      company: clamp((p.companyUntil - now) / (66 * HOUR), 0, 1)
    };
  }
  function request(p, kind) {
    const r = rng(p.seed ^ Math.imul(p.completed + 1, 569420461));
    const step = 1 + 2 * (p.seed >>> 5 & 1);
    const next = RITUALS[(p.completed * step + (p.seed & 3)) % 4];
    p.ritual = kind || (p.completed === 0 ? "food" : next === p.lastRitual ? RITUALS[(RITUALS.indexOf(next) + 1) % 4] : next);
    p.item = r.pick(GIFTS[p.ritual]);
    p.work = 0;
    p.delay = 0;
  }
  function tend(p, dt) {
    if (p.delay > 0) {
      const quiet = Math.min(p.delay, dt);
      p.delay -= quiet;
      dt -= quiet;
    }
    if (dt <= 0) return "";
    if (!p.ritual) request(p);
    const before = p.work;
    p.work += dt;
    if (p.work < FINISH) return before < ASK && p.work >= ASK ? p.ritual : "";
    p.completed++;
    p.lastRitual = p.ritual;
    p.delay = 40 + ((p.seed ^ Math.imul(p.completed, 73244475)) >>> 0) % 43 - (p.work - FINISH);
    p.ritual = "";
    p.item = "";
    p.work = 0;
    return "thanks";
  }
  function recordDay(p, dt, now) {
    const date = new Date(now);
    const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY;
    if (today > p.day) {
      p.day = today;
      p.daySeconds = 0;
    }
    if (today !== p.day || p.daySeconds >= 30) return;
    p.daySeconds = Math.min(30, p.daySeconds + dt);
    if (p.daySeconds === 30) p.days++;
  }
  function pedal(p, ride, dt, watts2, now) {
    if (!(dt > 0 && dt <= MAX_SAMPLE_GAP && watts2 > 0) || !Number.isFinite(watts2)) return "";
    const oldStage = stage(p);
    if (!ride.moving && p.seconds >= HATCH && needs(p, now).food < 0.28) {
      ride.reunion = 5;
      if (p.ritual !== "food") request(p, "food");
    }
    ride.moving = true;
    ride.continuous += dt;
    ride.reunion = Math.max(0, ride.reunion - dt);
    ride.bounce = Math.max(0, ride.bounce - dt);
    const base = p.pace || watts2, ratio = watts2 / base;
    if (ratio >= 1.4) {
      ride.high += dt;
      if (ride.armed && ride.high >= 1.4) {
        ride.bounce = 12;
        ride.armed = false;
      }
    } else {
      ride.high = 0;
      if (ratio < 1.15) ride.armed = true;
    }
    p.pace = follow(base, watts2, 52, dt);
    if (ride.bounce > 0) p.lively += dt;
    const awakeTime = Math.min(dt, Math.max(0, p.seconds + dt - HATCH));
    p.seconds += dt;
    recordDay(p, dt, now);
    p.foodUntil = Math.min(now + 72 * HOUR, Math.max(now, p.foodUntil) + dt * 72 * HOUR / 125);
    p.companyUntil = Math.min(now + 96 * HOUR, Math.max(now, p.companyUntil) + dt * 96 * HOUR / 95);
    if (!p.form && p.days >= 3 && p.seconds >= ADULT) {
      const energy = p.lively / p.seconds;
      p.form = energy < 0.055 ? FORMS[0] : energy < 0.2 ? FORMS[1] : FORMS[2];
    }
    const action = tend(p, awakeTime);
    return stage(p) !== oldStage ? "grow" : action;
  }
  var WANTS = { food: "is looking for a bite.", wash: "has a smudge on its cheek.", play: "wants to play catch.", nest: "is gathering up the bedding." };
  var ACTIONS = {
    berry: "takes tiny bites of a berry.",
    biscuit: "hugs a biscuit between bites.",
    pear: "nibbles a slice of pear.",
    bubbles: "disappears in the bath bubbles.",
    rain: "wiggles under a little shower.",
    ball: "bats a ball into the air.",
    kite: "chases a paper kite.",
    blanket: "pulls up a corner of the blanket.",
    pillow: "fluffs the pillow with both feet."
  };
  function observe(p, ride, now, identity = genes(p.seed)) {
    const life = stage(p), levels = needs(p, now), name = identity.name;
    let mode, caption;
    if (life === "Egg") {
      mode = "egg";
      caption = ride.moving ? "A little face peeks through the crack." : "Pedal to warm the egg.";
    } else if (!ride.moving) {
      if (levels.company < 0.16) {
        mode = "sleep";
        caption = name + " is asleep under the blanket.";
      } else if (levels.food < 0.5) {
        mode = "hungry";
        caption = name + " is waiting beside the empty bowl.";
      } else {
        mode = "idle";
        caption = name + " blinks up at you.";
      }
    } else if (ride.reunion > 0) {
      mode = "hello";
      caption = name + " peeks out to say hello.";
    } else if (p.seconds < HATCH + 4) {
      mode = "hatch";
      caption = name + " is out of the shell!";
    } else if (p.ritual) {
      mode = p.work < ASK ? "wish" : p.ritual;
      caption = name + " " + (mode === "wish" ? WANTS[p.ritual] : ACTIONS[p.item]);
    } else if (ride.bounce > 0) {
      mode = "flip";
      caption = name + " turns a somersault.";
    } else if (ride.continuous >= 25) {
      mode = "hum";
      caption = name + " hums along with your pedaling.";
    } else {
      mode = "walk";
      caption = name + " toddles along with you.";
    }
    return {
      ...levels,
      name,
      life,
      mode,
      caption,
      form: p.form,
      ritual: p.ritual,
      item: p.item,
      seconds: p.seconds,
      days: p.days,
      completed: p.completed,
      warmth: Math.min(1, p.seconds / HATCH)
    };
  }

  // source/public/minigames/lib/synth.js
  var ready = (bus, t) => {
    if (!bus?.ready) return null;
    const when = bus.at(t);
    return when === null ? null : when;
  };
  function bellTone(bus, t, freq, { gain = 0.07, decay = 3, pan = 0 } = {}) {
    const when = ready(bus, t);
    if (when === null) return;
    const ctx = bus.ctx, out = ctx.createGain();
    out.gain.value = gain;
    const p = ctx.createStereoPanner?.();
    if (p) {
      p.pan.value = pan;
      out.connect(p);
      p.connect(bus.out);
    } else out.connect(bus.out);
    for (const [ratio, amp, d] of [[0.5, 0.4, 1], [1, 1, 0.8], [1.19, 0.5, 0.6], [1.5, 0.25, 0.45], [2, 0.35, 0.35], [2.74, 0.15, 0.2]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq * ratio;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(amp, when + 4e-3);
      g.gain.exponentialRampToValueAtTime(1e-4, when + decay * d);
      o.connect(g);
      g.connect(out);
      o.start(when);
      o.stop(when + decay * d + 0.05);
    }
  }

  // source/public/minigames/games/pocket-screen.js
  var INK = "#26372a";
  var MID = "#506249";
  var PALE = "#a6ac87";
  var FAINT = "rgba(52,70,48,.34)";
  var HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];
  var TWINKLE = ["..#..", "..#..", "##.##", "..#..", "..#.."];
  function makeScreen(canvas, identity, reducedMotion) {
    const ctx = canvas.getContext("2d");
    const { cheeks, tuft, wide, fleck, phase } = identity;
    let lastFrame = "";
    function box(x, y, w, h, ink = INK) {
      ctx.fillStyle = ink;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    }
    function stamp(pattern, x, y, ink = INK) {
      pattern.forEach((line, row) => {
        for (let i = 0; i < line.length; i++) if (line[i] !== ".") box(x + i, y + row, 1, 1, ink);
      });
    }
    function oval(x, y, rx, ry, ink = INK) {
      for (let dy = -ry; dy <= ry; dy++) {
        const half = Math.round(rx * Math.sqrt(1 - (dy / (ry + 0.35)) ** 2));
        box(x - half, y + dy, half * 2 + 1, 1, ink);
      }
    }
    function sprig(x, y, tall) {
      box(x, y - tall, 1, tall, MID);
      box(x - 3, y - tall + 1, 3, 2, MID);
      box(x + 1, y - tall - 1, 3, 2, MID);
    }
    function scene(frame) {
      stamp(["..###..", ".###...", "###....", "###....", ".###..#", "..####.", "...##.."], 8, 5, MID);
      for (const [x, y] of [[23, 14], [35, 7], [63, 10], [75, 20], [87, 8], [8, 31], [66, 25]]) box(x, y, 1, 1, MID);
      stamp(TWINKLE, 77, 3, frame % 12 < 8 ? MID : FAINT);
      box(2, 56, 92, 1, MID);
      for (const [x, w] of [[6, 4], [14, 2], [21, 5], [51, 4], [63, 2], [82, 6]]) box(x, 59 + x % 3, w, 1, FAINT);
      sprig(8, 56, 5);
      sprig(13, 56, 3);
      sprig(87, 56, 6);
      sprig(83, 56, 3);
      box(3, 54, 2, 2, MID);
      box(90, 54, 2, 2, MID);
    }
    function egg(frame, warmth, moving) {
      const sway = moving && frame % 6 < 2 ? 1 : 0;
      const x = 47 + sway, y = 53;
      oval(47, 54, 17, 2, FAINT);
      const rows = [3, 6, 8, 10, 11, 12, 13, 13, 14, 14, 14, 14, 14, 13, 12, 11, 8, 4];
      rows.forEach((width, i) => {
        const yy = y - (rows.length - i) * 2;
        box(x - width, yy, width * 2 + 1, 2);
        if (i > 0 && i < rows.length - 1) box(x - width + 2, yy, width * 2 - 3, 2, PALE);
      });
      box(x - 8, y - 25, 2, 6, "#c0c4a1");
      box(x - 6, y - 29, 2, 4, "#c0c4a1");
      const spots = [[-6, -12, 3], [4, -8, 2], [7, -21, 2], [-2, -29, 2]];
      spots.forEach(([dx, dy, w], index) => {
        if (index !== fleck) box(x + dx, y + dy, w, 2, MID);
      });
      if (warmth > 0.19) {
        const crack = [[1, -34], [0, -32], [-2, -30], [0, -28], [2, -26], [0, -24], [-2, -22], [-3, -20], [-1, -18]];
        crack.slice(0, Math.ceil(warmth * crack.length)).forEach(([dx, dy]) => box(x + dx, y + dy, 3, 2));
      }
    }
    function wings(x, y, grown, form, lift) {
      const radius = form ? 11 : grown ? 8 : 4, height = form ? 10 : grown ? 7 : 4;
      for (const side of [-1, 1]) {
        const wx = x + side * (10 + radius / 2), wy = y - 3 - lift;
        oval(wx, wy, radius, height);
        oval(wx, wy, radius - 2, height - 2, MID);
        box(wx - 1, wy - 2, form === "Comet moth" ? 5 : 2, form === "Clover moth" ? 5 : 3, PALE);
        if (form) oval(wx - side * 2, wy + 8, 5, 4, MID);
      }
    }
    function pet(frame, state) {
      const { mode, life, form } = state;
      const asleep = mode === "sleep", hop = ["flip", "play", "hatch"].includes(mode);
      const moving = !["sleep", "idle", "hungry"].includes(mode);
      const bob = reducedMotion || !moving ? 0 : hop ? [0, 2, 4, 5, 4, 2][frame % 6] : frame % 6 < 2 ? 1 : 0;
      const x = 46 + (mode === "walk" && !reducedMotion ? [0, 1, 2, 1, 0, -1, -2, -1][frame % 8] : 0);
      const y = 43 - bob, width = 12 + wide, grown = life !== "Hatchling";
      oval(x, 54, 17, 2, FAINT);
      wings(x, y, grown, form, frame % 4 < 2 && moving ? 1 : 0);
      oval(x, y, width, asleep ? 8 : 10);
      oval(x, y - 1, width - 2, asleep ? 6 : 8, PALE);
      for (const side of [-1, 1]) {
        box(x + side * 5, y - 13, 2, 4);
        box(x + side * 7, y - 15, 3, 2);
        box(x + side * 8, y - 16, 2, 2);
        box(x + side * 7 - 1, y + (asleep ? 7 : 9), 5, 2);
      }
      box(x - 2 + tuft, y - 10, 3, 2, PALE);
      const blink = asleep || !reducedMotion && (frame + phase) % 36 === 0;
      for (const side of [-1, 1]) {
        box(x + side * 5 - 1, y - (blink ? 1 : 3), 3, blink ? 1 : 4);
        if (!blink) box(x + side * 5 - 1, y - 3, 1, 1, "#c9cdae");
        box(x + side * (8 + cheeks % 2) - 1, y + 2, 2 + (cheeks === 2 ? 1 : 0), 1, MID);
      }
      if (mode === "food" || mode === "hum") oval(x, y + 2, 1, 1);
      else {
        box(x - 2, y + 1, 1, 1);
        box(x - 1, y + 2, 3, 1);
        box(x + 2, y + 1, 1, 1);
      }
      if (mode === "hatch") {
        stamp(["#....#", "##..##", ".####."], 19, 52, MID);
        stamp(["#..#..#", "#######", ".#####."], 65, 52, MID);
      }
      if (asleep) stamp(["####", "..#.", ".#..", "####"], 64, 24, MID);
      if (mode === "hum") stamp([".###.", ".#.#.", ".#.#.", "##.##", "##.##"], 67, 27, MID);
      if (mode === "hello" || mode === "flip") stamp(TWINKLE, 21, 29, MID);
    }
    function care(frame, state) {
      const x = 67, y = 47;
      if (state.mode === "wish" || state.mode === "hungry") {
        stamp([".######.", "##....##", "#..##..#", "#...#..#", "#..#...#", "#......#", "#..#...#", ".#####..", "..##...."], x, y - 21, MID);
      } else if (state.mode === "food") {
        if (state.item === "biscuit") {
          oval(x, y, 5, 4, INK);
          oval(x, y, 4, 3, PALE);
          box(x - 2, y, 1, 1);
          box(x + 1, y - 1, 1, 1);
        } else {
          oval(x, y, state.item === "pear" ? 4 : 5, 5, INK);
          box(x - 1, y - 7, 2, 3);
          box(x + 1, y - 8, 3, 2, MID);
          box(x - 2, y - 2, 2, 2, PALE);
        }
      } else if (state.mode === "wash") {
        for (const [dx, dy] of [[-27, -9], [-9, -14], [2, -7]]) {
          const yy = y + dy - frame % 3;
          if (state.item === "rain") box(x + dx, yy, 1, 3, MID);
          else {
            box(x + dx - 1, yy - 2, 2, 1, MID);
            box(x + dx - 2, yy - 1, 1, 2, MID);
            box(x + dx + 1, yy - 1, 1, 2, MID);
            box(x + dx - 1, yy + 1, 2, 1, MID);
          }
        }
      } else if (state.mode === "play") {
        if (state.item === "kite") stamp(["..#..", ".###.", "#####", ".###.", "..#..", "...#.", "..#.."], x, y - 17);
        else {
          oval(x, y - frame % 4 * 2, 4, 4);
          box(x - 2, y - 2 - frame % 4 * 2, 2, 2, PALE);
        }
      } else if (state.mode === "nest" || state.mode === "sleep") {
        box(x - 26, y + 2, state.item === "pillow" ? 16 : 22, 5, MID);
        for (let i = 0; i < 3; i++) box(x - 24 + i * 4, y + 3, 2, 1, PALE);
      }
    }
    return (state, t, thanked) => {
      const frame = reducedMotion ? 2 : Math.floor(t * 3);
      const key = [frame, state.mode, state.life, state.item, Math.floor(state.warmth * 12), thanked].join("/");
      if (key === lastFrame) return;
      lastFrame = key;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      scene(frame);
      if (state.life === "Egg") egg(frame, state.warmth, state.mode === "egg" && state.moving);
      else {
        pet(frame, state);
        care(frame, state);
      }
      if (thanked) stamp(HEART, 63, 22, INK);
    };
  }

  // source/public/minigames/games/pocket-view.js
  var GUIDE = `
  <dialog class="pk-guide" aria-labelledby="pk-guide-title">
    <form method="dialog"><button type="submit" class="pk-close" aria-label="Close field guide">×</button></form>
    <p class="pk-eyebrow">Fikaride Pocket</p><h2 id="pk-guide-title">Field guide</h2>
    <h3>Hatching</h3><p>Start the on-screen pedals and ride for 10 seconds. You can pause and finish warming the same egg later.</p>
    <h3>Care</h3><p>After hatching, keep pedaling to share a first meal. Your moth will also ask for a bath, a game or fresh bedding. Any positive power helps. Food and company slowly run down between visits.</p>
    <p class="pk-needs" hidden></p>
    <h3>Growing up</h3><p>A hatchling becomes a fledgling after 8 minutes of total riding. At 45 minutes and 3 riding days it can take its adult form. Ride for 30 seconds in a day to count it. Brisk bursts can spark a somersault and influence its wings.</p>
    <h3>Saving</h3><p>Your moth and care progress save in this browser. After a reload, use Start riding to pick up where you left off.</p>
  </dialog>`;
  var ICON = ["###.......###", "#####...#####", ".#####.#####.", "..####.####..", ".....###.....", "...#######...", "..###.#.###..", ".###..#..###."];
  function drawMark(canvas) {
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ad402d";
    ICON.forEach((line, y) => [...line].forEach((c, x) => {
      if (c === "#") ctx.fillRect(x, y, 1, 1);
    }));
  }
  function setText(node, value) {
    if (node.textContent !== value) node.textContent = value;
  }
  var CARE = { food: "First meal", wash: "Bath time", play: "Play time", nest: "Fresh bedding" };
  var PAST = { food: "Meal shared", wash: "Bath finished", play: "Game played", nest: "Nest made" };
  function describeTask(p, state) {
    if (state.life === "Egg") return { label: "Egg warmth", value: p.seconds, max: HATCH, detail: Math.floor(p.seconds) + " / " + HATCH + " s" };
    if (p.ritual) {
      const label = p.ritual === "food" && p.completed ? "Meal time" : CARE[p.ritual];
      return { label, value: p.work, max: 13, detail: Math.floor(p.work) + " / 13 s" };
    }
    const rest = p.completed ? 40 + ((p.seed ^ Math.imul(p.completed, 73244475)) >>> 0) % 43 : 4;
    return { label: p.completed ? "Next care" : "First meal", value: Math.max(0, rest - p.delay), max: rest, detail: "Ride " + Math.ceil(p.delay) + " s" };
  }
  function mountPocket(env, actions) {
    const root = env.ui;
    root.innerHTML = `<div class="pocket-page">
    <header class="pk-header"><div class="pk-wordmark"><canvas class="pk-mark" width="13" height="8" aria-hidden="true"></canvas><span>Fikaride <i>Pocket</i></span></div>
    <button class="pk-guide-open" type="button" aria-haspopup="dialog"><span class="pk-book" aria-hidden="true"></span>Field guide</button></header>
    <section class="pk-layout" aria-label="Pocket moth game">
      <figure class="pk-case">
        <div class="pk-case-top"><span class="pk-lamp" aria-hidden="true"></span><span class="pk-state">At rest</span></div>
        <div class="pk-toy" aria-hidden="true"><img class="pk-shell" alt="" width="1254" height="1254" draggable="false">
          <canvas class="pk-screen" width="96" height="66"></canvas></div>
        <figcaption class="pk-instruments"><span><small>Ride time</small><b class="pk-time">0:00</b></span>
          <span><small class="pk-power-label">Simulated power</small><b class="pk-power">0 W</b></span></figcaption>
      </figure>
      <div class="pk-board">
        <p class="pk-eyebrow pk-stage">Egg</p><h1 class="pk-name">A sleeping egg</h1>
        <p class="pk-caption" role="status" aria-live="polite" aria-atomic="true"></p>
        <div class="pk-task">
          <div><label for="pk-progress" class="pk-task-name">Egg warmth</label><span class="pk-count"></span></div>
          <progress id="pk-progress" value="0" max="10">0</progress>
        </div>
        <button class="pk-ride" type="button"><span class="pk-play-icon" aria-hidden="true"></span><span class="pk-ride-label">Start riding</span></button>
        <div class="pk-paces" role="group" aria-label="Simulated pace"><span aria-hidden="true">Pace</span><div>
          <button type="button" data-watts="160" aria-pressed="true">Steady</button>
          <button type="button" data-watts="280" aria-pressed="false">Brisk</button></div></div>
        <p class="pk-input-note" role="status"></p>
        <div class="pk-record" hidden><div><span>Care rituals</span><b class="pk-completed">0</b></div><div><span>Riding days</span><b class="pk-days">0</b></div></div>
      </div>
    </section>
    <footer class="pk-footer"><span class="pk-save"><span class="pk-save-mark" aria-hidden="true"></span><span class="pk-save-text">Saved in this browser</span></span>
      <span class="pk-links"></span></footer>
    ` + GUIDE + `</div>`;
    const pick = (cls) => root.querySelector(".pk-" + cls);
    const ui = Object.fromEntries(["name", "state", "time", "power", "power-label", "stage", "caption", "task-name", "count", "ride", "ride-label", "input-note", "record", "days", "completed", "save-text", "guide", "guide-open", "paces", "case", "screen", "needs"].map((key) => [key, pick(key)]));
    const progress = root.querySelector("progress"), paceButtons = [...ui.paces.querySelectorAll("button")];
    const img = pick("shell");
    img.src = env.shellUrl || "../minigames/assets/pocket/shell.webp";
    drawMark(pick("mark"));
    for (const [label, href] of env.links || []) {
      const link = document.createElement("a");
      link.textContent = label;
      link.href = href;
      if (label === "Offline ZIP") link.download = "fikaride-pocket.zip";
      pick("links").append(link);
    }
    if (env.creditsUrl) {
      const link = document.createElement("a");
      link.className = "pk-credit-link";
      link.href = env.creditsUrl;
      link.textContent = "Art and code credits";
      ui.guide.append(link);
    }
    ui["guide-open"].onclick = () => ui.guide.showModal();
    ui.guide.addEventListener("close", () => ui["guide-open"].focus());
    ui.guide.addEventListener("click", (event) => {
      if (event.target === ui.guide) {
        const r = ui.guide.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) ui.guide.close();
      }
    });
    ui.ride.onclick = actions.toggle;
    paceButtons.forEach((button) => {
      button.onclick = () => actions.pace(Number(button.dataset.watts));
    });
    let lastSeed, paint;
    return {
      update(p, state, identity, input, saved, t, thanked) {
        if (lastSeed !== p.seed) {
          lastSeed = p.seed;
          paint = makeScreen(ui.screen, identity, env.reducedMotion);
        }
        paint(state, t, thanked);
        const egg = state.life === "Egg", selected = input.power > 0, task = describeTask(p, state);
        const caption = egg && !state.moving ? p.seconds > 0 ? "Your egg is warm. Ride a little longer to help it hatch." : "Use the on-screen pedals for 10 seconds to hatch your moth." : thanked ? PAST[p.lastRitual] + ". " + state.name + " sends a little heart." : state.caption;
        setText(ui.stage, state.life);
        setText(ui.name, egg ? state.moving ? "A waking egg" : p.seconds > 0 ? "A warm egg" : "A sleeping egg" : state.name);
        setText(ui.caption, caption);
        setText(ui["task-name"], task.label);
        setText(ui.count, task.detail);
        progress.max = task.max;
        progress.value = task.value;
        progress.setAttribute("aria-valuetext", task.detail);
        setText(ui.state, input.sensor ? state.moving ? "Riding" : "Trainer ready" : selected ? "Riding" : "At rest");
        ui.case.classList.toggle("pk-moving", selected || state.moving);
        setText(ui.time, formatClock(p.seconds));
        setText(ui["power-label"], input.sensor ? "Trainer power" : "Simulated power");
        setText(ui.power, Math.round(input.power) + " W");
        const ridingDemo = !input.sensor && selected;
        setText(ui["ride-label"], ridingDemo ? "Pause ride" : "Start riding");
        ui.ride.classList.toggle("pk-riding", ridingDemo);
        paceButtons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.watts) === input.pace)));
        setText(ui["input-note"], input.note || (input.sensor ? "Pedal a connected trainer or use the on-screen ride." : "The on-screen pedals run until you pause."));
        ui.record.hidden = egg;
        ui.needs.hidden = egg;
        if (!egg) setText(ui.needs, "Food " + Math.round(state.food * 100) + "% · Company " + Math.round(state.company * 100) + "%");
        setText(ui.completed, String(p.completed));
        setText(ui.days, String(p.days));
        setText(ui["save-text"], saved ? "Saved in this browser" : "Session only · browser storage unavailable");
      },
      dispose() {
        if (ui.guide.open) ui.guide.close();
        root.replaceChildren();
      }
    };
  }

  // source/public/minigames/games/pocket.js
  function create(env) {
    const profile = env.profile || "sim", sensor = profile === "sensor", now = env.now || Date.now;
    const preview = !!env.preview;
    const load = () => preview ? null : loadState(profile, "pocket");
    const seed = preview ? 742 : crypto.getRandomValues(new Uint32Array(1))[0];
    const initial = load();
    let pet = restorePet(initial, seed, now()), identity = genes(pet.seed), ride = newRide();
    let dirty = !initial || initial.kind !== pet.kind || initial.version !== pet.version || initial.seed !== pet.seed;
    let durable = true, lastSave = 0, lastDraw = -Infinity, clock = 0, heartUntil = -1;
    let lastSeconds, lastJoules, sessionId, watts2 = 0, pace = 160;
    function save() {
      if (preview || !dirty) return;
      durable = saveState(profile, "pocket", pet);
      dirty = false;
      lastSave = clock;
      env.requestSave?.();
    }
    function reset() {
      const session2 = env.session();
      sessionId = session2.id;
      lastSeconds = session2.seconds;
      lastJoules = session2.joules;
      ride = newRide();
      watts2 = 0;
      lastDraw = -Infinity;
    }
    function refresh() {
      const current = load();
      if (!current) return;
      pet = restorePet(current, seed, now());
      identity = genes(pet.seed);
      dirty = false;
      heartUntil = -1;
      reset();
    }
    function state() {
      return { ...observe(pet, ride, now(), identity), moving: ride.moving };
    }
    function render(t) {
      const demo = env.demo?.watts();
      const power = sensor ? watts2 : Math.max(0, demo ?? 0);
      if (power === 160 || power === 280) pace = power;
      ui?.update(pet, state(), identity, { sensor, power, pace, note: env.inputNote?.() }, durable, t, t < heartUntil);
      lastDraw = t;
    }
    const ui = env.ui && !preview ? mountPocket(env, {
      toggle() {
        if (sensor) {
          env.demo?.start();
          env.demo?.set(pace);
          env.ui.querySelector(".pk-ride")?.focus();
          return;
        }
        env.demo?.set(env.demo.watts() > 0 ? 0 : pace);
        render(clock);
      },
      pace(value) {
        pace = value;
        if (!sensor && (env.demo?.watts() || 0) > 0) env.demo.set(value);
        render(clock);
      }
    }) : null;
    function step(dt, t, signal) {
      clock = t;
      const session2 = env.session();
      if (session2.id !== sessionId) reset();
      const seconds = session2.seconds - lastSeconds, joules = session2.joules - lastJoules;
      lastSeconds = session2.seconds;
      lastJoules = session2.joules;
      watts2 = signal?.fresh ? Math.max(0, signal.value || 0) : 0;
      if (watts2 > 0 && seconds > 0 && seconds <= MAX_SAMPLE_GAP && joules > 0) {
        const priorRitual = pet.ritual;
        const event = pedal(pet, ride, seconds, joules / seconds, now());
        dirty = true;
        if (event === "thanks") heartUntil = t + 4;
        if (env.audio && (event === "grow" || event === "thanks")) {
          bellTone(env.audio, t, event === "grow" ? 659.25 : 523.25, { gain: 0.035, decay: 0.45 });
        }
        if (event || pet.ritual !== priorRitual || t - lastSave >= 1) save();
      } else if (watts2 <= 0 && ride.moving) {
        ride = newRide();
        save();
      }
    }
    reset();
    save();
    if (ui) render(0);
    return {
      step,
      reset,
      save,
      refresh,
      draw(ctx, view) {
        if (view.t - lastDraw >= 0.12 || view.t < lastDraw) render(view.t);
      },
      dispose() {
        save();
        ui?.dispose();
      },
      status() {
        return { cue: state().caption, detail: { profile, seconds: Math.floor(pet.seconds) } };
      },
      test: { state: () => ({ ...pet, ...state(), profile }) }
    };
  }
  var pocket_default = { id: "pocket", title: "Pocket", signal: "power", action: "pedal", blurb: "Hatch a pocket moth by riding.", create };

  // build/page-entry.js
  var app = document.getElementById("app");
  var meter = new EnergyMeter();
  var session = { id: "on-screen", seconds: 0, joules: 0 };
  var saveKey = NAMESPACE + ".sim.pocket";
  var watts = 0;
  var seq = 0;
  var lastSample = performance.now() / 1e3;
  var game;
  var releaseLock;
  var requesting = false;
  var note = "";
  var links = [];
  if (app.dataset.download) links.push(["Offline ZIP", app.dataset.download]);
  links.push(["License", "./LICENSE.txt"]);
  function sample() {
    const t = performance.now() / 1e3;
    const reading = { source: "sim", fresh: true, value: watts, seq: ++seq, age: 0 };
    meter.update(reading, t);
    session.seconds = meter.seconds;
    session.joules = meter.joules;
    game.step(t - lastSample, t, reading);
    lastSample = t;
    if (!document.hidden) game.draw(null, { t });
  }
  function changePower(next) {
    sample();
    watts = next;
    meter.restart();
    sample();
  }
  function setPower(next) {
    note = "";
    if (!next) {
      changePower(0);
      game.save();
      releaseLock?.();
      releaseLock = null;
      return;
    }
    if (watts || !navigator.locks) {
      changePower(next);
      return;
    }
    if (requesting) return;
    requesting = true;
    navigator.locks.request(saveKey, { ifAvailable: true }, async (lock) => {
      requesting = false;
      if (!lock) {
        note = "A ride is open in another tab. Pause it there to ride here.";
        sample();
        return;
      }
      game.refresh();
      changePower(next);
      await new Promise((resolve) => {
        releaseLock = resolve;
      });
    }).catch(() => {
      requesting = false;
      changePower(next);
    });
  }
  game = pocket_default.create({
    ui: app,
    profile: "sim",
    session: () => session,
    demo: { watts: () => watts, set: setPower },
    inputNote: () => note,
    shellUrl: "./shell.webp",
    creditsUrl: "./CREDITS.txt",
    links,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches
  });
  var timer = setInterval(sample, 200);
  sample();
  document.addEventListener("visibilitychange", () => {
    sample();
    if (document.hidden) game.save();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === saveKey && e.newValue && !watts) {
      game.refresh();
      sample();
    }
  });
  window.addEventListener("pagehide", () => {
    setPower(0);
    clearInterval(timer);
    game.dispose();
  }, { once: true });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) location.reload();
  });
})();

import type { Banner, Camera, Enemy, EnemyKind, Floater, GameMode, Particle, Player, Shot, Snapshot } from "./types";
import { AudioEngine } from "./audio";
import { loadScores, saveScore } from "./scores";

export const WORLD_W = 1760;
export const WORLD_H = 1100;
export const DASH_CD = 0.52;
export const PARRY_CD = 0.72;
export const CHAKRA_CD = 2.85;

let nid = 1;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];
const ang = (x: number, y: number) => Math.atan2(y, x);
const len = (x: number, y: number) => Math.hypot(x, y);

const BOSS_CYCLE: EnemyKind[] = ["vetal", "naga", "commander", "rudra", "maha"];
const BOSS_NAMES: Partial<Record<EnemyKind, string>> = {
  vetal: "CHIEF VETAL, THE MADDENED",
  naga: "CORRUPTED NAGA OF PATAL",
  commander: "THE ASURA COMMANDER",
  rudra: "RUDRA PRATAP, HOLLOW FLAME",
  maha: "MAHABALASURA, THE CORRECTION",
};
const BOSS_QUOTES: Partial<Record<EnemyKind, string>> = {
  vetal: "The roots remember what you burned",
  naga: "The poisoned guardian stirs",
  commander: "Its blades sing in five tongues",
  rudra: "\"Let me warm one more home... please\"",
  maha: "\"Humanity was the mistake. I am the correction\"",
};
const ELEVATE_LINES = [
  "Jai Bhumi Rakshak!",
  "\"I am your reckoning\"",
  "\"The forest remembers\"",
  "For Maa Durvasa",
  "\"Walk like a god\"",
];

function knock(e: { x: number; y: number; vx: number; vy: number }, x: number, y: number, f: number) {
  const d = len(e.x - x, e.y - y) || 1;
  e.vx += ((e.x - x) / d) * f;
  e.vy += ((e.y - y) / d) * f;
}

export class Game {
  mode: GameMode = "boot";
  player: Player;
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  parts: Particle[] = [];
  floats: Floater[] = [];
  cam: Camera;
  audio: AudioEngine;
  keys = new Set<string>();
  joy = { x: 0, y: 0, on: false };
  btns = { atk: false, dash: false, parry: false, chakra: false, elev: false };
  prev = { atk: false, dash: false, parry: false, chakra: false, elev: false };
  score = 0;
  combo = 0;
  comboT = 0;
  comboMul = 1;
  wave = 0;
  waveT = 0;
  spawning = false;
  kills = 0;
  time = 0;
  pacified = 0;
  banner: Banner | null = null;
  highScores = loadScores();
  initials = "RAJ";
  saved = false;
  introT = 0;
  killcam: Shot | null = null;
  orbitT = 0;
  ready = false;
  private gen = 0;

  constructor(audio: AudioEngine) {
    this.audio = audio;
    this.player = this.makePlayer();
    this.cam = {
      x: WORLD_W / 2,
      y: WORLD_H / 2,
      zoom: 1.05,
      rot: 0,
      tilt: 0,
      trauma: 0,
      flash: 0,
      flashCol: "#fff",
      grade: 0,
      letter: 0.18,
      mode: "follow",
      modeT: 0,
      focusX: WORLD_W / 2,
      focusY: WORLD_H / 2,
      timeScale: 1,
      hitstop: 0,
    };
  }

  makePlayer(): Player {
    return {
      x: WORLD_W / 2,
      y: WORLD_H / 2 + 40,
      vx: 0,
      vy: 0,
      r: 22,
      hp: 100,
      maxHp: 100,
      facing: -0.4,
      state: "idle",
      stateT: 0,
      hurtT: 0,
      flash: 0,
      dead: false,
      z: 0,
      comboStep: 0,
      comboT: 0,
      dashCd: 0,
      parryCd: 0,
      chakraCd: 0,
      invuln: 0,
      attacking: 0,
      lunge: 0,
      mass: 0,
      elevateT: 0,
      kills: 0,
    };
  }

  toTitle() {
    this.mode = "title";
    this.cam.letter = 0.16;
    this.cam.grade = 0.35;
    this.audio.setCombat(false);
  }

  start() {
    this.gen++;
    this.player = this.makePlayer();
    this.enemies = [];
    this.shots = [];
    this.parts = [];
    this.floats = [];
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.comboMul = 1;
    this.wave = 0;
    this.kills = 0;
    this.saved = false;
    this.pacified = 0;
    this.initials = "RAJ";
    this.mode = "playing";
    this.introT = 1.4;
    this.cam.mode = "worship";
    this.cam.modeT = 1.4;
    this.cam.letter = 0.2;
    this.cam.zoom = 1.35;
    this.cam.timeScale = 0.55;
    this.cam.flash = 0.6;
    this.cam.flashCol = "#7ee8ff";
    this.audio.setCombat(true);
    this.audio.whistle();
    this.audio.wave();
    this.banner = { title: "THE PACT IS SEALED", sub: "Cut them down", t: 0, max: 1.8, style: "elevate" };
    this.burst(this.player.x, this.player.y, 40, "akshata", "#ffd54f");
    this.ring(this.player.x, this.player.y, "#00e5ff", 80);
    this.nextWave();
  }

  restart() {
    this.start();
  }

  togglePause() {
    if (this.mode === "playing") {
      this.mode = "paused";
      this.audio.setCombat(false);
    } else if (this.mode === "paused") {
      this.mode = "playing";
      this.audio.setCombat(true);
    }
  }

  press(code: string) {
    this.keys.add(code);
    if (code === "KeyM") this.audio.setMuted(!this.audio.muted);
  }
  release(code: string) {
    this.keys.delete(code);
  }

  snapshot(): Snapshot {
    const boss = this.enemies.find((e) => e.elite);
    return {
      mode: this.mode,
      score: this.score,
      combo: this.combo,
      comboMul: this.comboMul,
      wave: this.wave,
      hp: Math.max(0, this.player.hp),
      maxHp: this.player.maxHp,
      mass: this.player.mass,
      elevateT: this.player.elevateT,
      dashCd: this.player.dashCd,
      dashMax: DASH_CD,
      parryCd: this.player.parryCd,
      parryMax: PARRY_CD,
      chakraCd: this.player.chakraCd,
      chakraMax: CHAKRA_CD,
      kills: this.kills,
      banner: this.banner,
      boss: boss
        ? {
            name: BOSS_NAMES[boss.kind] || "THE ASURA",
            hp: Math.max(0, boss.hp),
            maxHp: boss.maxHp,
          }
        : null,
      highScores: this.highScores,
      initials: this.initials,
      saved: this.saved,
      pacified: this.pacified,
    };
  }

  typeInitial(ch: string) {
    if (this.mode !== "gameover" || this.saved) return;
    if (ch === "Backspace") {
      this.initials = this.initials.slice(0, -1);
      return;
    }
    if (/^[A-Za-z]$/.test(ch) && this.initials.length < 3) {
      this.initials += ch.toUpperCase();
    }
  }

  commitScore() {
    if (this.saved) return;
    const name = (this.initials || "RAJ").padEnd(3, "X").slice(0, 3);
    this.highScores = saveScore({
      name,
      score: this.score,
      wave: this.wave,
      kills: this.kills,
    });
    this.saved = true;
  }

  update(dt: number) {
    this.audio.tick();
    if (this.mode === "title") {
      this.time += dt;
      this.cam.x = WORLD_W / 2 + Math.sin(this.time * 0.25) * 30;
      this.cam.y = WORLD_H / 2 + Math.cos(this.time * 0.18) * 18;
      this.cam.zoom = 1.08 + Math.sin(this.time * 0.3) * 0.03;
      this.spawnAmbient();
      this.updateParts(dt);
      return;
    }
    if (this.mode === "paused" || this.mode === "boot") return;

    if (this.cam.hitstop > 0) {
      this.cam.hitstop -= dt;
      this.updateCam(dt * 0.2);
      return;
    }

    const elev = this.player.elevateT > 0;
    const scale = this.cam.timeScale * (this.mode === "gameover" ? 0.35 : 1);
    const edt = dt * scale;
    const pdt = dt * scale * (elev ? 1.15 : 1);
    const ndt = dt * scale * (elev ? 0.72 : 1);

    this.time += edt;
    if (this.introT > 0) this.introT -= dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.max) this.banner = null;
    }

    if (this.mode === "playing") {
      this.updatePlayer(pdt);
      this.updateEnemies(ndt);
      this.updateShots(edt);
      this.checkWave(edt);
    } else if (this.mode === "gameover") {
      this.updateEnemies(ndt * 0.4);
      this.updateShots(edt);
    }

    this.updateParts(edt);
    this.updateFloats(edt);
    this.updateCam(dt);
    this.prev = { ...this.btns };
  }

  private edge() {
    const k = this.keys;
    let x = this.joy.on ? this.joy.x : 0;
    let y = this.joy.on ? this.joy.y : 0;
    if (k.has("KeyA") || k.has("ArrowLeft")) x -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) x += 1;
    if (k.has("KeyW") || k.has("ArrowUp")) y -= 1;
    if (k.has("KeyS") || k.has("ArrowDown")) y += 1;
    const l = len(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    const atk =
      this.btns.atk || k.has("Space") || k.has("KeyJ") || k.has("KeyZ");
    const dash = this.btns.dash || k.has("ShiftLeft") || k.has("ShiftRight") || k.has("KeyK") || k.has("KeyX");
    const parry = this.btns.parry || k.has("KeyF") || k.has("KeyI") || k.has("KeyC");
    const chakra = this.btns.chakra || k.has("KeyE") || k.has("KeyL") || k.has("KeyV");
    const elev = this.btns.elev || k.has("KeyQ");
    const held = this.keyHeld;
    const just = {
      atk: atk && !held.atk,
      dash: dash && !held.dash,
      parry: parry && !held.parry,
      chakra: chakra && !held.chakra,
      elev: elev && !held.elev,
    };
    this.keyHeld = { atk, dash, parry, chakra, elev };
    return { x, y, ...just, atkHold: atk, dashHold: dash };
  }

  private keyHeld = { atk: false, dash: false, parry: false, chakra: false, elev: false };

  private updatePlayer(dt: number) {
    const p = this.player;
    if (p.dead) return;
    const i = this.edge();

    p.dashCd = Math.max(0, p.dashCd - dt);
    p.parryCd = Math.max(0, p.parryCd - dt);
    p.chakraCd = Math.max(0, p.chakraCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.flash = Math.max(0, p.flash - dt * 4);
    p.comboT = Math.max(0, p.comboT - dt);
    p.attacking = Math.max(0, p.attacking - dt);
    p.lunge = Math.max(0, p.lunge - dt);
    p.stateT += dt;
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0 && this.combo > 0) {
      this.combo = 0;
      this.comboMul = 1;
    }
    if (p.elevateT > 0) {
      p.elevateT = Math.max(0, p.elevateT - dt);
      this.cam.grade = lerp(this.cam.grade, 1, 0.12);
      if (p.elevateT <= 0) {
        this.audio.setElevate(false);
        this.cam.mode = "follow";
      }
    } else {
      this.cam.grade = lerp(this.cam.grade, 0, 0.06);
    }

    if (p.comboT <= 0) p.comboStep = 0;

    if (i.elev && p.mass >= 100 && p.elevateT <= 0) this.elevate();

    if (p.state === "dash") {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.after(p.x, p.y);
      if (p.stateT > 0.16) {
        p.state = "idle";
        p.vx *= 0.2;
        p.vy *= 0.2;
      }
      this.bound(p);
      return;
    }

    if (p.state === "parry") {
      if (p.stateT > 0.22) p.state = "idle";
      p.vx *= 0.8;
      p.vy *= 0.8;
      this.integrate(p, dt);
      return;
    }

    if (p.state === "hurt") {
      if (p.stateT > 0.22) p.state = "idle";
      this.integrate(p, dt);
      return;
    }

    if (p.state === "strike" || p.state === "windup") {
      if (p.state === "windup" && p.stateT > 0.05) {
        p.state = "strike";
        p.stateT = 0;
        this.doSlash();
      }
      if (p.state === "strike" && p.stateT > 0.18) {
        p.state = "recover";
        p.stateT = 0;
      }
      p.x += Math.cos(p.facing) * p.lunge * dt * 8;
      p.y += Math.sin(p.facing) * p.lunge * dt * 8;
      this.integrate(p, dt * 0.35);
      if (i.atk && p.comboStep < 3 && p.state === "recover") {
        this.beginAttack();
      }
      this.bound(p);
      return;
    }

    if (p.state === "recover") {
      if (i.atk && p.comboT > 0 && p.comboStep < 3) {
        this.beginAttack();
        return;
      }
      if (p.stateT > 0.16) p.state = "idle";
    }

    if (i.dash && p.dashCd <= 0) {
      this.doDash(i.x, i.y);
      return;
    }
    if (i.parry && p.parryCd <= 0) {
      const tb = this.staggeredNear(p.x, p.y, 110);
      if (tb) {
        this.pacify(tb);
        return;
      }
      p.state = "parry";
      p.stateT = 0;
      p.parryCd = PARRY_CD;
      this.audio.ui();
      return;
    }
    if (i.chakra && p.chakraCd <= 0) {
      this.throwChakra();
    }
    if (i.atk) this.beginAttack();

    const spd = 305 * (p.elevateT > 0 ? 1.22 : 1);
    p.vx = lerp(p.vx, i.x * spd, 0.28);
    p.vy = lerp(p.vy, i.y * spd, 0.28);
    if (len(i.x, i.y) > 0.2) {
      p.facing = ang(i.x, i.y);
      p.state = "run";
    } else if (p.state === "run") p.state = "idle";

    this.integrate(p, dt);
    this.bound(p);
  }

  private beginAttack() {
    const p = this.player;
    p.comboStep = p.comboT > 0 ? (p.comboStep % 3) + 1 : 1;
    p.comboT = 0.42;
    p.state = "windup";
    p.stateT = 0;
    p.attacking = 0.28;
    p.lunge = p.comboStep === 3 ? 90 : 48;
    this.audio.slash();
    const nearest = this.nearest(p.x, p.y, 220);
    if (nearest) p.facing = ang(nearest.x - p.x, nearest.y - p.y);
  }

  private doSlash() {
    const p = this.player;
    const heavy = p.comboStep === 3;
    const range = heavy ? 108 : 80;
    const dmg = (heavy ? 38 : 16 + p.comboStep * 5) * (p.elevateT > 0 ? 1.55 : 1);
    const px = p.x + Math.cos(p.facing) * 36;
    const py = p.y + Math.sin(p.facing) * 36;
    this.slashFx(px, py, p.facing, heavy);
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = len(e.x - px, e.y - py);
      const behind = Math.cos(p.facing) * (e.x - p.x) + Math.sin(p.facing) * (e.y - p.y);
      if (d < range + e.r && behind > -10) {
        this.hurtEnemy(e, dmg, p.x, p.y, heavy ? 420 : 240);
        hits++;
      }
    }
    if (hits > 0) {
      this.cam.hitstop = heavy ? 0.07 : 0.035;
      this.shake(heavy ? 14 : 7);
      this.cam.flash = heavy ? 0.18 : 0.08;
      this.cam.flashCol = p.elevateT > 0 ? "#7ee8ff" : "#fff4d0";
      if (heavy) {
        this.ring(p.x, p.y, "#00e5ff", 120);
        this.audio.heavy();
        this.shock(p.x, p.y, 150, dmg * 0.45);
      }
    }
  }

  private doDash(ix: number, iy: number) {
    const p = this.player;
    let dx = ix;
    let dy = iy;
    if (len(dx, dy) < 0.15) {
      dx = Math.cos(p.facing);
      dy = Math.sin(p.facing);
    }
    const l = len(dx, dy) || 1;
    p.vx = (dx / l) * 820;
    p.vy = (dy / l) * 820;
    p.facing = ang(p.vx, p.vy);
    p.state = "dash";
    p.stateT = 0;
    p.dashCd = DASH_CD;
    p.invuln = 0.2;
    this.audio.dash();
    this.burst(p.x, p.y, 10, "dust", "#d4a574");
    if (p.elevateT > 0) {
      this.shock(p.x, p.y, 70, 12);
    }
  }

  private throwChakra() {
    const p = this.player;
    p.chakraCd = CHAKRA_CD;
    const aim = this.nearest(p.x, p.y, 520);
    const a = aim ? ang(aim.x - p.x, aim.y - p.y) : p.facing;
    p.facing = a;
    this.shots.push({
      x: p.x + Math.cos(a) * 28,
      y: p.y + Math.sin(a) * 28,
      vx: Math.cos(a) * 620,
      vy: Math.sin(a) * 620,
      r: 14,
      dmg: 26 * (p.elevateT > 0 ? 1.4 : 1),
      life: 2.4,
      from: "player",
      kind: "chakra",
      bounces: 5,
      hit: new Set(),
      glow: "#7ee8ff",
    });
    this.audio.chakra();
    this.burst(p.x, p.y, 12, "spark", "#00e5ff");
  }

  private elevate() {
    const p = this.player;
    p.mass = 0;
    p.elevateT = 8;
    p.invuln = 0.6;
    this.cam.mode = "worship";
    this.cam.modeT = 1.1;
    this.cam.flash = 0.5;
    this.cam.flashCol = "#00e5ff";
    this.cam.letter = 0.18;
    this.cam.hitstop = 0.08;
    this.audio.setElevate(true);
    this.audio.chant();
    this.banner = { title: "ELEVATION", sub: pick(ELEVATE_LINES), t: 0, max: 1.6, style: "elevate" };
    this.burst(p.x, p.y, 50, "akshata", "#ffd54f");
    this.burst(p.x, p.y, 24, "spark", "#00e5ff");
    this.ring(p.x, p.y, "#00e5ff", 160);
    this.shake(16);
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) {
        e.stateT += dt;
        e.z = Math.max(0, e.z - dt * 40);
        continue;
      }
      e.stateT += dt;
      e.cd = Math.max(0, e.cd - dt);
      e.hurtT = Math.max(0, e.hurtT - dt);
      e.flash = Math.max(0, e.flash - dt * 5);
      e.telegraph = Math.max(0, e.telegraph - dt);

      if (e.stagger > 0) {
        e.stagger -= dt;
        e.vx *= 0.88;
        e.vy *= 0.88;
        this.integrate(e, dt);
        if (Math.random() < dt * 14) {
          this.parts.push({
            x: e.x + rand(-e.r, e.r),
            y: e.y - rand(0, e.r * 2),
            vx: rand(-14, 14),
            vy: rand(-42, -10),
            life: 0.7,
            max: 0.7,
            size: rand(2, 4.5),
            color: "#ffd54f",
            kind: "akshata",
            rot: 0,
            spin: 2,
          });
        }
        if (e.stagger <= 0) {
          e.hp = Math.max(e.hp, e.maxHp * 0.18);
          e.flash = 1;
          this.shake(8);
        }
        continue;
      }

      if (e.state === "hurt") {
    e.vx *= 0.86;
    e.vy *= 0.86;
    this.integrate(e, dt);
      if (e.stateT > 0.18) e.state = "idle";
        this.bound(e);
        continue;
      }

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = len(dx, dy) || 1;
      e.facing = ang(dx, dy);

      if (e.state === "windup") {
        e.vx *= 0.7;
        e.vy *= 0.7;
        if (e.stateT >= e.windup) {
          e.state = "strike";
          e.stateT = 0;
          this.enemyStrike(e);
        }
        this.integrate(e, dt);
        continue;
      }
      if (e.state === "strike") {
        if (e.stateT >= e.strikeT) {
          e.state = "recover";
          e.stateT = 0;
        }
        this.integrate(e, dt);
        continue;
      }
      if (e.state === "recover") {
        e.vx *= 0.85;
        e.vy *= 0.85;
        if (e.stateT >= e.recover) {
          e.state = "idle";
          e.cd = e.cooldown;
        }
        this.integrate(e, dt);
        continue;
      }

      if (e.kind === "archer" && d < 340 && d > 160 && e.cd <= 0) {
        this.beginEnemyAtk(e);
      } else if (d < e.atkRange && e.cd <= 0) {
        this.beginEnemyAtk(e);
      } else {
        let spd = e.speed;
        if (e.kind === "archer" && d < 170) spd *= -0.8;
        if (e.kind === "naga" && d > 80 && Math.sin(this.time * 2 + e.x) > 0.7) spd *= 1.8;
        e.vx = lerp(e.vx, (dx / d) * spd, 0.12);
        e.vy = lerp(e.vy, (dy / d) * spd, 0.12);
        e.state = "run";
      }

      this.sep(e);
      this.integrate(e, dt);
      this.bound(e);
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.stateT < 0.9);
  }

  private beginEnemyAtk(e: Enemy) {
    e.state = "windup";
    e.stateT = 0;
    e.telegraph = e.windup;
    e.vx *= 0.3;
    e.vy *= 0.3;
    e.slam = (e.kind === "vetal" || e.kind === "maha") && Math.random() < 0.45 ? 1 : 0;
    if (e.kind === "brute" || e.kind === "maha" || e.kind === "vetal") this.burst(e.x, e.y, 6, "ember", "#ff6d00");
  }

  private enemyStrike(e: Enemy) {
    const p = this.player;
    if (e.slam) {
      e.slam = 0;
      const R = 150;
      this.ring(e.x, e.y, "#ff5e00", R * 0.7);
      this.ring(e.x, e.y, "#ffd54f", R * 0.4);
      this.shake(14);
      this.cam.hitstop = 0.05;
      this.audio.heavy();
      this.burst(e.x, e.y, 18, "dust", "#b8793d");
      const d = len(p.x - e.x, p.y - e.y);
      if (d < R + p.r && p.invuln <= 0 && p.state !== "dash") {
        if (p.state === "parry" && p.stateT < 0.2) this.perfectParry(e);
        else this.tryHitPlayer(e, e.dmg * 1.15, e.x, e.y);
      }
      return;
    }
    if (e.kind === "commander" && e.phase === 0) {
      e.phase = 1;
      e.recover = 0.09;
    } else {
      e.phase = 0;
    }
    if (e.kind === "rudra") {
      const d = len(p.x - e.x, p.y - e.y);
      if (d > 150) {
        const a = ang(p.x - e.x, p.y - e.y);
        for (const spread of [-0.24, 0, 0.24]) {
          this.shots.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(a + spread) * 360,
            vy: Math.sin(a + spread) * 360,
            r: 8,
            dmg: e.dmg * 0.7,
            life: 2.4,
            from: "enemy",
            kind: "bolt",
            bounces: 0,
            hit: new Set(),
            glow: "#c084fc",
          });
        }
        this.burst(e.x, e.y, 8, "ember", "#4c1d95");
        return;
      }
    }
    if (e.kind === "archer") {
      const a = ang(p.x - e.x, p.y - e.y);
      this.shots.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * 340,
        vy: Math.sin(a) * 340,
        r: 7,
        dmg: e.dmg,
        life: 2.2,
        from: "enemy",
        kind: "bolt",
        bounces: 0,
        hit: new Set(),
        glow: "#ff4d4d",
      });
      return;
    }
    if (e.kind === "naga" && Math.random() < 0.4) {
      const a = ang(p.x - e.x, p.y - e.y);
      this.shots.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * 280,
        vy: Math.sin(a) * 280,
        r: 10,
        dmg: e.dmg * 0.7,
        life: 1.8,
        from: "enemy",
        kind: "spit",
        bounces: 0,
        hit: new Set(),
        glow: "#7cff6b",
      });
    }
    const dash = e.kind === "naga" || e.kind === "maha";
    if (dash) {
      const a = ang(p.x - e.x, p.y - e.y);
      e.vx = Math.cos(a) * 520;
      e.vy = Math.sin(a) * 520;
    }
    const reach = e.atkRange + (e.kind === "brute" || e.kind === "maha" ? 30 : 8);
    const d = len(p.x - e.x, p.y - e.y);
    if (d < reach + p.r) this.tryHitPlayer(e, e.dmg, e.x, e.y);
    if (e.kind === "brute" || e.kind === "maha") {
      this.ring(e.x, e.y, "#ff3d00", 70);
      this.shake(8);
    }
  }

  private tryHitPlayer(e: Enemy, dmg: number, ox: number, oy: number) {
    const p = this.player;
    if (p.dead || p.invuln > 0) return;
    if (p.state === "parry" && p.stateT < 0.2) {
      this.perfectParry(e);
      return;
    }
    p.hp -= dmg;
    p.state = "hurt";
    p.stateT = 0;
    p.hurtT = 0.25;
    p.flash = 1;
    p.invuln = 0.55;
    knock(p, ox, oy, 280);
    this.shake(11);
    this.cam.flash = 0.22;
    this.cam.flashCol = "#ff2040";
    this.audio.hurt();
    this.burst(p.x, p.y, 14, "spark", "#ff6b6b");
    this.combo = 0;
    this.comboMul = 1;
    if (p.hp <= 0) this.die();
  }

  private perfectParry(e: Enemy) {
    const p = this.player;
    p.mass = Math.min(100, p.mass + 22);
    this.score += 80 * this.comboMul;
    this.addCombo(2);
    e.state = "hurt";
    e.stateT = 0;
    e.flash = 1;
    knock(e, p.x, p.y, 380);
    this.cam.hitstop = 0.1;
    this.cam.timeScale = 0.28;
    window.setTimeout(() => {
      if (this.cam.timeScale < 1) this.cam.timeScale = 1;
    }, 380);
    this.cam.mode = "snap";
    this.cam.modeT = 0.35;
    this.cam.focusX = p.x;
    this.cam.focusY = p.y;
    this.shake(10);
    this.cam.flash = 0.28;
    this.cam.flashCol = "#b8f3ff";
    this.ring(p.x, p.y, "#00e5ff", 110);
    this.burst(p.x, p.y, 22, "spark", "#7ee8ff");
    this.audio.parry();
    this.banner = { title: "PERFECT PARRY", sub: "Elevation rises", t: 0, max: 0.9, style: "parry" };
    this.float(p.x, p.y - 40, "PARRY", "#7ee8ff", 22);
    this.hurtEnemy(e, 24, p.x, p.y, 200);
  }

  private hurtEnemy(e: Enemy, dmg: number, ox: number, oy: number, force: number) {
    if (e.dead) return;
    e.hp -= dmg;
    e.state = "hurt";
    e.stateT = 0;
    e.hurtT = 0.16;
    e.flash = 1;
    knock(e, ox, oy, force);
    this.audio.hit();
    this.burst(e.x, e.y, 10, "spark", e.kind === "naga" ? "#7cff6b" : "#ff8a3d");
    this.float(e.x, e.y - 30, `${Math.round(dmg)}`, "#ffe08a", 16);
    this.addCombo(1);
    this.player.mass = Math.min(100, this.player.mass + (this.player.elevateT > 0 ? 0 : 4.2));
    this.score += Math.round(dmg * 2.2 * this.comboMul);
    if (e.elite && e.hp <= e.maxHp * 0.12 && !e.staggerUsed) {
      e.staggerUsed = true;
      e.stagger = 6;
      if (e.hp <= 0) e.hp = 1;
      e.state = "idle";
      e.stateT = 0;
      this.cam.mode = "orbit";
      this.cam.modeT = 0.8;
      this.cam.timeScale = 0.45;
      this.banner = {
        title: "THE WILL BENDS",
        sub: "Stand close · PARY / F — pacify, or strike to end it",
        t: 0,
        max: 2.6,
        style: "elevate",
      };
      this.ring(e.x, e.y, "#ffd54f", 140);
      this.audio.whistle(0.1);
      return;
    }
    if (e.hp <= 0) this.kill(e);
  }

  private pacify(e: Enemy) {
    e.dead = true;
    e.state = "dead";
    e.stateT = 0;
    e.stagger = 0;
    this.pacified++;
    this.kills++;
    this.score += Math.round(e.score * 1.6 * this.comboMul);
    this.addCombo(4);
    const p = this.player;
    p.mass = 100;
    p.hp = Math.min(p.maxHp, p.hp + 25);
    this.cam.mode = "orbit";
    this.cam.modeT = 1.2;
    this.cam.timeScale = 0.4;
    this.cam.flash = 0.5;
    this.cam.flashCol = "#ffdf8a";
    this.cam.hitstop = 0.12;
    this.cam.letter = 0.22;
    this.shake(14);
    this.burst(e.x, e.y, 60, "akshata", "#ffd54f");
    this.burst(e.x, e.y, 30, "soul", "#c084fc");
    this.ring(e.x, e.y, "#ffd54f", 200);
    this.ring(e.x, e.y, "#00e5ff", 120);
    this.audio.choir();
    this.audio.whistle(0.15);
    this.banner = {
      title: "PACIFIED",
      sub: "\"The freedom to walk among the trees again\"",
      t: 0,
      max: 2.4,
      style: "elevate",
    };
    this.float(e.x, e.y - 50, "REDEEMED", "#ffd54f", 26);
  }

  private staggeredNear(x: number, y: number, maxd: number) {
    let best: Enemy | null = null;
    let bd = maxd;
    for (const e of this.enemies) {
      if (e.dead || e.stagger <= 0) continue;
      const d = len(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private kill(e: Enemy) {
    e.dead = true;
    e.state = "dead";
    e.stateT = 0;
    e.hp = 0;
    this.kills++;
    this.player.kills++;
    this.score += e.score * this.comboMul;
    this.addCombo(2);
    this.player.mass = Math.min(100, this.player.mass + 8);
    this.burst(e.x, e.y, 22, "soul", "#c084fc");
    this.burst(e.x, e.y, 10, "ember", "#ff6d00");
    this.ring(e.x, e.y, "#ffb300", 50);
    this.audio.crit();
    if (e.elite) {
      this.shake(20);
      this.cam.flash = 0.45;
      this.cam.flashCol = "#ffd54f";
      this.banner = {
        title: `${(BOSS_NAMES[e.kind] || "THE ASURA").split(",")[0]} FALLS`,
        sub: "The path opens. The pact holds.",
        t: 0,
        max: 2.2,
        style: "boss",
      };
      this.burst(e.x, e.y, 40, "akshata", "#ffd54f");
    }
  }

  private die() {
    this.player.dead = true;
    this.player.hp = 0;
    this.mode = "gameover";
    this.cam.timeScale = 0.3;
    this.cam.letter = 0.22;
    this.cam.grade = 0.2;
    this.cam.flash = 0.5;
    this.cam.flashCol = "#5a1020";
    this.audio.death();
    this.audio.setCombat(false);
    this.banner = { title: "THE PACT BREAKS", sub: "R to rise again", t: 0, max: 2.4, style: "kill" };
  }

  private updateShots(dt: number) {
    for (const s of this.shots) {
      s.life -= dt;
      if (s.kind === "chakra") {
        const tgt = this.nearestNot(s.x, s.y, 480, s.hit);
        if (tgt) {
          const a = ang(tgt.x - s.x, tgt.y - s.y);
          s.vx = lerp(s.vx, Math.cos(a) * 680, 0.18);
          s.vy = lerp(s.vy, Math.sin(a) * 680, 0.18);
        }
        this.parts.push({
          x: s.x,
          y: s.y,
          vx: rand(-20, 20),
          vy: rand(-20, 20),
          life: 0.25,
          max: 0.25,
          size: 5,
          color: "#7ee8ff",
          kind: "spark",
          rot: 0,
          spin: 8,
        });
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      if (s.from === "player") {
        for (const e of this.enemies) {
          if (e.dead || s.hit.has(e.id)) continue;
          if (len(e.x - s.x, e.y - s.y) < e.r + s.r) {
            s.hit.add(e.id);
            this.hurtEnemy(e, s.dmg, s.x, s.y, 200);
            this.audio.chakraHit();
            s.bounces--;
            if (s.kind === "chakra" && s.hit.size >= 3 && !this.killcam) {
              this.killcam = s;
              this.cam.mode = "killcam";
              this.cam.modeT = 0.7;
            }
            if (s.bounces < 0) s.life = 0;
          }
        }
      } else if (!this.player.dead) {
        if (len(this.player.x - s.x, this.player.y - s.y) < this.player.r + s.r) {
          if (this.player.state === "parry") {
            s.life = 0;
            this.perfectParry(this.dummyNear(s.x, s.y));
          } else {
            s.life = 0;
            this.tryHitPlayer(this.dummyNear(s.x, s.y), s.dmg, s.x, s.y);
          }
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0 && s.x > -40 && s.y > -40 && s.x < WORLD_W + 40 && s.y < WORLD_H + 40);
    if (this.killcam && this.killcam.life <= 0) this.killcam = null;
  }

  private dummyNear(x: number, y: number): Enemy {
    return (
      this.nearest(x, y, 9999) || {
        x,
        y,
        vx: 0,
        vy: 0,
        r: 20,
        hp: 1,
        maxHp: 1,
        facing: 0,
        state: "idle",
        stateT: 0,
        hurtT: 0,
        flash: 0,
        dead: true,
        z: 0,
        id: -1,
        kind: "asura",
        dmg: 8,
        speed: 0,
        atkRange: 0,
        windup: 0.2,
        strikeT: 0.1,
        recover: 0.2,
        cooldown: 1,
        cd: 1,
        score: 0,
        telegraph: 0,
        elite: false,
        phase: 0,
        stagger: 0,
        staggerUsed: false,
        slam: 0,
      }
    );
  }

  private checkWave(dt: number) {
    this.waveT += dt;
    if (this.spawning) return;
    if (this.enemies.every((e) => e.dead)) {
      this.spawning = true;
      this.score += 250 * this.wave;
      const gen = this.gen;
      window.setTimeout(() => {
        if (this.gen !== gen || this.mode !== "playing") return;
        this.nextWave();
        this.spawning = false;
      }, 700);
    }
  }

  private nextWave() {
    this.wave++;
    const w = this.wave;
    this.cam.letter = 0.12;
    this.audio.wave();
    if (w % 5 === 0) {
      const kind = BOSS_CYCLE[(w / 5 - 1) % BOSS_CYCLE.length];
      this.banner = {
        title: BOSS_NAMES[kind] || "THE ASURA",
        sub: BOSS_QUOTES[kind] || "A god-killer approaches",
        t: 0,
        max: 2.4,
        style: "boss",
      };
      this.cam.mode = "godseye";
      this.cam.modeT = 1.1;
      this.audio.boss();
      this.spawn(kind, WORLD_W / 2, 180);
      if (kind === "maha" || kind === "rudra") {
        for (let i = 0; i < 3; i++) this.spawn("asura");
      }
    } else {
      this.banner = { title: `WAVE ${w}`, sub: this.waveLine(w), t: 0, max: 1.4, style: "wave" };
      const n = 3 + Math.floor(w * 1.4);
      for (let i = 0; i < n; i++) {
        const roll = Math.random();
        let kind: EnemyKind = "asura";
        if (w >= 2 && roll > 0.72) kind = "archer";
        if (w >= 3 && roll > 0.86) kind = "brute";
        if (w >= 7 && roll > 0.93) kind = "brute";
        this.spawn(kind);
      }
    }
  }

  private waveLine(w: number) {
    const lines = [
      "The forest remembers",
      "Dust and blood",
      "Do not blink",
      "Hold the line",
      "The desert drinks",
      "Cut the chorus",
      "No mercy in Patal",
      "Walk like a god",
    ];
    return lines[(w - 1) % lines.length];
  }

  private spawn(kind: EnemyKind, sx?: number, sy?: number) {
    const edge = pick([0, 1, 2, 3]);
    let x = sx ?? 80;
    let y = sy ?? 80;
    if (sx == null) {
      if (edge === 0) {
        x = rand(80, WORLD_W - 80);
        y = 70;
      } else if (edge === 1) {
        x = rand(80, WORLD_W - 80);
        y = WORLD_H - 70;
      } else if (edge === 2) {
        x = 70;
        y = rand(80, WORLD_H - 80);
      } else {
        x = WORLD_W - 70;
        y = rand(80, WORLD_H - 80);
      }
    }
    const stats: Record<EnemyKind, Partial<Enemy>> = {
      asura: { r: 20, hp: 36 + this.wave * 6, speed: 118 + this.wave * 3, dmg: 10, atkRange: 42, windup: 0.32, strikeT: 0.14, recover: 0.28, cooldown: 0.7, score: 120 },
      brute: { r: 32, hp: 110 + this.wave * 14, speed: 72, dmg: 20, atkRange: 56, windup: 0.55, strikeT: 0.2, recover: 0.45, cooldown: 1.1, score: 280 },
      archer: { r: 18, hp: 24 + this.wave * 4, speed: 96, dmg: 9, atkRange: 300, windup: 0.4, strikeT: 0.1, recover: 0.35, cooldown: 1.3, score: 160 },
      vetal: { r: 46, hp: 400 + this.wave * 26, speed: 96, dmg: 22, atkRange: 74, windup: 0.5, strikeT: 0.22, recover: 0.5, cooldown: 0.8, score: 1400 },
      commander: { r: 30, hp: 360 + this.wave * 20, speed: 158, dmg: 18, atkRange: 52, windup: 0.26, strikeT: 0.12, recover: 0.3, cooldown: 0.5, score: 1500 },
      rudra: { r: 36, hp: 520 + this.wave * 26, speed: 104, dmg: 22, atkRange: 260, windup: 0.4, strikeT: 0.15, recover: 0.35, cooldown: 0.9, score: 2000 },
      naga: { r: 48, hp: 420 + this.wave * 30, speed: 100, dmg: 24, atkRange: 70, windup: 0.42, strikeT: 0.22, recover: 0.4, cooldown: 0.7, score: 1600 },
      maha: { r: 58, hp: 860 + this.wave * 40, speed: 88, dmg: 28, atkRange: 78, windup: 0.48, strikeT: 0.24, recover: 0.42, cooldown: 0.65, score: 4000 },
    };
    const s = stats[kind];
    const e: Enemy = {
      id: nid++,
      x,
      y,
      vx: 0,
      vy: 0,
      r: s.r!,
      hp: s.hp!,
      maxHp: s.hp!,
      facing: 0,
      state: "idle",
      stateT: 0,
      hurtT: 0,
      flash: 0,
      dead: false,
      z: 0,
      kind,
      dmg: s.dmg!,
      speed: s.speed!,
      atkRange: s.atkRange!,
      windup: s.windup!,
      strikeT: s.strikeT!,
      recover: s.recover!,
      cooldown: s.cooldown!,
      cd: 0.4,
      score: s.score!,
      telegraph: 0,
      elite: BOSS_CYCLE.includes(kind),
      phase: 0,
      stagger: 0,
      staggerUsed: false,
      slam: 0,
    };
    this.enemies.push(e);
    this.burst(x, y, 8, "dust", "#6b3a1f");
  }

  private addCombo(n: number) {
    this.combo += n;
    this.comboT = 2.4;
    this.comboMul = 1 + Math.floor(this.combo / 8) * 0.25;
    if (this.combo > 0 && this.combo % 12 === 0) {
      this.float(this.player.x, this.player.y - 60, `${this.combo} HIT`, "#ffd54f", 20);
      this.shake(6);
    }
  }

  private integrate(a: { x: number; y: number; vx: number; vy: number }, dt: number) {
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.vx *= 0.86;
    a.vy *= 0.86;
  }

  private bound(a: { x: number; y: number; r: number }) {
    a.x = clamp(a.x, 50, WORLD_W - 50);
    a.y = clamp(a.y, 50, WORLD_H - 50);
  }

  private sep(e: Enemy) {
    for (const o of this.enemies) {
      if (o === e || o.dead) continue;
      const d = len(o.x - e.x, o.y - e.y);
      const min = e.r + o.r - 4;
      if (d < min && d > 0) {
        const p = ((min - d) / d) * 0.35;
        e.x -= (o.x - e.x) * p;
        e.y -= (o.y - e.y) * p;
      }
    }
  }

  private nearest(x: number, y: number, maxd: number) {
    let best: Enemy | null = null;
    let bd = maxd;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = len(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private nearestNot(x: number, y: number, maxd: number, hit: Set<number>) {
    let best: Enemy | null = null;
    let bd = maxd;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (hit.has(e.id)) continue;
      const d = len(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private shock(x: number, y: number, r: number, dmg: number) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (len(e.x - x, e.y - y) < r + e.r) this.hurtEnemy(e, dmg, x, y, 300);
    }
  }

  private updateParts(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.kind === "dust" || p.kind === "ember") p.vy += 40 * dt;
      if (p.kind === "akshata") {
        p.vx += Math.sin(p.life * 12) * 20 * dt;
        p.vy -= 18 * dt;
      }
      if (p.kind === "ring") p.size += dt * 220;
    }
    if (this.parts.length > 420) this.parts.splice(0, this.parts.length - 420);
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  private updateFloats(dt: number) {
    for (const f of this.floats) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.96;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  private updateCam(dt: number) {
    const p = this.player;
    this.cam.modeT = Math.max(0, this.cam.modeT - dt);
    this.cam.flash = Math.max(0, this.cam.flash - dt);
    this.cam.trauma = Math.max(0, this.cam.trauma - dt * 2.4);
    if (this.cam.modeT <= 0) this.cam.mode = "follow";

    let tx = p.x;
    let ty = p.y;
    let tz = 1.08;
    let rot = 0;
    let tilt = 0;
    let letter = this.mode === "playing" ? 0.04 : 0.16;

    if (this.cam.mode === "snap") {
      tx = this.cam.focusX;
      ty = this.cam.focusY;
      tz = 1.55;
      letter = 0.14;
    } else if (this.cam.mode === "worship") {
      ty = p.y + 30;
      tz = 1.42;
      letter = 0.18;
    } else if (this.cam.mode === "orbit") {
      const a = this.time * 3.2;
      tx = p.x + Math.cos(a) * 40;
      ty = p.y + Math.sin(a) * 24;
      tz = 1.3;
      rot = Math.sin(this.time * 2) * 0.05;
    } else if (this.cam.mode === "godseye") {
      tz = 0.62;
      letter = 0.2;
    } else if (this.cam.mode === "killcam" && this.killcam) {
      tx = this.killcam.x;
      ty = this.killcam.y;
      tz = 1.45;
      letter = 0.16;
    } else {
      const n = this.nearest(p.x, p.y, 260);
      if (n) {
        tx = lerp(p.x, n.x, 0.18);
        ty = lerp(p.y, n.y, 0.18);
      }
    }

    if (p.elevateT > 0 && this.cam.mode === "follow") {
      tz = 1.18;
      tilt = 0.03;
      letter = 0.1;
    }

    this.cam.x = lerp(this.cam.x, tx, 0.12);
    this.cam.y = lerp(this.cam.y, ty, 0.12);
    this.cam.zoom = lerp(this.cam.zoom, tz, 0.1);
    this.cam.rot = lerp(this.cam.rot, rot, 0.1);
    this.cam.tilt = lerp(this.cam.tilt, tilt, 0.1);
    this.cam.letter = lerp(this.cam.letter, letter, 0.08);
    if (this.cam.timeScale < 1 && this.cam.mode === "follow") {
      this.cam.timeScale = lerp(this.cam.timeScale, 1, 0.08);
    }
  }

  private shake(n: number) {
    this.cam.trauma = Math.min(18, this.cam.trauma + n);
  }

  burst(x: number, y: number, n: number, kind: Particle["kind"], color: string) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 260);
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.25, 0.7),
        max: 0.7,
        size: rand(2, 7),
        color,
        kind,
        rot: rand(0, 6),
        spin: rand(-8, 8),
      });
    }
  }

  ring(x: number, y: number, color: string, size: number) {
    this.parts.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.35,
      max: 0.35,
      size,
      color,
      kind: "ring",
      rot: 0,
      spin: 0,
    });
  }

  private slashFx(x: number, y: number, facing: number, heavy: boolean) {
    this.parts.push({
      x,
      y,
      vx: Math.cos(facing) * 20,
      vy: Math.sin(facing) * 20,
      life: 0.16,
      max: 0.16,
      size: heavy ? 70 : 48,
      color: this.player.elevateT > 0 ? "#7ee8ff" : "#ffe08a",
      kind: "slash",
      rot: facing,
      spin: 0,
    });
    this.burst(x, y, heavy ? 16 : 8, "spark", this.player.elevateT > 0 ? "#00e5ff" : "#ffd54f");
  }

  private after(x: number, y: number) {
    this.parts.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.22,
      max: 0.22,
      size: 20,
      color: "#7ee8ff",
      kind: "after",
      rot: this.player.facing,
      spin: 0,
    });
  }

  private float(x: number, y: number, text: string, color: string, size: number) {
    this.floats.push({ x, y, vy: -46, text, life: 0.7, max: 0.7, color, size });
  }

  private spawnAmbient() {
    if (Math.random() < 0.4) {
      this.parts.push({
        x: rand(0, WORLD_W),
        y: rand(0, WORLD_H),
        vx: rand(-20, 20),
        vy: rand(-30, -8),
        life: 1.6,
        max: 1.6,
        size: rand(1, 3),
        color: "#ffd54f",
        kind: "dust",
        rot: 0,
        spin: 1,
      });
    }
  }
}

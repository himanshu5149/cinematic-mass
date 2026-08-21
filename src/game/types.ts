export type GameMode = "boot" | "title" | "playing" | "paused" | "gameover";

export type EnemyKind = "asura" | "brute" | "archer" | "vetal" | "commander" | "rudra" | "naga" | "maha";

export type ActorState =
  | "idle"
  | "run"
  | "windup"
  | "strike"
  | "recover"
  | "hurt"
  | "dead"
  | "dash"
  | "parry"
  | "cast";

export interface Vec {
  x: number;
  y: number;
}

export interface Actor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  facing: number;
  state: ActorState;
  stateT: number;
  hurtT: number;
  flash: number;
  dead: boolean;
  z: number;
}

export interface Player extends Actor {
  comboStep: number;
  comboT: number;
  dashCd: number;
  parryCd: number;
  chakraCd: number;
  invuln: number;
  attacking: number;
  lunge: number;
  mass: number;
  elevateT: number;
  kills: number;
}

export interface Enemy extends Actor {
  id: number;
  kind: EnemyKind;
  dmg: number;
  speed: number;
  atkRange: number;
  windup: number;
  strikeT: number;
  recover: number;
  cooldown: number;
  cd: number;
  score: number;
  telegraph: number;
  elite: boolean;
  phase: number;
  stagger: number;
  staggerUsed: boolean;
  slam: number;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  from: "player" | "enemy";
  kind: "chakra" | "bolt" | "spit";
  bounces: number;
  hit: Set<number>;
  glow: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: "spark" | "dust" | "ring" | "ember" | "akshata" | "slash" | "soul" | "after";
  rot: number;
  spin: number;
}

export interface Floater {
  x: number;
  y: number;
  vy: number;
  text: string;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  rot: number;
  tilt: number;
  trauma: number;
  flash: number;
  flashCol: string;
  grade: number;
  letter: number;
  mode: "follow" | "snap" | "orbit" | "worship" | "godseye" | "killcam";
  modeT: number;
  focusX: number;
  focusY: number;
  timeScale: number;
  hitstop: number;
}

export interface Banner {
  title: string;
  sub: string;
  t: number;
  max: number;
  style: "wave" | "elevate" | "parry" | "boss" | "kill";
}

export interface HighScore {
  name: string;
  score: number;
  wave: number;
  kills: number;
  title: string;
  at: number;
}

export interface Snapshot {
  mode: GameMode;
  score: number;
  combo: number;
  comboMul: number;
  wave: number;
  hp: number;
  maxHp: number;
  mass: number;
  elevateT: number;
  dashCd: number;
  dashMax: number;
  parryCd: number;
  parryMax: number;
  chakraCd: number;
  chakraMax: number;
  kills: number;
  banner: Banner | null;
  boss: { name: string; hp: number; maxHp: number } | null;
  highScores: HighScore[];
  initials: string;
  saved: boolean;
  pacified: number;
}

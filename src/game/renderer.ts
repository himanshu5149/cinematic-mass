import { Game, WORLD_H, WORLD_W } from "./engine";
import type { Enemy, Player } from "./types";

export interface Assets {
  title: HTMLImageElement;
  arena: HTMLImageElement;
  portrait: HTMLImageElement;
  sigil: HTMLImageElement;
  raji: HTMLCanvasElement;
  asura: HTMLCanvasElement;
  naga: HTMLCanvasElement;
  boss: HTMLCanvasElement;
  vetal: HTMLCanvasElement;
  rudra: HTMLCanvasElement;
}

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

function punchKey(img: HTMLImageElement, thr = 28) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const m = Math.max(r, g, b);
    if (m < thr) d[i + 3] = 0;
    else if (m < thr * 2.2) d[i + 3] = Math.min(d[i + 3], ((m - thr) / (thr * 1.2)) * 255);
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

export async function loadAssets(): Promise<Assets> {
  const [title, arena, portrait, sigil, raji, asura, naga, boss, vetal, rudra] = await Promise.all([
    loadImg("/images/title-bg.jpg"),
    loadImg("/images/arena-bg.jpg"),
    loadImg("/images/raji-portrait.jpg"),
    loadImg("/images/sigil.jpg"),
    loadImg("/images/raji-sprite.png"),
    loadImg("/images/asura-sprite.png"),
    loadImg("/images/naga-sprite.png"),
    loadImg("/images/boss-sprite.png"),
    loadImg("/images/vetal-sprite.png"),
    loadImg("/images/rudra-sprite.png"),
  ]);
  return {
    title,
    arena,
    portrait,
    sigil,
    raji: punchKey(raji, 22),
    asura: punchKey(asura, 24),
    naga: punchKey(naga, 22),
    boss: punchKey(boss, 22),
    vetal: punchKey(vetal, 24),
    rudra: punchKey(rudra, 22),
  };
}

export class Renderer {
  ctx: CanvasRenderingContext2D;
  assets: Assets;
  w = 1280;
  h = 720;
  t = 0;

  constructor(ctx: CanvasRenderingContext2D, assets: Assets) {
    this.ctx = ctx;
    this.assets = assets;
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  draw(g: Game, dt: number) {
    this.t += dt;
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cam = g.cam;
    const shake = cam.trauma;
    const sx = (Math.random() - 0.5) * shake * 2.2;
    const sy = (Math.random() - 0.5) * shake * 2.2;
    const tilt = cam.tilt + cam.rot;

    ctx.save();
    ctx.translate(w / 2 + sx, h / 2 + sy);
    ctx.rotate(tilt);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this.drawWorld(g);
    this.drawGroundFx(g);
    const actors = [
      ...g.enemies.map((e) => ({ z: e.y, draw: () => this.drawEnemy(e) })),
      { z: g.player.y, draw: () => this.drawPlayer(g) },
    ].sort((a, b) => a.z - b.z);
    for (const a of actors) a.draw();
    this.drawShots(g);
    this.drawParts(g, "front");
    ctx.restore();

    this.drawGrade(g);
    this.drawVignette(g);
    this.drawFlash(g);
    this.drawLetter(g);
    this.drawFloats(g);
    if (g.mode === "title") this.drawTitleVeil(g);
  }

  private drawWorld(g: Game) {
    const ctx = this.ctx;
    ctx.drawImage(this.assets.arena, -80, -80, WORLD_W + 160, WORLD_H + 160);
    ctx.fillStyle = "rgba(12, 6, 18, 0.28)";
    ctx.fillRect(-80, -80, WORLD_W + 160, WORLD_H + 160);

    if (g.player.elevateT > 0 || g.cam.grade > 0.4) {
      ctx.fillStyle = `rgba(0, 80, 110, ${0.12 * g.cam.grade})`;
      ctx.fillRect(-80, -80, WORLD_W + 160, WORLD_H + 160);
    }

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = "#ffd54f";
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, WORLD_W - 72, WORLD_H - 72);
    ctx.restore();

    this.drawRuins();
  }

  private drawRuins() {
    const ctx = this.ctx;
    const pillars = [
      [160, 180],
      [1580, 220],
      [240, 900],
      [1520, 860],
      [880, 140],
      [980, 980],
    ];
    for (const [x, y] of pillars) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(x, y + 70, 28, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      const grd = ctx.createLinearGradient(x, y - 90, x, y + 60);
      grd.addColorStop(0, "#c4a07a");
      grd.addColorStop(1, "#6b4226");
      ctx.fillStyle = grd;
      ctx.fillRect(x - 16, y - 90, 32, 150);
      ctx.fillStyle = "#d4b896";
      ctx.fillRect(x - 22, y - 100, 44, 16);
      ctx.restore();
    }
  }

  private drawGroundFx(g: Game) {
    const ctx = this.ctx;
    for (const p of g.parts) {
      if (p.kind === "ring") {
        const a = p.life / p.max;
        ctx.save();
        ctx.globalAlpha = a * 0.85;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * a + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    for (const e of g.enemies) {
      if (e.stagger > 0 && !e.dead) {
        const puls = 0.55 + Math.sin(this.t * 9) * 0.25;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = puls;
        const hg = ctx.createRadialGradient(e.x, e.y - 12, 4, e.x, e.y - 12, e.r * 2.6);
        hg.addColorStop(0, "#ffd54f99");
        hg.addColorStop(1, "transparent");
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(e.x, e.y - 12, e.r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffd54f";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 + Math.sin(this.t * 5) * 0.2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 14 + Math.sin(this.t * 4) * 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (e.telegraph > 0 && !e.dead) {
        const a = 0.35 + Math.sin(this.t * 24) * 0.15;
        const teleR = e.slam ? 150 : e.atkRange + 8;
        ctx.save();
        ctx.globalAlpha = a * (e.slam ? 1.2 : 1);
        ctx.fillStyle = e.slam ? "#ff5e00" : "#ff2040";
        ctx.beginPath();
        ctx.arc(e.x, e.y, teleR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffd0d0";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }
    this.drawParts(g, "back");
  }

  private shadow(x: number, y: number, r: number, a = 0.35) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 10, r, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlayer(g: Game) {
    const p = g.player;
    const ctx = this.ctx;
    this.shadow(p.x, p.y, 22, 0.4);
    if (p.elevateT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(this.t * 8) * 0.1;
      const halo = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, 70);
      halo.addColorStop(0, "#00e5ff88");
      halo.addColorStop(1, "#00e5ff00");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 20, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const bob = p.state === "run" ? Math.sin(this.t * 16) * 2.4 : Math.sin(this.t * 3) * 1.2;
    const flip = Math.cos(p.facing) < 0 ? -1 : 1;
    const lean = p.state === "dash" ? 0.18 : p.state === "strike" ? 0.12 : 0;
    const h = p.hurtT > 0 ? 8 : 0;

    ctx.save();
    ctx.translate(p.x + h, p.y + bob);
    ctx.rotate(lean * flip);
    ctx.scale(flip, 1);
    if (p.flash > 0) ctx.filter = "brightness(2.4) saturate(0.4)";
    else if (p.invuln > 0 && Math.floor(this.t * 20) % 2 === 0) ctx.globalAlpha = 0.55;
    const spr = this.assets.raji;
    const sh = 118;
    const sw = (spr.width / spr.height) * sh;
    ctx.drawImage(spr, -sw / 2, -sh + 14, sw, sh);
    ctx.filter = "none";
    ctx.restore();

    this.drawTrishulaGlow(p);
    if (p.state === "parry") {
      ctx.save();
      ctx.strokeStyle = "#7ee8ff";
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 34 + Math.sin(this.t * 30) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawTrishulaGlow(p: Player) {
    const ctx = this.ctx;
    const a = p.facing;
    const hx = p.x + Math.cos(a) * 26;
    const hy = p.y - 28 + Math.sin(a) * 10;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.55 + Math.sin(this.t * 10) * 0.15;
    const grd = ctx.createRadialGradient(hx, hy, 2, hx, hy, 22);
    grd.addColorStop(0, "#e0ffff");
    grd.addColorStop(1, "#00e5ff00");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(hx, hy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawEnemy(e: Enemy) {
    const ctx = this.ctx;
    this.shadow(e.x, e.y, e.r, e.dead ? 0.12 : 0.38);
    if (e.dead) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - e.stateT * 1.3);
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.min(1.2, e.stateT * 2) * (Math.cos(e.facing) < 0 ? -1 : 1));
      this.blitEnemy(e, 0.85);
      ctx.restore();
      return;
    }

    const bob = e.state === "run" ? Math.sin(this.t * 12 + e.x) * 2 : 0;
    const flip = Math.cos(e.facing) < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(e.x, e.y + bob);
    ctx.scale(flip, 1);
    if (e.flash > 0) ctx.filter = "brightness(2.6)";
    const scale = e.kind === "maha" ? 1.55 : e.kind === "naga" ? 1.35 : e.kind === "brute" ? 1.18 : e.kind === "archer" ? 0.9 : 1;
    this.blitEnemy(e, scale);
    ctx.filter = "none";
    ctx.restore();

    if (e.hp < e.maxHp) {
      const bw = e.r * 2.2;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 28, bw, 5);
      ctx.fillStyle = e.elite ? "#ffd54f" : "#ff4d4d";
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 28, bw * (e.hp / e.maxHp), 5);
    }
  }

  private blitEnemy(e: Enemy, scale: number) {
    const ctx = this.ctx;
    let spr = this.assets.asura;
    if (e.kind === "naga") spr = this.assets.naga;
    if (e.kind === "maha" || e.kind === "commander") spr = this.assets.boss;
    if (e.kind === "vetal") spr = this.assets.vetal;
    if (e.kind === "rudra") spr = this.assets.rudra;
    if (e.kind === "commander") ctx.filter = "hue-rotate(-30deg) saturate(1.5) brightness(0.95)";
    const sh = (e.kind === "maha" ? 150 : e.kind === "naga" ? 132 : e.kind === "vetal" ? 138 : e.kind === "rudra" ? 122 : e.kind === "brute" ? 108 : 86) * scale;
    const sw = (spr.width / spr.height) * sh;
    ctx.drawImage(spr, -sw / 2, -sh + 16, sw, sh);
    ctx.filter = "none";
    if (e.stagger > 0 && !e.dead) {
      ctx.font = "700 13px Cinzel, serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd54f";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 6;
      ctx.globalAlpha = 0.75 + Math.sin(this.t * 10) * 0.25;
      ctx.fillText("PACIFY · F", 0, -sh - 4);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    if (e.kind === "archer") {
      ctx.fillStyle = "#6b1d1d";
      ctx.fillRect(sw * 0.15, -sh * 0.45, 18, 4);
    }
  }

  private drawShots(g: Game) {
    const ctx = this.ctx;
    for (const s of g.shots) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.globalCompositeOperation = "lighter";
      const grd = ctx.createRadialGradient(0, 0, 1, 0, 0, s.r * 2.4);
      grd.addColorStop(0, "#fff");
      grd.addColorStop(0.3, s.glow);
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, s.r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (s.kind === "chakra") {
        ctx.rotate(this.t * 16);
        ctx.strokeStyle = "#e0ffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
          ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  private drawParts(g: Game, layer: "back" | "front") {
    const ctx = this.ctx;
    for (const p of g.parts) {
      if (p.kind === "ring") continue;
      const back = p.kind === "dust" || p.kind === "ember" || p.kind === "after";
      if (layer === "back" && !back) continue;
      if (layer === "front" && back) continue;
      const a = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = a;
      if (p.kind === "spark" || p.kind === "soul" || p.kind === "akshata") {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (p.kind === "akshata" ? 0.7 : 1), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "slash") {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 7 * a;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, -1.1, 1.1);
        ctx.stroke();
      } else if (p.kind === "after") {
        ctx.globalAlpha = a * 0.35;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, -16, 14, 22, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }

  private drawGrade(g: Game) {
    const ctx = this.ctx;
    const { w, h } = this;
    if (g.cam.grade <= 0.02 && g.player.elevateT <= 0) return;
    const k = Math.max(g.cam.grade, g.player.elevateT > 0 ? 0.7 : 0);
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, `rgba(0, 200, 220, ${0.28 * k})`);
    grd.addColorStop(0.5, `rgba(20, 10, 0, ${0.05 * k})`);
    grd.addColorStop(1, `rgba(255, 110, 20, ${0.32 * k})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private drawVignette(g: Game) {
    const ctx = this.ctx;
    const { w, h } = this;
    const grd = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.78);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, `rgba(6,2,10,${g.mode === "gameover" ? 0.82 : 0.62})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }

  private drawFlash(g: Game) {
    if (g.cam.flash <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = Math.min(0.75, g.cam.flash);
    ctx.fillStyle = g.cam.flashCol;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  private drawLetter(g: Game) {
    const ctx = this.ctx;
    const bar = this.h * g.cam.letter;
    ctx.fillStyle = "#050208";
    ctx.fillRect(0, 0, this.w, bar);
    ctx.fillRect(0, this.h - bar, this.w, bar);
  }

  private drawFloats(g: Game) {
    const ctx = this.ctx;
    const cam = g.cam;
    for (const f of g.floats) {
      const a = f.life / f.max;
      const sx = (f.x - cam.x) * cam.zoom + this.w / 2;
      const sy = (f.y - cam.y) * cam.zoom + this.h / 2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color;
      ctx.font = `700 ${f.size}px Cinzel, serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 8;
      ctx.fillText(f.text, sx, sy);
      ctx.restore();
    }
  }

  private drawTitleVeil(_g: Game) {
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.save();
    ctx.fillStyle = "rgba(7,4,13,0.35)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.72;
    ctx.drawImage(this.assets.title, 0, 0, w, h);
    ctx.restore();
    const pulse = 0.5 + Math.sin(this.t * 1.4) * 0.08;
    ctx.save();
    ctx.globalAlpha = pulse * 0.22;
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(this.assets.sigil, w / 2 - 220, h / 2 - 240, 440, 440);
    ctx.restore();
  }
}

export function worldToScreen(g: Game, x: number, y: number, w: number, h: number) {
  return {
    x: (x - g.cam.x) * g.cam.zoom + w / 2,
    y: (y - g.cam.y) * g.cam.zoom + h / 2,
  };
}

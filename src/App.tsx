import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "./game/audio";
import { Game } from "./game/engine";
import { loadAssets, Renderer } from "./game/renderer";
import type { Snapshot } from "./game/types";
import { titleForScore } from "./game/scores";

const emptySnap = (): Snapshot => ({
  mode: "boot",
  score: 0,
  combo: 0,
  comboMul: 1,
  wave: 0,
  hp: 100,
  maxHp: 100,
  mass: 0,
  elevateT: 0,
  dashCd: 0,
  dashMax: 1,
  parryCd: 0,
  parryMax: 1,
  chakraCd: 0,
  chakraMax: 1,
  kills: 0,
  banner: null,
  boss: null,
  highScores: [],
  initials: "RAJ",
  saved: false,
  pacified: 0,
});

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const audioRef = useRef(new AudioEngine());
  const stickRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snapshot>(emptySnap);
  const [loaded, setLoaded] = useState(false);
  const [fail, setFail] = useState("");
  const [touch, setTouch] = useState(false);
  const [muted, setMuted] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });
  const pid = useRef<number | null>(null);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    setTouch(coarse);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let dead = false;
    let raf = 0;
    const audio = audioRef.current;

    const boot = async () => {
      try {
        const assets = await loadAssets();
        if (dead) return;
        const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
        if (!ctx) throw new Error("No canvas");
        const game = new Game(audio);
        const renderer = new Renderer(ctx, assets);
        gameRef.current = game;
        game.toTitle();
        setSnap(game.snapshot());
        setLoaded(true);

        const fit = () => {
          const r = wrap.getBoundingClientRect();
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          canvas.width = Math.max(2, Math.floor(r.width * dpr));
          canvas.height = Math.max(2, Math.floor(r.height * dpr));
          canvas.style.width = `${r.width}px`;
          canvas.style.height = `${r.height}px`;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          renderer.resize(r.width, r.height);
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(wrap);

        let last = performance.now();
        let acc = 0;
        const loop = (now: number) => {
          if (dead) return;
          const dt = Math.min(0.033, (now - last) / 1000);
          last = now;
          game.update(dt);
          renderer.draw(game, dt);
          acc += dt;
          if (acc > 0.08 || game.mode !== snapMode) {
            acc = 0;
            snapMode = game.mode;
            setSnap(game.snapshot());
          }
          raf = requestAnimationFrame(loop);
        };
        let snapMode = game.mode;
        raf = requestAnimationFrame(loop);

        return () => ro.disconnect();
      } catch (e) {
        setFail(e instanceof Error ? e.message : "Failed to load");
      }
    };

    let cleanup: void | (() => void);
    void boot().then((c) => {
      cleanup = c;
    });
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, []);

  const unlock = useCallback(() => {
    audioRef.current.unlock();
  }, []);

  const start = useCallback(() => {
    unlock();
    gameRef.current?.start();
    setSnap(gameRef.current?.snapshot() ?? emptySnap());
  }, [unlock]);

  const restart = useCallback(() => {
    unlock();
    gameRef.current?.restart();
    setSnap(gameRef.current?.snapshot() ?? emptySnap());
  }, [unlock]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      unlock();
      if (g.mode === "title" && (e.code === "Space" || e.code === "Enter")) {
        start();
        return;
      }
      if (e.code === "KeyP" || e.code === "Escape") {
        g.togglePause();
        setSnap(g.snapshot());
        return;
      }
      if (g.mode === "gameover") {
        if (e.code === "Enter") {
          if (!g.saved) g.commitScore();
          else restart();
          setSnap(g.snapshot());
          return;
        }
        if (e.code === "KeyR" && g.saved) {
          restart();
          return;
        }
        if (e.key === "Backspace") {
          g.typeInitial("Backspace");
          setSnap(g.snapshot());
          return;
        }
        if (/^[a-zA-Z]$/.test(e.key)) {
          g.typeInitial(e.key);
          setSnap(g.snapshot());
          return;
        }
      }
      if (g.mode === "paused" && (e.code === "KeyR" || e.code === "Enter")) {
        restart();
        return;
      }
      g.press(e.code);
    };
    const up = (e: KeyboardEvent) => gameRef.current?.release(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [restart, start, unlock]);

  const setBtn = (k: keyof Game["btns"], v: boolean) => {
    const g = gameRef.current;
    if (!g) return;
    g.btns[k] = v;
  };

  const onStick = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    const g = gameRef.current;
    if (!el || !g) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let x = (clientX - cx) / (r.width * 0.42);
    let y = (clientY - cy) / (r.height * 0.42);
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    g.joy = { x, y, on: true };
    setKnob({ x, y, on: true });
  };

  const endStick = () => {
    const g = gameRef.current;
    if (g) g.joy = { x: 0, y: 0, on: false };
    setKnob({ x: 0, y: 0, on: false });
    pid.current = null;
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    audioRef.current.setMuted(next);
  };

  const playing = snap.mode === "playing";
  const showHud = playing || snap.mode === "paused";

  return (
    <div
      ref={wrapRef}
      className="grain relative h-full w-full overflow-hidden bg-[#07040d] text-amber-100"
      onPointerDown={unlock}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {!loaded && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#07040d]">
          <p className="font-epic text-3xl text-[#ffd54f] animate-pulse sm:text-5xl">RAJI</p>
          <p className="mt-3 font-cinzel tracking-[0.5em] text-xs uppercase text-amber-200/60">
            {fail || "Sealing the pact…"}
          </p>
        </div>
      )}

      {snap.mode === "title" && loaded && <TitleScreen snap={snap} onStart={start} />}

      {showHud && <HUD snap={snap} />}

      {snap.banner && playing && <BannerView banner={snap.banner} />}

      {snap.mode === "paused" && (
        <PauseScreen
          snap={snap}
          onResume={() => {
            gameRef.current?.togglePause();
            setSnap(gameRef.current?.snapshot() ?? snap);
          }}
          onRestart={restart}
        />
      )}

      {snap.mode === "gameover" && (
        <GameOverScreen
          snap={snap}
          onSave={() => {
            gameRef.current?.commitScore();
            setSnap(gameRef.current?.snapshot() ?? snap);
          }}
          onRestart={restart}
        />
      )}

      {touch && (playing || snap.mode === "paused") && (
        <TouchPad
          snap={snap}
          stickRef={stickRef}
          knob={knob}
          onStickStart={(e) => {
            pid.current = e.pointerId;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            onStick(e.clientX, e.clientY);
          }}
          onStickMove={(e) => {
            if (pid.current !== null && e.pointerId !== pid.current) return;
            onStick(e.clientX, e.clientY);
          }}
          onStickEnd={endStick}
          setBtn={setBtn}
        />
      )}

      <div className={`absolute right-3 z-40 flex gap-2 ${showHud ? "top-[6.8rem] sm:top-3 sm:right-[13.5rem]" : "top-3"}`}>
        {showHud && (
          <button
            type="button"
            onClick={() => {
              gameRef.current?.togglePause();
              setSnap(gameRef.current?.snapshot() ?? snap);
            }}
            className="rounded-full border border-amber-200/20 bg-black/40 px-3 py-1 text-[10px] tracking-[0.25em] uppercase text-amber-100/80"
          >
            {snap.mode === "paused" ? "Play" : "Pause"}
          </button>
        )}
        <button
          type="button"
          onClick={toggleMute}
          className="rounded-full border border-amber-200/20 bg-black/40 px-3 py-1 text-[10px] tracking-[0.25em] uppercase text-amber-100/80"
        >
          {muted ? "Sound Off" : "Sound On"}
        </button>
      </div>

      {playing && !touch && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 gap-4 text-[10px] tracking-[0.18em] text-amber-100/45 uppercase sm:flex">
          <span>WASD move</span>
          <span>J / Space slash</span>
          <span>K dash</span>
          <span>L chakra</span>
          <span>F parry</span>
          <span>Q elevate</span>
          <span>P pause</span>
        </div>
      )}
    </div>
  );
}

function TitleScreen({ snap, onStart }: { snap: Snapshot; onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between px-5 py-8 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#07040d]/70 via-transparent to-[#07040d]/92" />
      <header className="relative z-10 flex w-full max-w-5xl items-center justify-between text-[10px] tracking-[0.4em] text-amber-200/70 uppercase">
        <span>South Indian Mass Epic</span>
        <span>An Eternal Pact</span>
      </header>

      <div className="relative z-10 flex w-full max-w-5xl flex-1 flex-col items-center justify-center text-center">
        <img
          src="/images/raji-portrait.jpg"
          alt=""
          className="mb-5 h-24 w-24 rounded-full border-2 border-[#ffd54f]/70 object-cover shadow-[0_0_40px_#00e5ff55] sm:h-28 sm:w-28"
        />
        <p className="font-cinzel text-[11px] tracking-[0.72em] text-[#00e5ff] uppercase sm:text-xs">The Eternal Pact</p>
        <h1 className="font-epic animate-slam mt-2 text-6xl leading-none text-[#ffd54f] drop-shadow-[0_8px_24px_rgba(0,0,0,0.8)] sm:text-8xl md:text-9xl">
          RAJI
        </h1>
        <div className="mt-4 h-px w-48 bg-gradient-to-r from-transparent via-[#ffd54f] to-transparent" />
        <p className="mt-4 max-w-md font-cinzel text-sm leading-relaxed text-amber-50/80 sm:text-base">
          The forest remembers. Pull the Trishula. Break the will — or redeem it.
        </p>
        <p className="mt-1 text-[10px] tracking-[0.3em] text-[#00e5ff]/70 uppercase">
          The Avengers-grade Mass Masala Edition
        </p>
        <button
          type="button"
          onClick={onStart}
          className="animate-pulse-gold mt-8 border border-[#ffd54f]/50 bg-black/30 px-10 py-3 font-cinzel text-xs tracking-[0.48em] text-[#ffd54f] uppercase"
        >
          Press to Begin
        </button>
      </div>

      <div className="relative z-10 w-full max-w-lg hud-panel rounded-xl px-4 py-3">
        <p className="mb-2 text-center font-cinzel text-[10px] tracking-[0.4em] text-[#ffd54f] uppercase">Hall of the Pact</p>
        {snap.highScores.length === 0 ? (
          <p className="text-center text-xs text-amber-100/50">No names carved yet. Be the first Bhumi Rakshak.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {snap.highScores.slice(0, 5).map((s, i) => (
              <li key={`${s.at}-${i}`} className="flex items-baseline justify-between gap-3">
                <span className="w-6 text-[#ffd54f]">{i + 1}</span>
                <span className="w-12 font-bold tracking-widest">{s.name}</span>
                <span className="flex-1 truncate text-amber-100/60">{s.title}</span>
                <span className="tabular-nums text-[#00e5ff]">{s.score}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HUD({ snap }: { snap: Snapshot }) {
  const hp = snap.hp / snap.maxHp;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 sm:p-4">
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-3">
        <div className="hud-panel flex min-w-0 items-center gap-3 rounded-xl px-3 py-2">
          <img src="/images/raji-portrait.jpg" alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-[#ffd54f]/50" />
          <div className="w-40 sm:w-56">
            <div className="flex justify-between font-cinzel text-[10px] tracking-[0.25em] text-[#ffd54f] uppercase">
              <span>Raji</span>
              <span>
                {Math.ceil(snap.hp)}/{snap.maxHp}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#9b1020] to-[#ff6f00] transition-[width] duration-150"
                style={{ width: `${Math.max(0, hp) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/60">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-[#00838f] to-[#00e5ff] ${snap.mass >= 100 ? "animate-[meter-glow_0.8s_infinite]" : ""}`}
                style={{ width: `${snap.mass}%` }}
              />
            </div>
            <p className="mt-1 text-[9px] tracking-[0.28em] text-[#7ee8ff] uppercase">
              {snap.elevateT > 0 ? `Elevation ${snap.elevateT.toFixed(1)}s` : snap.mass >= 100 ? "Q · Elevate" : "Mass"}
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="font-cinzel text-[10px] tracking-[0.5em] text-amber-100/60 uppercase">Wave</p>
          <p className="font-epic text-3xl text-[#ffd54f] sm:text-4xl">{snap.wave}</p>
          {snap.combo > 1 && (
            <p className="font-cinzel text-sm text-[#00e5ff]">
              {snap.combo} HIT · x{snap.comboMul.toFixed(2)}
            </p>
          )}
        </div>

        <div className="hud-panel rounded-xl px-4 py-2 text-right">
          <p className="text-[10px] tracking-[0.3em] text-amber-100/50 uppercase">Score</p>
          <p className="font-cinzel text-2xl tabular-nums text-[#ffd54f]">{snap.score}</p>
          <p className="text-[10px] tracking-[0.2em] text-amber-100/50 uppercase">
            {snap.kills} slain{snap.pacified > 0 ? ` · ${snap.pacified} redeemed` : ""}
          </p>
        </div>
      </div>

      {snap.boss && (
        <div className="mx-auto mt-3 max-w-xl">
          <p className="mb-1 text-center font-cinzel text-[10px] tracking-[0.45em] text-[#ff6f00] uppercase">{snap.boss.name}</p>
          <div className="h-2.5 overflow-hidden rounded-full border border-red-500/40 bg-black/60">
            <div
              className="h-full bg-gradient-to-r from-[#5a0010] via-[#ff3d00] to-[#ffd54f]"
              style={{ width: `${(snap.boss.hp / snap.boss.maxHp) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="mx-auto mt-3 flex max-w-xs justify-center gap-2">
        <Cd label="Dash" ready={snap.dashCd <= 0} v={1 - snap.dashCd / snap.dashMax} />
        <Cd label="Parry" ready={snap.parryCd <= 0} v={1 - snap.parryCd / snap.parryMax} />
        <Cd label="Chakra" ready={snap.chakraCd <= 0} v={1 - snap.chakraCd / snap.chakraMax} />
      </div>
    </div>
  );
}

function Cd({ label, ready, v }: { label: string; ready: boolean; v: number }) {
  return (
    <div className={`hud-panel rounded-md px-2 py-1 text-center text-[9px] tracking-[0.2em] uppercase ${ready ? "text-[#7ee8ff]" : "text-amber-100/40"}`}>
      {label}
      <div className="mt-1 h-0.5 w-10 bg-black/50">
        <div className="h-full bg-[#ffd54f]" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
      </div>
    </div>
  );
}

function BannerView({ banner }: { banner: NonNullable<Snapshot["banner"]> }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="animate-slam text-center">
        <p className="font-epic text-4xl text-[#ffd54f] drop-shadow-[0_6px_18px_#000] sm:text-6xl">{banner.title}</p>
        <p className="mt-2 font-cinzel tracking-[0.4em] text-[#00e5ff] uppercase">{banner.sub}</p>
      </div>
    </div>
  );
}

function PauseScreen({ snap, onResume, onRestart }: { snap: Snapshot; onResume: () => void; onRestart: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <div className="hud-panel w-full max-w-md rounded-2xl p-8 text-center">
        <p className="font-epic text-4xl text-[#ffd54f]">PAUSED</p>
        <p className="mt-2 text-sm text-amber-100/60">
          Wave {snap.wave} · {snap.score} pts
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" onClick={onResume} className="border border-[#ffd54f]/50 py-3 font-cinzel tracking-[0.3em] text-[#ffd54f] uppercase">
            Resume
          </button>
          <button type="button" onClick={onRestart} className="border border-white/15 py-3 font-cinzel tracking-[0.3em] uppercase">
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}

function GameOverScreen({
  snap,
  onSave,
  onRestart,
}: {
  snap: Snapshot;
  onSave: () => void;
  onRestart: () => void;
}) {
  const title = titleForScore(snap.score, snap.wave);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#07040d]/80 px-4 backdrop-blur-[2px]">
      <div className="hud-panel w-full max-w-lg rounded-2xl p-6 sm:p-8">
        <p className="text-center font-cinzel text-[10px] tracking-[0.5em] text-[#ff6f00] uppercase">The pact breaks</p>
        <h2 className="font-epic mt-1 text-center text-4xl text-[#ffd54f] sm:text-5xl">FALLEN</h2>
        <p className="mt-2 text-center text-[#00e5ff]">{title}</p>
        <div className="mt-5 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <Stat k="Score" v={String(snap.score)} />
          <Stat k="Wave" v={String(snap.wave)} />
          <Stat k="Kills" v={String(snap.kills)} />
          <Stat k="Redeemed" v={String(snap.pacified)} />
        </div>
        {snap.pacified > 0 && (
          <p className="mt-3 text-center font-cinzel text-xs italic text-[#ffd54f]/80">
            "The forest remembers {snap.pacified} redeemed {snap.pacified === 1 ? "soul" : "souls"}."
          </p>
        )}

        <div className="mt-6 text-center">
          {!snap.saved ? (
            <>
              <p className="text-[10px] tracking-[0.3em] text-amber-100/50 uppercase">Carve your name</p>
              <p className="font-epic my-2 text-4xl tracking-[0.4em] text-[#ffd54f]">{(snap.initials || "").padEnd(3, "_")}</p>
              <div className="flex justify-center gap-3">
                <button type="button" onClick={onSave} className="border border-[#ffd54f]/50 px-5 py-2 font-cinzel text-xs tracking-[0.25em] text-[#ffd54f] uppercase">
                  Save
                </button>
                <button type="button" onClick={onRestart} className="border border-white/20 px-5 py-2 font-cinzel text-xs tracking-[0.25em] uppercase">
                  Rise Again
                </button>
              </div>
              <p className="mt-2 text-[10px] text-amber-100/40">Type letters · Enter saves · R restarts</p>
            </>
          ) : (
            <button type="button" onClick={onRestart} className="border border-[#ffd54f]/50 px-8 py-3 font-cinzel text-xs tracking-[0.3em] text-[#ffd54f] uppercase">
              Rise Again
            </button>
          )}
        </div>

        {snap.highScores.length > 0 && (
          <ul className="mt-5 space-y-1 border-t border-white/10 pt-4 text-sm">
            {snap.highScores.slice(0, 6).map((s, i) => (
              <li key={`${s.at}-${i}`} className="flex justify-between gap-2">
                <span className="text-[#ffd54f]">{s.name}</span>
                <span className="flex-1 truncate text-amber-100/50">{s.title}</span>
                <span className="text-[#00e5ff]">{s.score}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-black/30 py-2">
      <p className="text-[9px] tracking-[0.25em] text-amber-100/45 uppercase">{k}</p>
      <p className="font-cinzel text-xl text-[#ffd54f]">{v}</p>
    </div>
  );
}

function TouchPad({
  snap,
  stickRef,
  knob,
  onStickStart,
  onStickMove,
  onStickEnd,
  setBtn,
}: {
  snap: Snapshot;
  stickRef: React.RefObject<HTMLDivElement | null>;
  knob: { x: number; y: number; on: boolean };
  onStickStart: (e: React.PointerEvent) => void;
  onStickMove: (e: React.PointerEvent) => void;
  onStickEnd: () => void;
  setBtn: (k: keyof Game["btns"], v: boolean) => void;
}) {
  const hold = (k: keyof Game["btns"]) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setBtn(k, true);
    },
    onPointerUp: () => setBtn(k, false),
    onPointerCancel: () => setBtn(k, false),
  });

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        ref={stickRef}
        className="relative h-36 w-36 rounded-full border border-amber-200/25 bg-black/25"
        onPointerDown={onStickStart}
        onPointerMove={onStickMove}
        onPointerUp={onStickEnd}
        onPointerCancel={onStickEnd}
      >
        <div
          className="absolute top-1/2 left-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ffd54f]/50 bg-[#ffd54f]/20"
          style={{ transform: `translate(calc(-50% + ${knob.x * 38}px), calc(-50% + ${knob.y * 38}px))` }}
        />
      </div>

      <div className="relative mb-1 h-44 w-48">
        <button type="button" className="touch-btn absolute right-0 bottom-0 h-20 w-20 text-[11px]" {...hold("atk")}>
          Slash
        </button>
        <button type="button" className="touch-btn absolute right-24 bottom-2 h-14 w-14 text-[9px]" {...hold("dash")}>
          Dash
        </button>
        <button type="button" className="touch-btn absolute right-2 bottom-[5.4rem] h-14 w-14 text-[9px]" {...hold("parry")}>
          {snap.boss ? "Pacify" : "Parry"}
        </button>
        <button type="button" className="touch-btn absolute right-[4.6rem] bottom-[5.6rem] h-14 w-14 text-[9px]" {...hold("chakra")}>
          Chakra
        </button>
        {snap.mass >= 100 && snap.elevateT <= 0 && (
          <button
            type="button"
            className="touch-btn absolute -top-2 right-8 h-12 w-20 text-[9px] text-[#00e5ff]"
            {...hold("elev")}
          >
            Elevate
          </button>
        )}
      </div>
    </div>
  );
}

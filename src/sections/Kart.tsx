import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fit } from '@rive-app/react-canvas';
import { useRivePiece, type RivePieceHandle } from '../rive/useRivePiece.ts';
import { RivePiece } from '../rive/RivePiece.tsx';
import { Snippet } from '../Snippet.tsx';
import { createDriver } from '../kart/agent.ts';
import { TRAINED_GENOME } from '../kart/brain.ts';
import { CHECKPOINT_COUNT, EDITOR_GRID_SIZE, FIXED_DT, OBS_SIZE } from '../kart/config.ts';
import type { CarAction, TrackGeometry } from '../kart/core/contracts.ts';
import { SimEnvironment } from '../kart/core/environment.ts';
import { trackFromCells, validateCells, type Cell } from '../kart/core/track/editor.ts';
import { drawCarMarker, drawGrid, drawTrack, exampleCells, makeMapping, rays, type Mapping } from '../kart/draw.ts';

const CANVAS = 640;
const MAX_STEPS_PER_FRAME = 12;

const SNIPPET = `// per frame: the sim decides, Rive shows it
const action = driver.act(obs);                  // 6 sensors -> steer, throttle (74 weights, plain TS)
const { observations } = env.step([action]);

kart.set('speed', car.speed / CAR_MAX_SPEED);
kart.set('steer', smoothedSteer);
kart.set('scared', Math.min(...rays) < 0.2);
if (env.drainRespawns().length) kart.fire('crash');
if (laps > lapsBefore) kart.fire('lap');

// the artboard sits on the track canvas and gets moved by hand
overlay.style.transform = \`translate(\${px}px, \${py}px) rotate(\${car.heading}rad)\`;`;

type Speed = 1 | 2 | 4;

export function Kart() {
  const kart = useRivePiece('kart', { fit: Fit.Contain }); // the one on the track
  const dash = useRivePiece('kart', { fit: Fit.Contain }); // the big one, same file, same values

  const [cells, setCells] = useState<Set<string>>(() => exampleCells());
  const [direction, setDirection] = useState<'ccw' | 'cw'>('ccw');
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [showRays, setShowRays] = useState(true);
  const [laps, setLaps] = useState(0);
  const [crashes, setCrashes] = useState(0);

  const validation = useMemo(() => validateCells(toCells(cells)), [cells]);
  const track = useMemo<{ track: TrackGeometry; mapping: Mapping } | null>(() => {
    if (!validation.valid) return null;
    try {
      const t = trackFromCells(toCells(cells), { direction });
      return { track: t, mapping: makeMapping(CANVAS, validation.ordered) };
    } catch {
      return null;
    }
  }, [cells, direction, validation]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ---- editor: pintar celdas arrastrando --------------------------------
  const paintMode = useRef<boolean | null>(null);
  const cellAt = (e: React.PointerEvent): Cell | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const size = r.width / EDITOR_GRID_SIZE;
    const col = Math.floor((e.clientX - r.left) / size);
    const row = Math.floor((e.clientY - r.top) / size);
    if (col < 0 || row < 0 || col >= EDITOR_GRID_SIZE || row >= EDITOR_GRID_SIZE) return null;
    return { col, row };
  };
  const apply = (cell: Cell | null) => {
    if (!cell || paintMode.current === null) return;
    const key = `${cell.col},${cell.row}`;
    setCells((prev) => {
      if (prev.has(key) === paintMode.current) return prev;
      const next = new Set(prev);
      if (paintMode.current) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  const onDown = (e: React.PointerEvent) => {
    if (running) return;
    const cell = cellAt(e);
    if (!cell) return;
    paintMode.current = !cells.has(`${cell.col},${cell.row}`);
    apply(cell);
  };
  const onMove = (e: React.PointerEvent) => {
    if (paintMode.current !== null) apply(cellAt(e));
  };
  useEffect(() => {
    const up = () => {
      paintMode.current = null;
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  // ---- simulacion + render, fuera de React ------------------------------
  const sim = useRef<{ env: SimEnvironment; obs: Float32Array; steer: number; laps: number; acc: number; last: number } | null>(null);
  const driver = useMemo(() => createDriver(TRAINED_GENOME), []);

  const placeOverlay = useCallback(
    (x: number, y: number, heading: number, m: Mapping, visible: boolean) => {
      const el = overlayRef.current;
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!el || !wrap || !canvas) return;
      const ratio = canvas.getBoundingClientRect().width / CANVAS;
      const [px, py] = m.toPx({ x, y });
      el.style.display = visible ? 'block' : 'none';
      el.style.transform = `translate(${px * ratio}px, ${py * ratio}px) translate(-50%, -50%) rotate(${heading}rad)`;
      const w = 5 * m.scale * ratio;
      el.style.width = `${w}px`;
      el.style.height = `${w * 0.625}px`;
    },
    [],
  );

  // Redibuja el editor cuando no corre.
  useEffect(() => {
    if (running) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawGrid(ctx, CANVAS, cells, validation.valid);
    if (track) {
      drawTrack(ctx, track.track, track.mapping);
      const s = track.track.start;
      placeOverlay(s.position.x, s.position.y, s.heading, track.mapping, true);
      pushPose(kart, dash, 0, 0, false);
    } else {
      placeOverlay(0, 0, 0, makeMapping(CANVAS, []), false);
    }
  }, [cells, validation, track, running, placeOverlay, kart, dash]);

  useEffect(() => {
    if (!running || !track) return;
    const env = new SimEnvironment(1, { kind: 'custom', track: track.track }, { wallMode: 'respawn', stagnationKills: false });
    const obs = env.reset(0).data;
    sim.current = { env, obs, steer: 0, laps: 0, acc: 0, last: performance.now() };
    setLaps(0);
    setCrashes(0);
    let raf = 0;
    const frame = (now: number) => {
      const s = sim.current;
      if (!s) return;
      const dt = Math.min(0.1, (now - s.last) / 1000);
      s.last = now;
      s.acc += dt * speed;
      let steps = 0;
      let action: CarAction = { steer: 0, throttle: 0 };
      let crashed = false;
      let lapNow = false;
      while (s.acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        action = driver.act(s.obs.subarray(0, OBS_SIZE));
        const r = s.env.step([action]);
        s.obs = r.observations.data;
        s.acc -= FIXED_DT;
        steps++;
        if (s.env.drainRespawns().length) crashed = true;
        const car = s.env.getState().cars[0]!;
        const lapsNow = Math.floor(car.checkpointsCrossed / CHECKPOINT_COUNT);
        if (lapsNow > s.laps) {
          s.laps = lapsNow;
          lapNow = true;
        }
      }
      if (steps === MAX_STEPS_PER_FRAME) s.acc = 0; // pestaña dormida: no acumular deuda

      const car = s.env.getState().cars[0]!;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        drawGrid(ctx, CANVAS, cells, true);
        drawTrack(ctx, track.track, track.mapping);
        const sensed = rays(track.track, car, track.mapping, showRays ? ctx : null);
        if (kart.status !== 'ready') drawCarMarker(ctx, car, track.mapping);
        s.steer += (action.steer - s.steer) * 0.25;
        pushPose(kart, dash, car.speed, s.steer, Math.min(...sensed) < 0.2);
      }
      if (crashed) {
        kart.fire('crash');
        dash.fire('crash');
        setCrashes((n) => n + 1);
      }
      if (lapNow) {
        kart.fire('lap');
        dash.fire('lap');
        setLaps(s.laps);
      }
      placeOverlay(car.x, car.y, car.heading, track.mapping, true);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      sim.current = null;
    };
  }, [running, track, speed, showRays, cells, driver, kart, dash, placeOverlay]);

  const reason = validation.valid ? null : validation.reason;

  return (
    <section className="kart">
      <h2>Draw a track. It drives itself.</h2>
      <p className="muted">
        Paint a closed loop and press run. The driver is a 74-weight neural network trained by neuroevolution in{' '}
        <a href="https://github.com/chafamaster2000/AutoCheems" target="_blank" rel="noreferrer">
          AutoCheems
        </a>
        ; here it only runs inference, in plain TypeScript. It sees five distances and its own speed. Rive draws the
        kart: speed, steering and the driver's mood are properties on its View Model, updated every frame.
      </p>

      <div className="kart-grid">
        <div className="track-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            width={CANVAS}
            height={CANVAS}
            className={running ? 'running' : 'editing'}
            onPointerDown={onDown}
            onPointerMove={onMove}
          />
          <div className="kart-overlay" ref={overlayRef}>
            <RivePiece piece={kart} compact />
          </div>
        </div>

        <aside className="kart-panel">
          <div className="dash">
            <RivePiece piece={dash} className="dash-piece" />
            <dl>
              <dt>laps</dt>
              <dd>{laps}</dd>
              <dt>walls hit</dt>
              <dd>{crashes}</dd>
            </dl>
          </div>

          <div className="controls">
            <button type="button" className="primary" disabled={!track} onClick={() => setRunning((r) => !r)}>
              {running ? 'Stop' : 'Run'}
            </button>
            <div className="seg">
              {([1, 2, 4] as Speed[]).map((s) => (
                <button key={s} type="button" className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
                  {s}×
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={showRays} onChange={(e) => setShowRays(e.target.checked)} /> sensors
            </label>
          </div>

          <div className="controls">
            <button
              type="button"
              className="ghost"
              disabled={running}
              onClick={() => setDirection((d) => (d === 'ccw' ? 'cw' : 'ccw'))}
            >
              direction: {direction}
            </button>
            <button type="button" className="ghost" disabled={running} onClick={() => setCells(exampleCells())}>
              example track
            </button>
            <button type="button" className="ghost" disabled={running} onClick={() => setCells(new Set())}>
              clear
            </button>
          </div>

          <p className={`validity ${validation.valid ? 'ok' : 'bad'}`}>
            {validation.valid
              ? `${cells.size} cells · one closed loop · ready`
              : `${reason} — the loop needs every cell to touch exactly two others`}
          </p>
          <p className="muted small">
            Drag on the grid to paint or erase. The track needs at least 4 cells in a single closed loop, no
            branches. If the driver hits a wall it is put back at the last checkpoint: that is a crash trigger.
          </p>
        </aside>
      </div>
      <Snippet code={SNIPPET} />
    </section>
  );
}

function toCells(set: ReadonlySet<string>): Cell[] {
  return [...set].map((k) => {
    const [col, row] = k.split(',').map(Number) as [number, number];
    return { col, row };
  });
}

function pushPose(a: RivePieceHandle, b: RivePieceHandle, speed: number, steer: number, scared: boolean) {
  const v = Math.min(1, speed / 22);
  for (const p of [a, b]) {
    p.set('speed', v);
    p.set('steer', steer);
    p.set('scared', scared);
  }
}

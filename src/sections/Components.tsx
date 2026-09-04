import { useEffect, useRef, useState } from 'react';
import { useRivePiece } from '../rive/useRivePiece.ts';
import { useViewMode } from '../rive/ViewMode.tsx';
import { RivePiece } from '../rive/RivePiece.tsx';
import { Snippet } from '../Snippet.tsx';

const SNIPPET = `// Button: React owns the state, two state machine layers own the motion
<button onPointerEnter={() => btn.set('hover', true)}
        onPointerDown={() => btn.set('pressed', true)}
        onClick={() => { btn.set('loading', true); save().then(() => {
          btn.set('loading', false); btn.fire('done');   // dots out, flourish in
        }); }}>
  <RivePiece piece={btn} />
</button>

// Toggle: React owns the input, the state machine owns the motion
useEffect(() => toggle.set('on', on), [toggle, on]);
<button role="switch" aria-checked={on} onClick={() => setOn((v) => !v)}>
  <RivePiece piece={toggle} />
</button>
// ...and can still set it from outside
<input type="checkbox" checked={dark} onChange={(e) => toggle.set('on', e.target.checked)} />

// Loader: progress drives a trim path on the ring and the size of the core,
// both through a formula converter, so there is no animation in between
loader.set('progress', pct);              // 0..100
loader.set('done', pct >= 100);           // a second layer takes over at the end`;

export function Components() {
  return (
    <section className="components">
      <h2>Production components, not showreel pieces</h2>
      <p className="muted">
        React owns the input and the accessibility, the state machine owns the motion. The switch blends off and
        on while a second layer scales its knob. The button separates how it feels from what it is doing, so a
        press still answers while work is in flight. The loader turns one number into a trimmed ring through a
        formula, with no animation in between. Contract view shows the values each of them is receiving.
      </p>
      <div className="cards">
        <ToggleCard />
        <ButtonCard />
        <LoaderCard />
      </div>
      <Snippet code={SNIPPET} title="how the components are wired" />
    </section>
  );
}

function ButtonCard() {
  const btn = useRivePiece('button');
  const mode = useViewMode();
  const [clicks, setClicks] = useState(0);
  const [loading, setLoading] = useState(false);

  const click = () => {
    if (loading) return;
    setLoading(true);
    btn.set('loading', true);
    setTimeout(() => {
      btn.set('loading', false);
      btn.fire('done');
      setLoading(false);
      setClicks((n) => n + 1);
    }, 1200);
  };

  return (
    <article className="card" hidden={mode === 'art' && btn.status !== 'ready'}>
      <header>
        <h3>Button</h3>
        <span className="owner">two layers: feel and work</span>
      </header>
      <button
        type="button"
        className="rive-button"
        onClick={click}
        onPointerEnter={() => btn.set('hover', true)}
        onPointerLeave={() => {
          btn.set('hover', false);
          btn.set('pressed', false);
        }}
        onPointerDown={() => btn.set('pressed', true)}
        onPointerUp={() => btn.set('pressed', false)}
        aria-busy={loading}
      >
        <RivePiece piece={btn} className="button-piece" />
        {/* Rive draws the surface; the label stays in the DOM, where a screen
            reader and a translator can both reach it. */}
        <span className="button-label">{loading ? 'Saving…' : 'Save changes'}</span>
      </button>
      <p className="muted small">
        saved {clicks} {clicks === 1 ? 'time' : 'times'} · hover and press on one layer, the work on another
      </p>
    </article>
  );
}

function ToggleCard() {
  const toggle = useRivePiece('toggle');
  const [on, setOn] = useState(false);
  useEffect(() => toggle.set('on', on), [toggle, on]);

  return (
    <article className="card">
      <header>
        <h3>Toggle</h3>
        <span className="owner">two state machine layers</span>
      </header>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className="toggle-wrap"
        onPointerEnter={() => toggle.set('hover', true)}
        onPointerLeave={() => toggle.set('hover', false)}
        onClick={() => setOn((v) => !v)}
      >
        <RivePiece piece={toggle} className="toggle-piece" />
      </button>
      <p className="muted small">
        one layer blends off/on, a second layer scales the knob on hover
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            toggle.set('on', e.target.checked);
          }}
        />
        set it from React too · currently <b>{on ? 'on' : 'off'}</b>
      </label>
    </article>
  );
}

function LoaderCard() {
  const loader = useRivePiece('loader');
  const mode = useViewMode();
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState('');
  const timer = useRef<number | null>(null);
  useEffect(() => loader.set('progress', pct), [loader, pct]);
  useEffect(() => loader.set('done', pct >= 100), [loader, pct]);
  useEffect(() => setMsg(pct >= 100 ? 'done' : ''), [pct]);

  const simulate = () => {
    if (timer.current) window.clearInterval(timer.current);
    setMsg('');
    setPct(0);
    let p = 0;
    timer.current = window.setInterval(() => {
      p = Math.min(100, p + 1 + Math.random() * 3);
      setPct(Math.round(p));
      if (p >= 100 && timer.current) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    }, 60);
  };

  return (
    <article className="card" hidden={mode === 'art' && loader.status !== 'ready'}>
      <header>
        <h3>Loader</h3>
        <span className="owner">one number, a trim path</span>
      </header>
      <RivePiece piece={loader} className="loader-piece" />
      <input type="range" min={0} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
      <div className="row">
        <button type="button" className="ghost" onClick={simulate}>
          simulate an upload
        </button>
        <span className="muted small">{msg || `${pct}%`}</span>
      </div>
    </article>
  );
}

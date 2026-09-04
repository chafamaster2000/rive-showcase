import { useEffect, useRef, useState } from 'react';
import { useRivePiece } from '../rive/useRivePiece.ts';
import { useViewMode } from '../rive/ViewMode.tsx';
import { RivePiece } from '../rive/RivePiece.tsx';
import { Snippet } from '../Snippet.tsx';

const SNIPPET = `// Button: React owns the state, Rive draws it
<button onPointerDown={() => btn.set('pressed', true)}
        onClick={() => { btn.set('loading', true); save().then(() => btn.fire('done')); }}>
  <RivePiece piece={btn} />
</button>

// Toggle: React owns the input, the state machine owns the motion
useEffect(() => toggle.set('on', on), [toggle, on]);
<button role="switch" aria-checked={on} onClick={() => setOn((v) => !v)}>
  <RivePiece piece={toggle} />
</button>
// ...and can still set it from outside
<input type="checkbox" checked={dark} onChange={(e) => toggle.set('on', e.target.checked)} />

// Loader: a number goes in, a boolean comes back when the finish animation ends
loader.set('progress', pct);
useEffect(() => loader.watch('done', 'boolean', (v) => v && setMsg('Rive says: finished')), [loader]);`;

export function Components() {
  return (
    <section className="components">
      <h2>Production components, not showreel pieces</h2>
      <p className="muted">
        React owns the input and the accessibility, the state machine owns the motion. The switch is a Rive
        file on two layers: one blends off and on, the other scales the knob on hover. Two more components are
        specified and wired but not drawn yet; switch the header to contract view to see them, and to watch the
        values every piece is receiving.
      </p>
      <div className="cards">
        <ToggleCard />
        <ButtonCard />
        <LoaderCard />
      </div>
      <Snippet code={SNIPPET} title="how the three components are wired" />
    </section>
  );
}

function ButtonCard() {
  const btn = useRivePiece('button');
  const mode = useViewMode();
  const [clicks, setClicks] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => btn.set('label', loading ? 'Saving' : 'Save changes'), [btn, loading]);

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
        <span className="owner">React owns the state</span>
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
      </button>
      <p className="muted small">
        saved {clicks} {clicks === 1 ? 'time' : 'times'} · hover, press, loading and a done flourish
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
  useEffect(() => loader.watch('done', 'boolean', (v) => v && setMsg('Rive says: finished')), [loader]);

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
        <span className="owner">a number in, a flourish out</span>
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

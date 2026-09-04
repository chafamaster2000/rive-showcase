import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useRivePiece } from '../rive/useRivePiece.ts';
import { RivePiece } from '../rive/RivePiece.tsx';
import { Snippet } from '../Snippet.tsx';

const SNIPPET = `const mascot = useRivePiece('mascot');       // View Model, autoBind

onPointerMove={(e) => {
  const r = box.getBoundingClientRect();
  mascot.set('lookX', ((e.clientX - r.left) / r.width) * 2 - 1);
  mascot.set('lookY', ((e.clientY - r.top) / r.height) * 2 - 1);
}}
// lookX/lookY drive the eyes, face and body straight through data binds with a
// formula converter, so there is no animation to blend and no lag.
<input onFocus={() => mascot.set('typing', true)}
       onChange={(e) => mascot.set('textLength', e.target.value.length)} />
<input type="password" onFocus={() => mascot.set('coverEyes', true)} />

mascot.fire(ok ? 'success' : 'fail');            // React -> Rive trigger
mascot.set('scroll', scrollProgress);             // 0..1, every scroll event`;


/**
 * The two scale binds in `mascot.riv` were authored with percent formulas
 * (`100 + n`), but a data bind writes the raw property, where 1 is 100%. Left
 * alone the pupils cover the whole artboard. Until the file is re-exported with
 * unit formulas, React sends the value that lands on the scale we want.
 *   pupils: 100 + n * 1.4  ->  1 + chars * 0.0125
 *   shadow: 100 - n * 30   ->  1 - scroll * 0.15
 */
const pupilInput = (chars: number) => (1 + Math.min(chars, 40) * 0.0125 - 100) / 1.4;
const shadowInput = (scroll: number) => (100 - (1 - 0.15 * scroll)) / 30;

export function Mascot() {
  const mascot = useRivePiece('mascot');
  const box = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<'idle' | 'ok' | 'fail' | 'busy'>('idle');
  const [pokes, setPokes] = useState(0);

  // Cursor relative to the character, anywhere on the section.
  const onMove = useCallback(
    (e: React.PointerEvent) => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      mascot.set('lookX', clamp(((e.clientX - cx) / r.width) * 2, -1, 1));
      mascot.set('lookY', clamp(((e.clientY - cy) / r.height) * 2, -1, 1));
    },
    [mascot],
  );

  // The View Model starts at 0, which the percent formula turns into a 100x
  // scale, so the compensated resting value has to be written up front.
  useEffect(() => {
    mascot.set('textLength', 0, pupilInput(0));
  }, [mascot]);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      mascot.set('scroll', progress, shadowInput(progress));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mascot]);


  const submit = (e: FormEvent) => {
    e.preventDefault();
    setResult('busy');
    const ok = /.+@.+\..+/.test(email) && password.length >= 6;
    setTimeout(() => {
      mascot.fire(ok ? 'success' : 'fail');
      setResult(ok ? 'ok' : 'fail');
    }, 600);
  };

  return (
    <section className="hero" onPointerMove={onMove}>
      <div className="hero-grid">
        <motion.div
          ref={box}
          role="img"
          aria-label="A character that follows the cursor and reacts to the form beside it"
          className="mascot-box"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          onClick={() => {
            mascot.fire('poke');
            setPokes((n) => n + 1);
          }}
        >
          <RivePiece piece={mascot} />
          {pokes > 0 && <span className="badge">poked {pokes}×</span>}
        </motion.div>

        <motion.form
          className="login"
          onSubmit={submit}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <h2>It watches you type</h2>
          <p className="muted">
            Every cursor move, keystroke and focus change goes into the character's View Model.
            The password field makes it cover its eyes. Any email plus 6 characters logs in.
          </p>
          <label>
            Email
            <input
              type="email"
              value={email}
              placeholder="you@studio.dev"
              onFocus={() => {
                mascot.set('typing', true);
                mascot.set('textLength', email.length, pupilInput(email.length));
              }}
              onBlur={() => mascot.set('typing', false)}
              onChange={(e) => {
                setEmail(e.target.value);
                mascot.set('textLength', e.target.value.length, pupilInput(e.target.value.length));
              }}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              placeholder="••••••"
              onFocus={() => mascot.set('coverEyes', true)}
              onBlur={() => mascot.set('coverEyes', false)}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" disabled={result === 'busy'}>
            {result === 'busy' ? 'Checking…' : 'Sign in'}
          </button>
          <p className={`result ${result}`} aria-live="polite">
            {result === 'ok' && 'Welcome back. The character got a success trigger.'}
            {result === 'fail' && 'Nope. The character got a fail trigger.'}
          </p>
        </motion.form>
      </div>
      <Snippet code={SNIPPET} title="how the character is driven" />
    </section>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

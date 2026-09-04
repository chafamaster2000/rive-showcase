import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  type ViewModelInstance,
  type ViewModelInstanceBoolean,
  type ViewModelInstanceNumber,
  type ViewModelInstanceString,
  type ViewModelInstanceTrigger,
} from '@rive-app/react-canvas';

export type PieceStatus = 'loading' | 'ready' | 'missing' | 'error';
export type PieceValue = number | boolean | string;
export type PieceValues = Record<string, PieceValue>;

const STATE_MACHINE = 'SM';
// One .riv per piece: the Early Access editor only exports a file's first
// artboard, so each piece is authored in its own Rive file. A piece whose file
// is not there yet renders its placeholder instead.
const files = new Map<string, Promise<ArrayBuffer | null>>();
function loadFile(url: string) {
  let p = files.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok && !r.headers.get('content-type')?.includes('text/html') ? r.arrayBuffer() : null))
      .then((b) => (b && b.byteLength > 0 ? b : null))
      .catch(() => null);
    files.set(url, p);
  }
  return p;
}

/**
 * Loads `public/rive/<file>.riv` and exposes its View Model properties.
 * If the file is not there yet, `status` is 'missing' and the values still
 * flow into `values` so the placeholder can render them.
 */
export function useRivePiece(file: string, opts: { fit?: Fit } = {}) {
  const url = `${import.meta.env.BASE_URL}rive/${file}.riv`;
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [status, setStatus] = useState<PieceStatus>('loading');
  const [vmi, setVmi] = useState<ViewModelInstance | null>(null);
  const values = useRef<PieceValues>({});
  const fit = opts.fit ?? Fit.Contain;

  useEffect(() => {
    let alive = true;
    loadFile(url).then((b) => {
      if (!alive) return;
      if (b) setBuffer(b);
      else setStatus('missing');
    });
    return () => {
      alive = false;
    };
  }, [url]);

  const { rive, RiveComponent } = useRive(
    buffer
      ? {
          buffer,
          stateMachine: STATE_MACHINE,
          autoplay: true,
          autoBind: true,
          layout: new Layout({ fit, alignment: Alignment.Center }),
          onLoad: () => setStatus('ready'),
          onLoadError: () => setStatus('error'),
        }
      : null,
  );

  useEffect(() => {
    if (status === 'ready' && rive) {
      const inst = rive.viewModelInstance ?? null;
      setVmi(inst);
      // Debug handle for the verification loop: window.__rive.<file>
      const w = window as unknown as { __rive?: Record<string, unknown> };
      (w.__rive ??= {})[file] = { rive, vmi: inst };
    }
  }, [status, rive, file]);

  // Handles are cached: looking a property up by path every frame is wasteful.
  const api = useMemo(() => {
    const nums = new Map<string, ViewModelInstanceNumber | null>();
    const bools = new Map<string, ViewModelInstanceBoolean | null>();
    const strs = new Map<string, ViewModelInstanceString | null>();
    const trigs = new Map<string, ViewModelInstanceTrigger | null>();
    const get = <T>(cache: Map<string, T | null>, path: string, find: () => T | null) => {
      let h = cache.get(path);
      if (h === undefined) {
        h = vmi ? find() : null;
        cache.set(path, h);
      }
      return h;
    };
    return {
      set(path: string, value: PieceValue) {
        values.current[path] = value;
        if (!vmi) return;
        if (typeof value === 'number') {
          const h = get(nums, path, () => vmi.number(path));
          if (h) h.value = value;
        } else if (typeof value === 'boolean') {
          const h = get(bools, path, () => vmi.boolean(path));
          if (h) h.value = value;
        } else {
          const h = get(strs, path, () => vmi.string(path));
          if (h) h.value = value;
        }
      },
      fire(path: string) {
        values.current[path] = `fired ${new Date().toLocaleTimeString()}`;
        get(trigs, path, () => vmi!.trigger(path))?.trigger();
      },
      /**
       * Watch a property Rive itself changes (a listener writing into the View
       * Model). The runtime's own value callbacks do not fire for these, so this
       * polls the property once per frame and reports real changes.
       */
      watch(path: string, kind: 'boolean' | 'number', cb: (value: boolean | number) => void): () => void {
        if (!vmi) return () => {};
        const h = kind === 'boolean' ? get(bools, path, () => vmi.boolean(path)) : get(nums, path, () => vmi.number(path));
        if (!h) return () => {};
        let last = h.value;
        let raf = 0;
        const tick = () => {
          const v = h.value;
          if (v !== last) {
            last = v;
            values.current[path] = v;
            cb(v);
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
      },
    };
  }, [vmi]);

  return { file, status, RiveComponent, rive, values, ...api };
}

export type RivePieceHandle = ReturnType<typeof useRivePiece>;

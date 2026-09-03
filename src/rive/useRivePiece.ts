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
    fetch(url)
      .then((r) => (r.ok && !r.headers.get('content-type')?.includes('text/html') ? r.arrayBuffer() : null))
      .then((b) => {
        if (!alive) return;
        if (b && b.byteLength > 0) setBuffer(b);
        else setStatus('missing');
      })
      .catch(() => alive && setStatus('missing'));
    return () => {
      alive = false;
    };
  }, [url]);

  const { rive, RiveComponent } = useRive(
    buffer
      ? {
          buffer,
          stateMachines: STATE_MACHINE,
          autoplay: true,
          autoBind: true,
          layout: new Layout({ fit, alignment: Alignment.Center }),
          onLoad: () => setStatus('ready'),
          onLoadError: () => setStatus('error'),
        }
      : null,
  );

  useEffect(() => {
    if (status === 'ready' && rive) setVmi(rive.viewModelInstance ?? null);
  }, [status, rive]);

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
      /** Subscribe to a property Rive changes (a trigger it fires, a boolean a listener flips). */
      on(path: string, kind: 'trigger' | 'boolean', cb: (value?: boolean) => void): () => void {
        if (!vmi) return () => {};
        if (kind === 'trigger') {
          const h = get(trigs, path, () => vmi.trigger(path));
          if (!h) return () => {};
          const fn = () => cb();
          h.on(fn);
          return () => h.off(fn);
        }
        const h = get(bools, path, () => vmi.boolean(path));
        if (!h) return () => {};
        const fn = () => cb(h.value);
        h.on(fn);
        return () => h.off(fn);
      },
    };
  }, [vmi]);

  return { file, status, RiveComponent, rive, values, ...api };
}

export type RivePieceHandle = ReturnType<typeof useRivePiece>;

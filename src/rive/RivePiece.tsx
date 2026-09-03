import { useEffect, useState, type CSSProperties } from 'react';
import type { PieceValues, RivePieceHandle } from './useRivePiece.ts';

interface Props {
  piece: RivePieceHandle;
  /** compact = no text, just a glyph (used for the kart on the track) */
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Renders the Rive canvas when the file is there, the live placeholder otherwise. */
export function RivePiece({ piece, compact, className, style }: Props) {
  const { status, RiveComponent } = piece;
  if (status === 'ready') {
    return (
      <div className={`piece ${className ?? ''}`} style={style}>
        <RiveComponent style={{ width: '100%', height: '100%' }} />
      </div>
    );
  }
  return (
    <div className={`piece placeholder ${compact ? 'compact' : ''} ${className ?? ''}`} style={style}>
      {compact ? <KartGlyph values={piece.values.current} /> : <Panel piece={piece} />}
    </div>
  );
}

function usePolled(values: { current: PieceValues }, ms = 80): PieceValues {
  const [snap, setSnap] = useState<PieceValues>({});
  useEffect(() => {
    const id = setInterval(() => setSnap({ ...values.current }), ms);
    return () => clearInterval(id);
  }, [values, ms]);
  return snap;
}

function Panel({ piece }: { piece: RivePieceHandle }) {
  const snap = usePolled(piece.values);
  const entries = Object.entries(snap);
  return (
    <div className="ph-panel">
      <div className="ph-head">
        <span className="ph-file">{piece.file}.riv</span>
        <span className="ph-status">
          {piece.status === 'loading' && 'loading…'}
          {piece.status === 'missing' && 'not exported yet · showing the live contract'}
          {piece.status === 'error' && 'file found but it failed to load'}
        </span>
      </div>
      <ul className="ph-props">
        {entries.length === 0 && <li className="ph-empty">interact to see values</li>}
        {entries.map(([k, v]) => (
          <li key={k}>
            <code>{k}</code>
            <Value v={v} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Value({ v }: { v: number | boolean | string }) {
  if (typeof v === 'number') {
    const pct = Math.abs(v) <= 1 ? (v + 1) / 2 : Math.min(1, v / 100);
    return (
      <span className="ph-num">
        <span className="ph-bar">
          <i style={{ width: `${pct * 100}%` }} />
        </span>
        {v.toFixed(2)}
      </span>
    );
  }
  if (typeof v === 'boolean') return <span className={`ph-bool ${v ? 'on' : ''}`}>{v ? 'true' : 'false'}</span>;
  return <span className="ph-str">{v}</span>;
}

function KartGlyph({ values }: { values: PieceValues }) {
  const speed = typeof values.speed === 'number' ? values.speed : 0;
  const scared = values.scared === true;
  return (
    <svg viewBox="0 0 64 40" width="100%" height="100%">
      <rect x="6" y="8" width="52" height="24" rx="8" fill={scared ? '#ff5f7a' : '#f5c542'} />
      <rect x="40" y="12" width="14" height="16" rx="4" fill="#1b1b28" opacity="0.7" />
      <rect x="10" y="4" width="10" height="6" rx="2" fill="#1b1b28" />
      <rect x="10" y="30" width="10" height="6" rx="2" fill="#1b1b28" />
      <rect x="44" y="4" width="10" height="6" rx="2" fill="#1b1b28" />
      <rect x="44" y="30" width="10" height="6" rx="2" fill="#1b1b28" />
      <rect x="0" y="14" width={6 * speed} height="12" fill="#7cf0c9" opacity="0.6" />
    </svg>
  );
}

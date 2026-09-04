import { createContext, useContext, useState, type ReactNode } from 'react';

export type ViewMode = 'art' | 'contract';

const Ctx = createContext<ViewMode>('art');
export const useViewMode = () => useContext(Ctx);

/**
 * Contract view turns every piece on the page into a value inspector, including
 * the ones whose art is finished. It is how the pieces were built: the contract
 * first, the drawing after.
 */
export function ViewModeProvider({ children }: { children: (control: ReactNode) => ReactNode }) {
  const [mode, setMode] = useState<ViewMode>('art');
  const control = (
    <div className="seg view-seg" role="group" aria-label="what to show">
      {(['art', 'contract'] as ViewMode[]).map((m) => (
        <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)} aria-pressed={mode === m}>
          {m}
        </button>
      ))}
    </div>
  );
  return <Ctx.Provider value={mode}>{children(control)}</Ctx.Provider>;
}

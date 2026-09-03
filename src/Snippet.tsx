import { useState } from 'react';

/** The wiring behind each piece, shown as-is. This site is for engineers too. */
export function Snippet({ code, title = 'the wiring' }: { code: string; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`snippet ${open ? 'open' : ''}`}>
      <button type="button" className="snippet-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} {title}
      </button>
      {open && (
        <pre>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

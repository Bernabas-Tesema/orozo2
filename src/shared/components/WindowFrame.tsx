import { useState, type ReactNode } from 'react';
import { Maximize2, Minimize2, Minus } from 'lucide-react';

export function WindowFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);

  return (
    <section
      className={
        maximized && !minimized
          ? 'fixed inset-3 z-30 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-gray-100 shadow-2xl'
          : ''
      }
    >
      <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimized((open) => !open)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
            title={minimized ? 'Restore' : 'Minimize'}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMinimized(false);
              setMaximized((open) => !open);
            }}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
            title={maximized ? 'Restore' : 'Maximize'}
          >
            {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {!minimized && (
        <div className={maximized ? 'min-h-0 flex-1 overflow-auto p-3' : ''}>{children}</div>
      )}
    </section>
  );
}

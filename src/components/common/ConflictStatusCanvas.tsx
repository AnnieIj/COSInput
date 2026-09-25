import React from 'react';

interface CodeLine {
  num: number;
  text: string;
  type: string;
}

interface ConflictFileDetail {
  id: string;
  path: string;
  hunksCount: number;
  linesFocus: string;
  contextWindow: string;
  pane1Ours: CodeLine[];
  pane2Theirs: CodeLine[];
  pane3Synthesized: CodeLine[];
}

interface ConflictStatusCanvasProps {
  file: ConflictFileDetail;
}

export const ConflictStatusCanvas: React.FC<ConflictStatusCanvasProps> = ({ file }) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-surface-container shadow-sm overflow-hidden flex flex-col">
      {/* Viewer Top Action Bar */}
      <div className="bg-surface-container-low px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-surface-container">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[20px]">compare_arrows</span>
            <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
              3-Way Atomic Preservation Canvas
            </span>
          </div>
          <span className="hidden sm:inline font-code-sm text-code-sm text-secondary">
            hunk 1 of {file.hunksCount} · {file.linesFocus} in {file.path.split('/').pop()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface font-code-sm text-code-sm hover:bg-surface-container transition-colors border border-surface-container shadow-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">tune</span>
            <span>Diff Options</span>
          </button>
          <button
            type="button"
            className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface font-code-sm text-code-sm hover:bg-surface-container transition-colors border border-surface-container shadow-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">unfold_more</span>
            <span>Expand Context</span>
          </button>
        </div>
      </div>

      {/* 3-Pane Code Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-surface-container">
        {/* PANE 1: CONTRIBUTOR (OURS) */}
        <div className="flex flex-col bg-surface-container-lowest">
          <div className="px-3.5 py-2 bg-surface-container flex items-center justify-between border-b border-surface-container-high/40">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
              <span className="font-label-caps text-[10px] font-bold text-on-surface uppercase">
                Pane 1: Contributor (Ours)
              </span>
            </div>
            <span className="font-code-sm text-[11px] text-secondary">cosinput/381-verification-stake</span>
          </div>
          <div className="p-3 font-code-sm text-code-sm overflow-x-auto space-y-1 bg-surface-container-lowest">
            {file.pane1Ours.map((line, idx) => (
              <div
                key={idx}
                className={`flex items-start rounded px-1 -mx-1 py-0.5 ${
                  line.type === 'removed'
                    ? 'bg-error-container/40 text-on-error-container'
                    : line.type === 'added'
                    ? 'bg-primary-fixed/40 text-primary font-medium'
                    : 'text-secondary/80'
                }`}
              >
                <span className="w-8 select-none text-right pr-3 font-code-sm text-outline shrink-0">
                  {line.num}
                </span>
                <span className="font-code-sm break-all">{line.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PANE 2: UPSTREAM (THEIRS) */}
        <div className="flex flex-col bg-surface-container-lowest">
          <div className="px-3.5 py-2 bg-surface-container flex items-center justify-between border-b border-surface-container-high/40">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
              <span className="font-label-caps text-[10px] font-bold text-on-surface uppercase">
                Pane 2: Upstream Base (Theirs)
              </span>
            </div>
            <span className="font-code-sm text-[11px] text-secondary">main @ f829a1b</span>
          </div>
          <div className="p-3 font-code-sm text-code-sm overflow-x-auto space-y-1 bg-surface-container-lowest">
            {file.pane2Theirs.map((line, idx) => (
              <div
                key={idx}
                className={`flex items-start rounded px-1 -mx-1 py-0.5 ${
                  line.type === 'changed'
                    ? 'bg-secondary-container/40 text-on-surface font-medium'
                    : 'text-secondary/80'
                }`}
              >
                <span className="w-8 select-none text-right pr-3 font-code-sm text-outline shrink-0">
                  {line.num}
                </span>
                <span className="font-code-sm break-all">{line.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PANE 3: COSINPUT SYNTHESIS RESOLUTION */}
        <div className="flex flex-col bg-surface-container-lowest relative">
          <div className="px-3.5 py-2 bg-tertiary-container/15 flex items-center justify-between border-b border-tertiary/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
              <span className="font-label-caps text-[10px] font-bold text-tertiary uppercase">
                Pane 3: Synthesized Target
              </span>
            </div>
            <span className="font-code-sm text-[11px] text-tertiary font-bold bg-tertiary-fixed/30 px-1.5 py-0.5 rounded">
              Merged & Safe
            </span>
          </div>
          <div className="p-3 font-code-sm text-code-sm overflow-x-auto space-y-1 bg-surface-container-lowest">
            {file.pane3Synthesized.map((line, idx) => (
              <div
                key={idx}
                className={`flex items-start rounded px-1 -mx-1 py-0.5 ${
                  line.type.startsWith('synthesized')
                    ? 'bg-tertiary-fixed/20 text-on-surface font-semibold'
                    : 'text-secondary/80'
                }`}
              >
                <span className="w-8 select-none text-right pr-3 font-code-sm text-tertiary font-bold shrink-0">
                  {line.num}
                </span>
                <span className={`font-code-sm break-all ${line.type === 'synthesized_feature' ? 'text-primary' : ''}`}>
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

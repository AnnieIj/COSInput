import React from 'react';
import { useMode } from '../../context/ModeContext';

export const DemoModeBanner: React.FC = () => {
  const { mode, setMode } = useMode();

  if (mode !== 'demo') {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-amber-900 flex items-center justify-between gap-3 text-body-sm font-body-sm sticky top-16 z-30 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-amber-600 text-[18px]">developer_mode</span>
        <span className="font-semibold">DEMO MODE ACTIVE:</span>
        <span>Displaying isolated offline mock fixtures (RFC-081). Real GitHub App calls are bypassed.</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode('live')}
          className="px-2.5 py-1 rounded bg-amber-600 text-white font-label-md text-label-md font-semibold hover:bg-amber-700 transition-colors shadow-sm"
        >
          Switch to Live GitHub Mode
        </button>
      </div>
    </div>
  );
};

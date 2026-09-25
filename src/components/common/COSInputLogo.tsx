import React from 'react';

interface COSInputLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const COSInputLogo: React.FC<COSInputLogoProps> = ({ size = 32, className = '', showText = true }) => {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Precision Technical Node Logo */}
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <rect width="40" height="40" rx="10" fill="#0B1220" />
        {/* Terminal Bracket & Connection Path */}
        <path d="M14 14H24C27.3137 14 30 16.6863 30 20C30 23.3137 27.3137 26 24 26H16C13.7909 26 12 27.7909 12 30" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
        {/* Branch Arrow */}
        <path d="M19 19L22 22L19 25" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Upstream / Contributor Nodes */}
        <circle cx="14" cy="14" r="4.5" fill="#4F46E5" />
        <circle cx="28" cy="14" r="4" fill="#10B981" />
        <circle cx="26" cy="28" r="4.5" fill="#6366F1" />
        <circle cx="20" cy="20" r="2" fill="#F59E0B" />
      </svg>
      {showText && (
        <div className="flex flex-col">
          <span className="font-headline-sm text-headline-sm text-surface-container-lowest leading-none font-bold tracking-tight">
            COSInput
          </span>
          <span className="font-label-caps text-label-caps text-secondary-fixed-dim uppercase tracking-wider mt-0.5 font-medium">
            Open Source
          </span>
        </div>
      )}
    </div>
  );
};

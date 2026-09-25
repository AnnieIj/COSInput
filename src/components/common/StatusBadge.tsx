import React from 'react';

export type StatusBadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'ghost';

interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  pulse?: boolean;
  icon?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  pulse = false,
  icon,
  className = '',
  size = 'sm',
}) => {
  const variantStyles: Record<StatusBadgeVariant, { bg: string; text: string; dot: string }> = {
    primary: {
      bg: 'bg-primary-container',
      text: 'text-on-primary',
      dot: 'bg-on-primary',
    },
    secondary: {
      bg: 'bg-secondary-fixed',
      text: 'text-on-secondary-fixed',
      dot: 'bg-primary',
    },
    success: {
      bg: 'bg-tertiary-container/20 text-tertiary',
      text: 'text-tertiary font-semibold',
      dot: 'bg-tertiary',
    },
    error: {
      bg: 'bg-error-container',
      text: 'text-on-error-container font-bold',
      dot: 'bg-error',
    },
    warning: {
      bg: 'bg-amber-100',
      text: 'text-amber-900 font-semibold',
      dot: 'bg-amber-600',
    },
    info: {
      bg: 'bg-secondary-container',
      text: 'text-on-secondary-fixed font-semibold',
      dot: 'bg-primary',
    },
    neutral: {
      bg: 'bg-surface-container',
      text: 'text-on-surface font-medium',
      dot: 'bg-outline',
    },
    ghost: {
      bg: 'bg-surface-container-high/40',
      text: 'text-secondary font-medium',
      dot: 'bg-secondary',
    },
  };

  const style = variantStyles[variant];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-code-sm' : 'px-2.5 py-1 text-label-md';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-code-sm ${style.bg} ${style.text} ${sizeClasses} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${style.dot} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${style.dot}`}></span>
        </span>
      )}
      {!pulse && style.dot && !icon && (
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
      )}
      {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
      <span>{label}</span>
    </span>
  );
};

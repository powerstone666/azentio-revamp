'use client';

/**
 * @azentio/StatusBadge
 *
 * Reusable status indicator for the portal contribution lifecycle.
 * **Always pairs colour with a text label** — never relies on
 * colour alone for accessibility (WCAG 1.4.1 compliance).
 *
 * @example
 * ```tsx
 * <StatusBadge status="published" label="Published" />
 * <StatusBadge status="review" label="In Review" size="sm" />
 * ```
 */

import { type ReactElement } from 'react';
import { getIcon, type IconName } from '../../lib/icons';

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

type StatusVariant =
  | 'draft'
  | 'submitted'
  | 'review'
  | 'published'
  | 'rejected'
  | 'suspended'
  | 'withdrawn';

interface StatusBadgeProps {
  /** Machine-readable status key */
  status: StatusVariant;
  /** Human-readable label displayed next to the icon */
  label: string;
  /** Badge size */
  size?: 'sm' | 'md';
  /** Additional Tailwind classes merged onto the root element */
  className?: string;
}

// ───────────────────────────────────────────────────────────
// Style maps
// ───────────────────────────────────────────────────────────

const colorMap: Record<StatusVariant, string> = {
  draft:     'bg-az-grey-bg text-az-text-muted',
  submitted: 'bg-az-navy text-az-white',
  review:    'bg-az-mint-tint text-az-navy',
  published: 'bg-az-green text-az-white',
  rejected:  'bg-az-error text-az-white',
  suspended: 'bg-az-error text-az-white',
  withdrawn: 'bg-az-grey-bg text-az-text-muted',
};

const iconMap: Record<StatusVariant, IconName> = {
  draft:     'Note',
  submitted: 'Check',
  review:    'MagnifyingGlass',
  published: 'Broadcast',
  rejected:  'X',
  suspended: 'Warning',
  withdrawn: 'Trash',
};

const sizeMap: Record<'sm' | 'md', { text: string; icon: number }> = {
  sm: { text: 'text-xs', icon: 14 },
  md: { text: 'text-sm', icon: 16 },
};

// ───────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────

export function StatusBadge({
  status,
  label,
  size = 'md',
  className = '',
}: StatusBadgeProps): ReactElement {
  const colors = colorMap[status] ?? colorMap.draft;
  const iconName = iconMap[status] ?? iconMap.draft;
  const { text: textSize, icon: iconSize } = sizeMap[size];

  return (
    <span
      role="status"
      className={[
        'inline-flex items-center gap-1.5',
        'rounded-full px-3 py-1',
        'font-medium leading-none whitespace-nowrap',
        textSize,
        colors,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {getIcon(iconName, { size: iconSize, alt: label })}
      <span>{label}</span>
    </span>
  );
}
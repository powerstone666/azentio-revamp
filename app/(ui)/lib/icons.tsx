/**
 * @azentio/icons
 *
 * Phosphor icon helpers for Server and Client Components.
 *
 * ── Server Components ─────────────────────────────────────
 * Import from `@phosphor-icons/react/ssr` to avoid the
 * `createContext` client-only error. Use `getIcon()` to
 * resolve a name into the correct React element:
 *
 * ```tsx
 * import { getIcon } from '@/ui/lib/icons';
 * const Icon = getIcon('SquaresFour', { size: 24, weight: 'duotone' });
 * ```
 *
 * ── Client Components ─────────────────────────────────────
 * Import individual icons from `@phosphor-icons/react` directly
 * for interactivity (click handlers, state-driven toggles,
 * etc.). The SSR variants are stateless renderables only.
 */

import type { IconProps } from '@phosphor-icons/react';
import {
  SquaresFour,
  Note,
  ListChecks,
  Lightbulb,
  Wrench,
  Buildings,
  Flask,
  Broadcast,
  MagnifyingGlass,
  Bell,
  User,
  SignOut,
  CaretDown,
  X,
  Check,
  Warning,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash,
  PencilSimple,
  Eye,
  EyeSlash,
  Lock,
  ShieldCheck,
  ChartBar,
  Users,
  Gear,
  Question,
  Info,
  Star,
} from '@phosphor-icons/react/dist/ssr';

// ───────────────────────────────────────────────────────────
// Icon registry
// ───────────────────────────────────────────────────────────
//
// Map human-readable keys to SSR-compatible Phosphor components.
// Extend this map when the design system adds new icons.
// ───────────────────────────────────────────────────────────

const iconMap = {
  SquaresFour,
  Note,
  ListChecks,
  Lightbulb,
  Wrench,
  Buildings,
  Flask,
  Broadcast,
  MagnifyingGlass,
  Bell,
  User,
  SignOut,
  CaretDown,
  X,
  Check,
  Warning,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash,
  PencilSimple,
  Eye,
  EyeSlash,
  Lock,
  ShieldCheck,
  ChartBar,
  Users,
  Gear,
  Question,
  Info,
  Star,
} as const;

export type IconName = keyof typeof iconMap;

// ───────────────────────────────────────────────────────────
// getIcon options
// ───────────────────────────────────────────────────────────

interface GetIconOptions {
  /** Icon pixel size (maps to width + height). Default 24. */
  size?: number;
  /**
   * Icon weight style:
   * - `'regular'`  — default, outlined
   * - `'bold'`     — heavier stroke
   * - `'duotone'`  — two-tone (accent colour applied via CSS)
   */
  weight?: 'regular' | 'bold' | 'duotone';
  /** Additional CSS class names */
  className?: string;
  /** Accessible label (sets aria-label and <title>) */
  alt?: string;
}

/**
 * Resolve a human-friendly icon name into a Phosphor `<svg>`
 * React element suitable for Server Components.
 *
 * Falls back to `Question` when the requested name is not
 * found in the registry.
 *
 * @example
 * ```tsx
 * const icon = getIcon('Star', { size: 20, weight: 'duotone' });
 * return <div>{icon}</div>;
 * ```
 */
export function getIcon(
  name: IconName | string,
  options: GetIconOptions = {},
): React.ReactElement {
  const {
    size = 24,
    weight = 'regular',
    className = '',
    alt,
  } = options;

  const Component =
    iconMap[name as IconName] ?? iconMap.Question;

  const iconProps: IconProps & { key?: string } = {
    size,
    weight,
    className,
    'aria-label': alt,
  };

  // Phosphor uses the `alt` prop for the SVG <title> element
  if (alt) {
    (iconProps as Record<string, unknown>).alt = alt;
  }

  return <Component {...iconProps} />;
}

/**
 * Returns `true` when `name` is a recognised icon key.
 */
export function isValidIcon(name: string): name is IconName {
  return name in iconMap;
}

/**
 * Full list of available icon names (readonly).
 */
export const availableIcons = Object.keys(iconMap) as IconName[];

// Re-export the components individually for consumers that
// prefer direct imports (e.g. Client Components needing
// interactive event handlers).
export {
  SquaresFour,
  Note,
  ListChecks,
  Lightbulb,
  Wrench,
  Buildings,
  Flask,
  Broadcast,
  MagnifyingGlass,
  Bell,
  User,
  SignOut,
  CaretDown,
  X,
  Check,
  Warning,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash,
  PencilSimple,
  Eye,
  EyeSlash,
  Lock,
  ShieldCheck,
  ChartBar,
  Users,
  Gear,
  Question,
  Info,
  Star,
};
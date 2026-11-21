import { createElement, type ElementType } from "react";

// Kumo, packages/kumo/src/components/surface/surface.tsx from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.0), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
// Changes from Kumo's file: import paths.
// Unofficial; not affiliated with or endorsed by Cloudflare.
//
// MIT License Copyright (c) 2026 Cloudflare, Inc.
//
// Permission is hereby granted, free of
// charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice
// (including the next paragraph) shall be included in all copies or substantial
// portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
// ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
// EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
// OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import { cn } from "@/lib/kumo/cn";
import { resolveVariant } from "@/lib/kumo/resolve-variant";
import { LayerCard, type LayerCardProps } from "@/components/ui/layer-card/layer-card";

/** Surface color variant definitions. */
export const KUMO_SURFACE_VARIANTS = {
  color: {
    primary: {
      classes: "",
      description: "Primary surface color",
    },
    secondary: {
      classes: "",
      description: "Secondary surface color",
    },
  },
} as const;

export const KUMO_SURFACE_DEFAULT_VARIANTS = {
  color: "primary",
} as const;

// Derived types from KUMO_SURFACE_VARIANTS
export type KumoSurfaceColor = keyof typeof KUMO_SURFACE_VARIANTS.color;

export interface KumoSurfaceVariantsProps {
  /**
   * Surface color variant.
   * - `"primary"` — Primary surface color
   * - `"secondary"` — Secondary surface color
   * @default "primary"
   */
  color?: KumoSurfaceColor;
}

export function surfaceVariants({
  color = KUMO_SURFACE_DEFAULT_VARIANTS.color,
}: KumoSurfaceVariantsProps = {}) {
  return resolveVariant(
    KUMO_SURFACE_VARIANTS.color,
    color,
    KUMO_SURFACE_DEFAULT_VARIANTS.color,
  ).classes;
}

/**
 * Surface component props.
 *
 * @deprecated Use `LayerCard` instead. `Surface` is now a compatibility wrapper
 * around `LayerCard` for simple one-layer card containers.
 *
 * @example
 * ```tsx
 * <Surface className="rounded-lg p-4">Card content</Surface>
 * <Surface render={<section />} className="rounded-lg p-6">Section content</Surface>
 * ```
 */
export type SurfaceProps = LayerCardProps &
  KumoSurfaceVariantsProps & {
    /**
     * @deprecated Use the `render` prop instead.
     * @example `<Surface render={<section />}>` instead of `<Surface as="section">`
     */
    as?: ElementType;
  };

/**
 * @deprecated Use `LayerCard` instead.
 *
 * Polymorphic compatibility wrapper that preserves the `Surface` API while
 * delegating rendering and styling to `LayerCard`.
 *
 * @example
 * ```tsx
 * <LayerCard className="rounded-lg p-4">Card content</LayerCard>
 * ```
 */
export const Surface = function Surface({
  color = "primary",
  className,
  render,
  as,
  ...props
}: SurfaceProps) {
  const resolvedRender = render ?? (as ? createElement(as) : undefined);
  return (
    <LayerCard
      className={cn("overflow-visible rounded-none", className)}
      render={resolvedRender}
      {...props}
      data-surface-color={color}
      data-deprecated="surface"
    />
  );
};

Surface.displayName = "Surface";

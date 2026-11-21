"use client";

// Kumo, packages/kumo/src/utils/resolve-variant.ts from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.0), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
// Changes from Kumo's file: import paths, and the "use client" line Kumo's build adds.
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

/**
 * Safely resolve a variant config from a variants map, falling back
 * to a known-good default when the key doesn't match any entry.
 *
 * This prevents `TypeError: Cannot read properties of undefined`
 * when a component receives an invalid variant value at runtime
 * (e.g. from untyped JS consumers, server data, or stale props).
 *
 * @param variants  – A dimension of a KUMO_*_VARIANTS object
 *                    (e.g. `KUMO_BUTTON_VARIANTS.variant`)
 * @param key       – The runtime value of the variant prop
 * @param fallback  – A key guaranteed to exist (typically from
 *                    KUMO_*_DEFAULT_VARIANTS)
 * @returns The matched config entry, or the fallback entry
 *
 * @example
 * ```ts
 * const config = resolveVariant(
 *   KUMO_BUTTON_VARIANTS.variant,
 *   variant,
 *   KUMO_BUTTON_DEFAULT_VARIANTS.variant,
 * );
 * // config.classes is always safe to access
 * ```
 */
export function resolveVariant<T extends Record<string, unknown>>(
  variants: T,
  key: string,
  fallback: keyof T & string,
): T[keyof T] {
  const config = (variants as Record<string, unknown>)[key] as
    T[keyof T] | undefined;

  if (config !== undefined) return config;

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[kumo] Unknown variant "${key}". Expected one of: ${Object.keys(variants).join(", ")}. Falling back to "${fallback}".`,
    );
  }

  return variants[fallback];
}

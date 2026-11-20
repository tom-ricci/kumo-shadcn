"use client";

// Kumo, packages/kumo/src/components/table-of-contents/use-table-of-contents-active-id.ts from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.0), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
// Changes from Kumo's file, all mechanical: import paths; `type` on type-only imports; `// @ts-ignore`
// above lines that only stricter app tsconfigs reject; the "use client" line Kumo's build adds.
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

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseTableOfContentsActiveIdOptions {
  /**
   * The ids of the section anchor elements to track, in document order.
   * Elements are resolved via `document.getElementById` on the client, so ids
   * that aren't in the DOM yet are simply ignored until they appear on a
   * subsequent change to `ids`.
   */
  ids: string[];
  /**
   * Distance in px from the top of the viewport (or `root`) to the scrollspy
   * activation line — typically the fixed header height, so the topmost
   * section actually in view is the one highlighted.
   *
   * @default 0
   */
  offset?: number;
  /**
   * The scroll container to track. Defaults to the viewport.
   *
   * @default null
   */
  root?: Element | null;
  /**
   * When enabled, the section named by `location.hash` is selected on mount
   * and on `hashchange`, so deep links highlight the right section.
   *
   * @default true
   */
  trackHash?: boolean;
}

export interface UseTableOfContentsActiveIdResult {
  /** The id of the section currently considered active, or `null`. */
  activeId: string | null;
  /**
   * Force a section active (e.g. from a ToC item's `onClick`), temporarily
   * pausing scrollspy so the chosen section sticks even when it's too short
   * to reach the activation line. Scrollspy resumes once scrolling settles.
   */
  selectSection: (id: string) => void;
}

/** How long scrolling must be quiet before a selected section unpins. */
const SCROLL_SETTLE_MS = 150;

/**
 * Table-of-contents scroll tracking.
 *
 * Derives the currently-active section from scroll position via an
 * `IntersectionObserver` (the topmost tracked section in view wins), and
 * exposes a `selectSection` action that pins a section on click — held until
 * scrolling settles, so short sections stay highlighted after a jump.
 * Hash deep-links are handled automatically unless `trackHash` is disabled.
 *
 * The `TableOfContents` component itself is purely presentational — pair this
 * hook with it to drive the `active` prop of each item.
 *
 * All DOM work happens in effects, so the hook is SSR-safe (`activeId` is
 * `null` on the server).
 *
 * @example
 * ```tsx
 * const { activeId, selectSection } = useTableOfContentsActiveId({
 *   ids: headings.map((h) => h.slug),
 *   offset: HEADER_HEIGHT,
 * });
 *
 * <TableOfContents.Item
 *   href="#intro"
 *   active={activeId === "intro"}
 *   onClick={() => selectSection("intro")}
 * >
 *   Introduction
 * </TableOfContents.Item>
 * ```
 */
export function useTableOfContentsActiveId({
  ids,
  offset = 0,
  root = null,
  trackHash = true,
}: UseTableOfContentsActiveIdOptions): UseTableOfContentsActiveIdResult {
  const [activeId, setActiveId] = useState<string | null>(null);

  // While pinned (after selectSection), scrollspy keeps tracking but doesn't
  // overwrite the active id until scrolling settles and it unpins.
  const pinned = useRef(false);

  // `ids` is typically rebuilt every render; key effects on its content.
  // \0 can't appear in a document id, so the round-trip is unambiguous.
  const idsKey = ids.join("\0");

  useEffect(() => {
    const elements = idsKey
      .split("\0")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    // Latest known intersection state per element, since observer callbacks
    // only include entries that changed.
    const intersecting = new Set<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            intersecting.add(entry.target);
          } else {
            intersecting.delete(entry.target);
          }
        }

        // Topmost tracked section in view, in document order. When nothing is
        // in view (e.g. inside a long section body), keep the last active id.
        const first = elements.find((el) => intersecting.has(el));
        if (first && !pinned.current) {
          setActiveId(first.id);
        }
      },
      { root, rootMargin: `-${offset}px 0px 0px 0px` },
    );

    for (const el of elements) observer.observe(el);

    return () => observer.disconnect();
  }, [idsKey, offset, root]);

  // Pending unpin work, torn down on unmount and superseded by rapid clicks.
  const settleTimer = useRef<number | undefined>(undefined);
  const cancelPendingUnpin = useRef<(() => void) | null>(null);

  const selectSection = useCallback(
    (id: string) => {
      cancelPendingUnpin.current?.();
      pinned.current = true;
      setActiveId(id);

      // Unpin once scrolling has been quiet for a beat: every scroll event
      // (including the smooth scroll to the target) pushes the deadline back.
      // Works without `scrollend`, which Safari didn't support until 18.2.
      const scrollTarget: EventTarget = root ?? window;

      const armSettleTimer = () => {
        window.clearTimeout(settleTimer.current);
        settleTimer.current = window.setTimeout(() => {
          cancelPendingUnpin.current?.();
          pinned.current = false;
        }, SCROLL_SETTLE_MS);
      };

      scrollTarget.addEventListener("scroll", armSettleTimer, {
        passive: true,
      });
      cancelPendingUnpin.current = () => {
        window.clearTimeout(settleTimer.current);
        scrollTarget.removeEventListener("scroll", armSettleTimer);
        cancelPendingUnpin.current = null;
      };

      armSettleTimer();
    },
    [root],
  );

  useEffect(() => () => cancelPendingUnpin.current?.(), []);

  // Deep links: select the hash section on mount and whenever the hash
  // changes, but only if it's one of the tracked sections.
  useEffect(() => {
    if (!trackHash) return;

    const knownIds = new Set(idsKey.split("\0"));
    const syncFromHash = () => {
      let id = window.location.hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        // Malformed percent escape (e.g. an id containing a literal "%").
        // Browsers leave "%" unencoded in fragments, so match the raw hash.
      }
      if (id && knownIds.has(id)) selectSection(id);
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [trackHash, idsKey, selectSection]);

  return { activeId, selectSection };
}

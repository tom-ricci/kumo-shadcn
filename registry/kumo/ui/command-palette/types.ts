"use client";

// Kumo, packages/kumo/src/components/command-palette/types.ts from https://github.com/cloudflare/kumo
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

import type { ReactNode, InputHTMLAttributes } from "react";
import type { PortalContainer } from "@/lib/kumo/portal-provider";

/** A single highlight range within a string [startIndex, endIndex] (inclusive) */
export type HighlightRange = [number, number];

/**
 * Props for the CommandPalette.Root component - main dialog wrapper with Autocomplete
 *
 * Keyboard navigation (arrow keys, Enter) is enabled automatically via the Autocomplete primitive.
 * The items array can be flat or grouped - the Autocomplete handles both patterns.
 *
 * @template TGroup - The type of items in the list (groups when using getSelectableItems)
 * @template TItem - The type of selectable items (defaults to TGroup for flat lists)
 */
export interface CommandPaletteRootProps<TGroup, TItem = TGroup> {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void;
  /**
   * Optional callback when backdrop is clicked.
   * Receives the mouse event for position tracking (e.g., for ripple effects).
   * If not provided, backdrop click calls onOpenChange(false).
   */
  onBackdropClick?: (e: React.MouseEvent) => void;
  /** Child components (Input, List, Footer, etc.) */
  children: ReactNode;
  /**
   * Items for the command palette. Enables keyboard navigation (arrow keys, Enter).
   * Can be a flat array or grouped items - use with Autocomplete.List render function.
   */
  items: TGroup[];
  /** Controlled input value for the search */
  value?: string;
  /** Callback when input value changes */
  onValueChange?: (value: string) => void;
  /** Callback when an item is highlighted (arrow keys or hover) */
  onItemHighlighted?: (
    item: TGroup | undefined,
    details: { reason: string; event: Event; index: number },
  ) => void;
  /**
   * Convert item to display string. Required when items are objects.
   * Used for accessibility and typeahead search.
   */
  itemToStringValue?: (item: TGroup) => string;
  /**
   * Custom filter function. Return true to include item in results.
   * Defaults to showing all items (consumer handles filtering).
   */
  filter?: (item: TGroup, query: string) => boolean;
  /**
   * Callback when an item is selected via Cmd/Ctrl+Enter keyboard shortcut.
   * Receives the selectable item (TItem type when using getSelectableItems).
   * newTab is always true for this callback (Cmd/Ctrl+Enter).
   */
  onSelect?: (item: TItem, options: { newTab: boolean }) => void;
  /**
   * Function to get the flat list of selectable items from the items array.
   * Required when using grouped items (e.g., items is an array of groups).
   * If not provided, assumes items is a flat array of selectable items.
   */
  getSelectableItems?: (items: TGroup[]) => TItem[];
  /**
   * Container element for the portal. Use this to render the command palette inside
   * a Shadow DOM or custom container. Overrides `KumoPortalProvider` context.
   * @default document.body (or KumoPortalProvider container if set)
   */
  container?: PortalContainer;
}

/**
 * Props for the CommandPalette.Item component - individual result item
 * @template T - The type of the item value
 */
export interface CommandPaletteItemProps<T = unknown> {
  /** The value associated with this item */
  value: T;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Content to render inside the item */
  children: ReactNode;
  /** Click handler - use e.metaKey || e.ctrlKey to detect new tab intent */
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Props for the CommandPalette.Footer component - keyboard hints footer
 */
export interface CommandPaletteFooterProps {
  /** Custom children to override default keyboard hints */
  children?: ReactNode;
}

/**
 * Props for the CommandPalette.List component - scrollable results container
 */
export interface CommandPaletteListProps {
  /** Result items or groups to render */
  children: ReactNode;
}

/**
 * Props for the CommandPalette.Group component - category grouping
 */
export interface CommandPaletteGroupProps {
  /** Group content (items) */
  children: ReactNode;
}

/**
 * Props for the CommandPalette.GroupLabel component - section header
 */
export interface CommandPaletteGroupLabelProps {
  /** Label text to display */
  children: ReactNode;
}

/**
 * Props for the CommandPalette.Empty component - empty state
 */
export interface CommandPaletteEmptyProps {
  /** Custom empty message, defaults to "No results found" */
  children?: ReactNode;
}

/**
 * Props for the CommandPalette.Loading component - loading state
 */
export interface CommandPaletteLoadingProps {
  /** Optional custom loading content */
  children?: ReactNode;
}

/**
 * Props for the CommandPalette.ResultItem component - rich item with breadcrumbs and highlights
 */
export interface CommandPaletteResultItemProps<T = unknown> {
  /** Item title text */
  title: string;
  /** Optional breadcrumb path parts displayed before the title (e.g., ["Compute (Workers)"] for "Compute (Workers) > VPC") */
  breadcrumbs?: string[];
  /** Highlight ranges for the title, from Fuse.js match indices */
  titleHighlights?: HighlightRange[];
  /** Highlight ranges for each breadcrumb, parallel array to breadcrumbs */
  breadcrumbHighlights?: HighlightRange[][];
  /** Optional description displayed after the title (for non-navigation items like search tips) */
  description?: string;
  /** Optional icon to display before the title */
  icon?: ReactNode;
  /** The value associated with this item (for Autocomplete) */
  value: T;
  /** Click handler - use e.metaKey || e.ctrlKey to detect new tab intent */
  onClick: (e: React.MouseEvent) => void;
  /** Whether to show arrow indicator on highlight (default: true) */
  showArrow?: boolean;
  /** Whether this links to an external URL (shows external icon) */
  external?: boolean;
  /** Whether this item is non-interactive (no hover/highlight) */
  nonInteractive?: boolean;
}

/**
 * Props for the CommandPalette.Input component - search input inside the palette.
 *
 * Extends standard HTML input attributes so you can pass props like
 * `autoComplete`, `autoCorrect`, `autoCapitalize`, `spellCheck`, `data-*`, etc.
 */
export interface CommandPaletteInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "defaultValue" | "defaultChecked" | "color"
> {
  /** Optional leading content (e.g., back button) */
  leading?: ReactNode;
  /** Optional trailing content (e.g., Esc button) */
  trailing?: ReactNode;
}

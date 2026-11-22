import { Tooltip } from "@/components/ui/tooltip/tooltip";

// Kumo, packages/kumo/src/components/menubar/menubar.tsx from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.0), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
// Changes from Kumo's file: import paths.
// Also changed: transitions without a duration-* class use --kumo-transition-duration (Kumo's 100ms), not your theme's default duration.
// Also changed: cn comes from your shadcn utils (@/lib/utils).
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

import { cn } from "@/lib/utils";
import { IconContext } from "@/lib/kumo/icons";
import React, { useRef } from "react";
import { useMenuNavigation } from "./use-menu-navigation";

/** MenuBar variant definitions (currently empty, reserved for future additions). */
export const KUMO_MENUBAR_VARIANTS = {
  // MenuBar currently has no variant options but structure is ready for future additions
} as const;

export const KUMO_MENUBAR_DEFAULT_VARIANTS = {} as const;

// Derived types from KUMO_MENUBAR_VARIANTS
export interface KumoMenuBarVariantsProps {}

export function menuBarVariants(_props: KumoMenuBarVariantsProps = {}) {
  return cn(
    // Base styles
    "flex rounded-lg border border-kumo-recessed bg-kumo-recessed pl-px shadow-xs transition-colors duration-(--kumo-transition-duration)",
  );
}

/** Props for an individual menu option within a MenuBar. */
type MenuOptionProps = {
  /** Icon element (typically from `@phosphor-icons/react`) rendered at 18px */
  icon: React.ReactNode;
  /** Unique identifier for the option (used when `optionIds` is true) */
  id?: number | string;
  /** Currently active value from the parent MenuBar */
  isActive?: number | boolean | string | undefined;
  /** Callback when this option is clicked */
  onClick: () => void;
  /** Tooltip text shown on hover */
  tooltip: string;
};

const MenuOption = ({
  icon,
  id,
  isActive,
  onClick,
  tooltip,
}: MenuOptionProps) => {
  const button = (
    <button
      data-kumo-component="MenuBar"
      data-kumo-part="option"
      aria-label={tooltip}
      className={cn(
        "relative -ml-px flex h-full w-11 cursor-pointer items-center justify-center rounded-md border-none bg-kumo-recessed transition-colors duration-(--kumo-transition-duration) first:rounded-l-lg last:rounded-r-lg focus:z-3 focus:ring-kumo-focus/50 focus:outline-hidden focus-visible:z-3 focus-visible:ring-2 focus-visible:ring-kumo-brand",
        {
          "z-2 bg-kumo-base shadow-xs transition-colors duration-(--kumo-transition-duration)": isActive === id,
        },
      )}
      onClick={onClick}
    >
      <IconContext.Provider value={{ size: 18 }} {...({} as any)}>
        {icon}
      </IconContext.Provider>
    </button>
  );

  return <Tooltip content={tooltip} render={button} />;
};

/**
 * MenuBar component props.
 *
 * Horizontal icon-button toolbar with keyboard navigation and tooltip labels.
 *
 * @deprecated Use `Tabs` with `variant="segmented"` instead. `MenuBar` will be removed in a future release.
 *
 * @example
 * ```tsx
 * <MenuBar
 *   isActive={activeIndex}
 *   options={[
 *     { icon: <ListIcon />, tooltip: "List view", onClick: () => setView("list") },
 *     { icon: <GridFourIcon />, tooltip: "Grid view", onClick: () => setView("grid") },
 *   ]}
 * />
 * ```
 */
type MenuBarProps = {
  /** Additional CSS classes merged via `cn()`. */
  className?: string;
  /** The currently active option value — matched against option index or `id`. */
  isActive: number | boolean | string | undefined;
  /** Array of menu option configurations. */
  options: MenuOptionProps[];
  /** When true, each option's `id` field is used for matching instead of its array index. */
  optionIds?: boolean;
};

/**
 * MenuBar — horizontal icon-button toolbar with keyboard arrow-key navigation.
 *
 * Each option renders as a `<button>` with a Tooltip. The active option is
 * visually highlighted with an elevated background.
 *
 * @deprecated Use `Tabs` with `variant="segmented"` instead. `MenuBar` will be removed in a future release.
 *
 * @example
 * ```tsx
 * <MenuBar
 *   isActive={0}
 *   options={[
 *     { icon: <ListIcon />, tooltip: "List", onClick: () => {} },
 *     { icon: <GridFourIcon />, tooltip: "Grid", onClick: () => {} },
 *   ]}
 * />
 * ```
 */
export const MenuBar = ({
  className,
  isActive,
  options,
  optionIds = false, // if option needs an extra unique ID
}: MenuBarProps) => {
  const menuRef = useRef<HTMLElement | null>(null);

  useMenuNavigation({ menuRef, direction: "horizontal" });

  return (
    <nav
      className={cn(
        "isolate flex rounded-lg bg-kumo-recessed pl-px shadow-xs ring ring-kumo-line transition-colors duration-(--kumo-transition-duration)",
        className,
      )}
      ref={menuRef}
    >
      {options.map((option, index) => (
        <MenuOption
          key={index}
          {...option}
          isActive={isActive}
          id={optionIds ? option.id : index}
        />
      ))}
    </nav>
  );
};

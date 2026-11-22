import { Collapsible as CollapsibleBase } from "@base-ui/react/collapsible";

// Kumo, packages/kumo/src/components/collapsible/collapsible.tsx from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.0), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
// Changes from Kumo's file: import paths.
// Also changed: Kumo's type scale classes (text-xs, text-sm, text-base, text-lg) read --kumo-font-size-* and --kumo-line-height-*, not your theme's --text-*.
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

import { CaretDownIcon } from "@/lib/kumo/icons";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// Variants
// =============================================================================

export const KUMO_COLLAPSIBLE_VARIANTS = {} as const;

export const KUMO_COLLAPSIBLE_DEFAULT_VARIANTS = {} as const;

export interface KumoCollapsibleVariantsProps {}

export function collapsibleVariants(_props: KumoCollapsibleVariantsProps = {}) {
  return cn();
}

// =============================================================================
// Collapsible Root
// =============================================================================

type BaseRootProps = ComponentPropsWithoutRef<typeof CollapsibleBase.Root>;

export interface CollapsibleRootProps extends BaseRootProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Root component that manages collapsible state.
 *
 * @example
 * ```tsx
 * <Collapsible.Root open={open} onOpenChange={setOpen}>
 *   <Collapsible.Trigger>Toggle</Collapsible.Trigger>
 *   <Collapsible.Panel>Content</Collapsible.Panel>
 * </Collapsible.Root>
 * ```
 */
function CollapsibleRoot({ className, ...props }: CollapsibleRootProps) {
  return <CollapsibleBase.Root className={className} {...props} />;
}

CollapsibleRoot.displayName = "Collapsible.Root";

// =============================================================================
// Collapsible Trigger
// =============================================================================

type BaseTriggerProps = ComponentPropsWithoutRef<
  typeof CollapsibleBase.Trigger
>;

export interface CollapsibleTriggerProps extends BaseTriggerProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Button that toggles the collapsible panel visibility.
 * Use the `render` prop to customize the trigger element.
 *
 * @example
 * ```tsx
 * // Default button
 * <Collapsible.Trigger>Show more</Collapsible.Trigger>
 *
 * // Custom trigger element
 * <Collapsible.Trigger render={<Button variant="ghost" />}>
 *   Toggle details
 * </Collapsible.Trigger>
 * ```
 */
const CollapsibleTrigger = forwardRef<
  HTMLButtonElement,
  CollapsibleTriggerProps
>(({ className, ...props }, ref) => {
  return (
    <CollapsibleBase.Trigger
      ref={ref}
      data-kumo-component="Collapsible"
      data-kumo-part="trigger"
      className={cn("cursor-pointer", className)}
      {...props}
    />
  );
});

CollapsibleTrigger.displayName = "Collapsible.Trigger";

// =============================================================================
// Collapsible Panel
// =============================================================================

type BasePanelProps = ComponentPropsWithoutRef<typeof CollapsibleBase.Panel>;

export interface CollapsiblePanelProps extends BasePanelProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Container for collapsible content. Renders when the collapsible is open.
 *
 * @example
 * ```tsx
 * <Collapsible.Panel className="mt-2 space-y-4">
 *   <Text>Revealed content here</Text>
 * </Collapsible.Panel>
 * ```
 */
const CollapsiblePanel = forwardRef<HTMLDivElement, CollapsiblePanelProps>(
  ({ className, ...props }, ref) => {
    return <CollapsibleBase.Panel ref={ref} className={className} {...props} />;
  },
);

CollapsiblePanel.displayName = "Collapsible.Panel";

// =============================================================================
// Default Trigger (Migration Affordance)
// =============================================================================

export interface CollapsibleDefaultTriggerProps {
  /** Label text displayed in the trigger */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Pre-styled trigger with text label and animated caret icon.
 * Provides the same visual style as the previous Collapsible API.
 *
 * Use this for quick migration or when you want the default Kumo style.
 *
 * @example
 * ```tsx
 * <Collapsible.Root>
 *   <Collapsible.DefaultTrigger>Show details</Collapsible.DefaultTrigger>
 *   <Collapsible.Panel>Content</Collapsible.Panel>
 * </Collapsible.Root>
 * ```
 */
const CollapsibleDefaultTrigger = forwardRef<
  HTMLButtonElement,
  CollapsibleDefaultTriggerProps
>(({ children, className }, ref) => {
  return (
    <CollapsibleBase.Trigger
      ref={ref}
      data-kumo-component="Collapsible"
      data-kumo-part="default-trigger"
      className={cn(
        // Defensive resets to prevent global button styles from polluting the trigger
        "m-0 border-none bg-transparent p-0 shadow-none",
        // Base styles for the trigger
        "flex cursor-pointer items-center gap-1 text-(length:--kumo-font-size-base)/[var(--tw-leading,var(--kumo-line-height-base))] font-medium text-kumo-default select-none",
        className,
      )}
    >
      <span>{children}</span>
      <span className="inline-grid w-4 shrink-0 place-items-center">
        <CaretDownIcon
          aria-hidden
          size={12}
          weight="bold"
          className="block size-3 origin-center transition-transform duration-100 ease-out [[data-panel-open]_&]:rotate-180"
        />
      </span>
    </CollapsibleBase.Trigger>
  );
});

CollapsibleDefaultTrigger.displayName = "Collapsible.DefaultTrigger";

// =============================================================================
// Default Panel (Migration Affordance)
// =============================================================================

export interface CollapsibleDefaultPanelProps extends BasePanelProps {
  /** Panel content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Pre-styled panel with left border accent and standard spacing.
 * Provides the same visual style as the previous Collapsible API.
 *
 * @example
 * ```tsx
 * <Collapsible.Root>
 *   <Collapsible.DefaultTrigger>Show details</Collapsible.DefaultTrigger>
 *   <Collapsible.DefaultPanel>
 *     <Text>Content with default styling</Text>
 *   </Collapsible.DefaultPanel>
 * </Collapsible.Root>
 * ```
 */
const CollapsibleDefaultPanel = forwardRef<
  HTMLDivElement,
  CollapsibleDefaultPanelProps
>(({ children, className, ...props }, ref) => {
  return (
    <CollapsibleBase.Panel
      ref={ref}
      className={cn(
        "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height,opacity] duration-100 ease-out data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 [&[hidden]:not([hidden='until-found'])]:hidden",
        className,
      )}
      {...props}
    >
      <div className="my-2 space-y-4 border-l-2 border-kumo-fill py-1 pr-1 pl-4">
        {children}
      </div>
    </CollapsibleBase.Panel>
  );
});

CollapsibleDefaultPanel.displayName = "Collapsible.DefaultPanel";

// =============================================================================
// Compound Component Export
// =============================================================================

/**
 * Collapsible — a composable disclosure component for showing/hiding content.
 *
 * Built on Base UI's Collapsible with full composition support.
 *
 * ## Basic Usage
 *
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <Collapsible.Root open={open} onOpenChange={setOpen}>
 *   <Collapsible.Trigger render={<Button variant="ghost" />}>
 *     Show details
 *   </Collapsible.Trigger>
 *   <Collapsible.Panel className="mt-2">
 *     <Text>Hidden content revealed when expanded.</Text>
 *   </Collapsible.Panel>
 * </Collapsible.Root>
 * ```
 *
 * ## With Default Styling
 *
 * Use `DefaultTrigger` and `DefaultPanel` for the classic Kumo style:
 *
 * ```tsx
 * <Collapsible.Root>
 *   <Collapsible.DefaultTrigger>Show details</Collapsible.DefaultTrigger>
 *   <Collapsible.DefaultPanel>
 *     <Text>Content with border-left accent</Text>
 *   </Collapsible.DefaultPanel>
 * </Collapsible.Root>
 * ```
 *
 * ## Controlled Accordion Pattern
 *
 * ```tsx
 * const [activeIndex, setActiveIndex] = useState<number | null>(null);
 *
 * {items.map((item, i) => (
 *   <Collapsible.Root
 *     key={i}
 *     open={activeIndex === i}
 *     onOpenChange={(open) => setActiveIndex(open ? i : null)}
 *   >
 *     <Collapsible.DefaultTrigger>{item.title}</Collapsible.DefaultTrigger>
 *     <Collapsible.DefaultPanel>{item.content}</Collapsible.DefaultPanel>
 *   </Collapsible.Root>
 * ))}
 * ```
 */
export const Collapsible = Object.assign(CollapsibleRoot, {
  Root: CollapsibleRoot,
  Trigger: CollapsibleTrigger,
  Panel: CollapsiblePanel,
  DefaultTrigger: CollapsibleDefaultTrigger,
  DefaultPanel: CollapsibleDefaultPanel,
});

// =============================================================================
// Type Exports
// =============================================================================

export type CollapsibleProps = CollapsibleRootProps;

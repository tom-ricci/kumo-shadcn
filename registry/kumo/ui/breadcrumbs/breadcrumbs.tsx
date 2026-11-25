import {
  Children,
  cloneElement,
  isValidElement,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
} from "react";

// Kumo, packages/kumo/src/components/breadcrumbs/breadcrumbs.tsx from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.1), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
// Changes from Kumo's file: import paths.
// Also changed: Kumo's type scale classes (text-xs, text-sm, text-base, text-lg) read --kumo-font-size-* and --kumo-line-height-*, not your theme's --text-*.
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

import { CheckIcon, CopyIcon } from "@/lib/kumo/icons";
import { Button } from "@/components/ui/button/button";
import { SkeletonLine } from "@/components/ui/loader/skeleton-line";
import { useLinkComponent } from "@/lib/kumo/link-provider";
import { cn } from "@/lib/utils";
import { useKumoLocale } from "@/lib/kumo/locale-provider";
import { resolveVariant } from "@/lib/kumo/resolve-variant";
import { useCopyFeedback } from "@/lib/kumo/use-copy-feedback";

/** Breadcrumbs size variant definitions. */
export const KUMO_BREADCRUMBS_VARIANTS = {
  size: {
    sm: {
      classes: "text-(length:--kumo-font-size-sm)/[var(--tw-leading,var(--kumo-line-height-sm))] h-10 gap-0.5",
      description: "Compact breadcrumbs for dense UIs",
    },
    base: {
      classes: "text-(length:--kumo-font-size-base)/[var(--tw-leading,var(--kumo-line-height-base))] h-12 gap-1",
      description: "Default breadcrumbs size",
    },
  },
} as const;

export const KUMO_BREADCRUMBS_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type KumoBreadcrumbsSize = keyof typeof KUMO_BREADCRUMBS_VARIANTS.size;

export interface KumoBreadcrumbsVariantsProps {
  /**
   * Size of the breadcrumbs.
   * - `"sm"` — Compact breadcrumbs for dense UIs
   * - `"base"` — Default breadcrumbs size
   * @default "base"
   */
  size?: KumoBreadcrumbsSize;
}

export function breadcrumbsVariants({
  size = KUMO_BREADCRUMBS_DEFAULT_VARIANTS.size,
}: KumoBreadcrumbsVariantsProps = {}) {
  return cn(
    "group me-4 flex min-w-0 grow items-center overflow-hidden whitespace-nowrap",
    resolveVariant(
      KUMO_BREADCRUMBS_VARIANTS.size,
      size,
      KUMO_BREADCRUMBS_DEFAULT_VARIANTS.size,
    ).classes,
  );
}

export interface BreadcrumbsItemProps {
  href: string;
  icon?: React.ReactNode;
}

const Link = ({
  href,
  icon,
  children,
}: PropsWithChildren<BreadcrumbsItemProps>) => {
  const LinkComponent = useLinkComponent();

  return (
    <LinkComponent
      data-kumo-component="Breadcrumbs"
      data-kumo-part="link"
      to={href}
      // Ancestors do not shrink. Letting every crumb truncate proportionally
      // turns the whole trail into unreadable stubs ("Com… › Anal… › Acco…");
      // the current page is the only crumb allowed to give up width.
      className="flex shrink-0 items-center gap-1 whitespace-nowrap text-kumo-subtle no-underline"
    >
      {!!icon && <span className="flex shrink-0 items-center">{icon}</span>}
      <span>{children}</span>
    </LinkComponent>
  );
};

interface BreadcrumbsCurrentProps {
  loading?: boolean;
  icon?: React.ReactNode;
}

function Current({
  children,
  icon,
  loading,
}: PropsWithChildren<BreadcrumbsCurrentProps>) {
  if (loading) {
    return (
      <div className="flex w-[125px] min-w-0 items-center gap-1">
        {icon && <span className="flex shrink-0 items-center">{icon}</span>}
        <SkeletonLine />
      </div>
    );
  }

  return (
    <div
      className="flex max-w-full min-w-0 items-center gap-1 font-medium"
      aria-current="page"
    >
      {icon && <span className="flex shrink-0 items-center">{icon}</span>}
      <span className="truncate">{children}</span>
    </div>
  );
}

function Separator() {
  return (
    <span
      className="flex shrink-0 items-center text-kumo-inactive rtl:[&_svg]:rotate-180"
      aria-hidden="true"
    >
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M10.75 8.75L14.25 12L10.75 15.25"
        />
      </svg>
    </span>
  );
}

function MobileEllipsis() {
  return (
    <span className="flex shrink-0 items-center text-kumo-subtle" aria-hidden>
      ...
    </span>
  );
}

function Clipboard({ text }: { text: string }) {
  const { copied: isCopied, runCopy } = useCopyFeedback();
  const { breadcrumbs } = useKumoLocale();

  const handleCopyDeeplink = async () => {
    if (!text) return;

    await runCopy(
      () => navigator.clipboard.writeText(text),
      (error) => console.error("Failed to copy deeplink:", error),
    );
  };

  return (
    <Button
      variant="ghost"
      shape="square"
      size="sm"
      className="opacity-0 transition-[opacity] duration-(--kumo-transition-duration) group-hover:opacity-100"
      onClick={handleCopyDeeplink}
      title={breadcrumbs.copyTooltip}
      aria-label={breadcrumbs.copy}
    >
      {isCopied ? (
        <CheckIcon weight="bold" className="text-kumo-success" />
      ) : (
        <CopyIcon weight="regular" />
      )}
    </Button>
  );
}

/**
 * Breadcrumbs component props.
 *
 * @example
 * ```tsx
 * <Breadcrumbs>
 *   <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
 *   <Breadcrumbs.Separator />
 *   <Breadcrumbs.Link href="/docs">Docs</Breadcrumbs.Link>
 *   <Breadcrumbs.Separator />
 *   <Breadcrumbs.Current>Current Page</Breadcrumbs.Current>
 * </Breadcrumbs>
 * ```
 */
export interface BreadcrumbsProps
  extends PropsWithChildren, KumoBreadcrumbsVariantsProps {
  /** Additional CSS classes merged via `cn()`. */
  className?: string;
  /**
   * Accessible name of the breadcrumb `nav` landmark. Overrides
   * `breadcrumbs.label` from `KumoLocaleProvider`.
   * @default "breadcrumb"
   */
  "aria-label"?: string;
}

/**
 * Navigation breadcrumb trail showing the current page's location in a hierarchy.
 * Compound component with `Breadcrumbs.Link`, `Breadcrumbs.Current`, `Breadcrumbs.Separator`, and `Breadcrumbs.Clipboard`.
 *
 * @example
 * ```tsx
 * <Breadcrumbs>
 *   <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
 *   <Breadcrumbs.Separator />
 *   <Breadcrumbs.Current>Dashboard</Breadcrumbs.Current>
 * </Breadcrumbs>
 * ```
 */
export function Breadcrumb({
  children,
  size = "base",
  className,
  "aria-label": ariaLabel,
}: BreadcrumbsProps) {
  const { breadcrumbs } = useKumoLocale();
  const childArray = Children.toArray(children);
  const mobileChildren = getMobileBreadcrumbChildren(childArray);

  return (
    <nav
      className={cn(breadcrumbsVariants({ size }), className)}
      aria-label={ariaLabel ?? breadcrumbs.label}
    >
      <div className="contents sm:hidden">{mobileChildren}</div>
      <div className="hidden sm:contents">{childArray}</div>
    </nav>
  );
}

function isComponentElement(
  child: ReactNode,
  component: unknown,
): child is ReactElement {
  return isValidElement(child) && child.type === component;
}

function getMobileBreadcrumbChildren(children: ReactNode[]): ReactNode[] {
  const breadcrumbItems = children.filter(
    (child) =>
      isComponentElement(child, Link) || isComponentElement(child, Current),
  ) as ReactElement[];

  if (breadcrumbItems.length <= 2) {
    return children;
  }

  const [parentItem, currentItem] = breadcrumbItems.slice(-2);
  const trailingItems: ReactNode[] = [
    <MobileEllipsis key="kumo-breadcrumb-mobile-ellipsis" />,
    <Separator key="kumo-breadcrumb-mobile-separator-leading" />,
    cloneElement(parentItem, { key: "kumo-breadcrumb-mobile-parent" }),
    <Separator key="kumo-breadcrumb-mobile-separator-trailing" />,
    cloneElement(currentItem, { key: "kumo-breadcrumb-mobile-current" }),
  ];

  const extras = children.filter(
    (child) =>
      !isComponentElement(child, Link) &&
      !isComponentElement(child, Current) &&
      !isComponentElement(child, Separator),
  );

  return [...trailingItems, ...extras];
}

Breadcrumb.Link = Link;
Breadcrumb.Current = Current;
Breadcrumb.Separator = Separator;
Breadcrumb.Clipboard = Clipboard;

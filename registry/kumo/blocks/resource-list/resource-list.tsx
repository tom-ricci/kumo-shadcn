import type { ReactNode } from "react";

// Kumo, packages/kumo/src/blocks/resource-list/resource-list.tsx from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.1), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
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

import { cn } from "@/lib/utils";

export interface ResourceListPageProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  usage?: ReactNode;
  additionalContent?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * ResourceListPage - A layout component for resource list pages
 *
 * Layouts are page-level components that provide consistent structure
 * for common page patterns like resource lists, dashboards, and settings.
 */
export function ResourceListPage({
  title,
  description,
  icon,
  usage,
  additionalContent,
  children,
  className,
}: ResourceListPageProps) {
  return (
    <div
      className={cn("h-full min-h-screen w-full bg-kumo-overlay", className)}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col p-6 md:gap-4 md:p-8 lg:px-10 lg:py-9 xl:gap-6">
        <div className="flex flex-col">
          <div className="mb-1.5 flex items-center gap-1.5">
            {icon}
            <h1 className="font-heading m-0 p-0 text-3xl font-semibold">
              {title}
            </h1>
          </div>
          <p className="hidden p-0 text-(length:--kumo-font-size-lg)/[var(--tw-leading,var(--kumo-line-height-lg))] leading-normal text-pretty text-kumo-subtle md:block">
            {description}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-6 xl:flex-row xl:gap-8">
          <div className="min-w-0 grow">{children}</div>

          {(usage || additionalContent) && (
            <div
              className={`top-22 flex h-fit w-full shrink-0 flex-col gap-4 xl:sticky xl:w-[380px]`}
            >
              {usage}

              <div className={cn("hidden xl:block", usage ? "mt-6" : "")}>
                {additionalContent}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 xl:hidden">{additionalContent}</div>
      </div>
    </div>
  );
}

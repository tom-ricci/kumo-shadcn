"use client";

// Kumo, packages/kumo/src/blocks/delete-resource/delete-resource.tsx from https://github.com/cloudflare/kumo
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

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogRoot,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog/index";
import { Input } from "@/components/ui/input/index";
import { Button } from "@/components/ui/button/index";
import { cn } from "@/lib/kumo/cn";
import {
  CheckIcon,
  CopyIcon,
  WarningCircleIcon,
  XIcon,
} from "@/lib/kumo/icons";
import { Banner } from "@/components/ui/banner/index";
import { useCopyFeedback } from "@/lib/kumo/use-copy-feedback";

export const KUMO_DELETE_RESOURCE_VARIANTS = {
  size: {
    sm: {
      classes: "",
      description: "Small dialog for simple delete confirmations",
    },
    base: {
      classes: "",
      description: "Default delete confirmation dialog size",
    },
  },
} as const;

export const KUMO_DELETE_RESOURCE_DEFAULT_VARIANTS = {
  size: "base",
} as const;

export type KumoDeleteResourceSize =
  keyof typeof KUMO_DELETE_RESOURCE_VARIANTS.size;

export interface KumoDeleteResourceVariantsProps {
  size?: KumoDeleteResourceSize;
}

export interface DeleteResourceProps extends KumoDeleteResourceVariantsProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** The type of resource being deleted (e.g., "Zone", "Worker", "KV Namespace") */
  resourceType: string;
  /** The name of the specific resource being deleted */
  resourceName: string;
  /** Callback when delete is confirmed */
  onDelete: () => void | Promise<void>;
  /** Whether the delete action is in progress */
  isDeleting?: boolean;
  /** Whether the confirmation input should be case-sensitive (default: true) */
  caseSensitive?: boolean;
  /** Custom delete button text (defaults to "Delete {resourceType}") */
  deleteButtonText?: string;
  /** Additional className for the dialog */
  className?: string;
  /** Error message to display if the delete action fails */
  errorMessage?: string;
}

export function DeleteResource({
  open,
  onOpenChange,
  resourceType,
  resourceName,
  onDelete,
  isDeleting = false,
  caseSensitive = true,
  deleteButtonText,
  size = KUMO_DELETE_RESOURCE_DEFAULT_VARIANTS.size,
  errorMessage,
  className,
}: DeleteResourceProps) {
  const [confirmationInput, setConfirmationInput] = useState("");
  const { copied, runCopy, reset: resetCopyFeedback } = useCopyFeedback(1500);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!open) {
      resetCopyFeedback();
      setConfirmationInput("");
    }
  }, [open, resetCopyFeedback]);

  const normalizeForComparison = useCallback(
    (str: string) => (caseSensitive ? str : str.toLowerCase()),
    [caseSensitive],
  );

  const isConfirmed =
    normalizeForComparison(confirmationInput) ===
    normalizeForComparison(resourceName);

  const handleDelete = useCallback(async () => {
    if (!isConfirmed || isDeleting) return;
    await onDelete();
  }, [isConfirmed, isDeleting, onDelete]);

  const handleCopy = useCallback(async () => {
    if (!openRef.current) return;

    await runCopy(
      () => navigator.clipboard.writeText(resourceName),
      (error) => console.warn("Clipboard copy failed", error),
    );
  }, [resourceName, runCopy]);

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <Dialog size={size} className={cn("p-0", className)}>
        <div className="flex items-center justify-between border-b border-kumo-line px-6 py-4">
          <DialogTitle className="text-lg font-semibold">
            Delete {resourceName}
          </DialogTitle>
          <DialogClose
            render={(props) => (
              <Button
                {...props}
                variant="ghost"
                shape="square"
                size="sm"
                aria-label="Close"
                disabled={isDeleting}
              >
                <XIcon size={18} />
              </Button>
            )}
          />
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            {errorMessage && (
              <Banner icon={<WarningCircleIcon />} variant="error">
                {errorMessage}
              </Banner>
            )}
            <p className="max-w-prose text-base text-pretty text-kumo-subtle">
              This action cannot be undone. This will permanently delete the{" "}
              <span className="font-medium text-kumo-default">
                {resourceName}
              </span>{" "}
              {resourceType.toLowerCase()}.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-base">
              <span>
                Type{" "}
                <button
                  className="group inline rounded-md bg-kumo-tint px-2 py-1 font-mono text-sm font-semibold hover:cursor-pointer hover:bg-kumo-fill"
                  onClick={handleCopy}
                  aria-label={`Copy ${resourceName} to clipboard`}
                >
                  {resourceName}

                  {copied ? (
                    <CheckIcon
                      size={12}
                      weight="bold"
                      className="ml-1.5 inline"
                    />
                  ) : (
                    <CopyIcon
                      size={12}
                      weight="bold"
                      className="ml-1.5 inline text-kumo-subtle group-hover:text-kumo-default"
                    />
                  )}
                </button>{" "}
                to confirm:
              </span>
            </div>
            <Input
              placeholder={resourceName}
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              disabled={isDeleting}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={`Type ${resourceName} to confirm deletion`}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-kumo-line px-6 py-4">
          <DialogClose
            render={(props) => (
              <Button {...props} variant="secondary" disabled={isDeleting}>
                Cancel
              </Button>
            )}
          />
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            loading={isDeleting}
          >
            {deleteButtonText || `Delete ${resourceType}`}
          </Button>
        </div>
      </Dialog>
    </DialogRoot>
  );
}

DeleteResource.displayName = "DeleteResource";

import React, { useEffect, useRef } from "react";

// Kumo, packages/kumo/src/components/menubar/use-menu-navigation.ts from https://github.com/cloudflare/kumo
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


type UseMenuNavigationProps = {
  menuRef: React.RefObject<HTMLElement | null>;
  direction?: "horizontal" | "vertical"; // Default: horizontal
};

export const useMenuNavigation = ({
  menuRef,
  direction = "horizontal",
}: UseMenuNavigationProps) => {
  const activeElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!menuRef.current) return;

    const focusableElements = Array.from(
      menuRef.current.querySelectorAll(
        'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])',
      ),
    ) as HTMLElement[];

    if (focusableElements.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeElementRef.current) return;

      const currentIndex = focusableElements.indexOf(activeElementRef.current);
      let nextIndex = currentIndex;

      const isHorizontal = direction === "horizontal";
      const forwardKey = isHorizontal ? "ArrowRight" : "ArrowDown";
      const backwardKey = isHorizontal ? "ArrowLeft" : "ArrowUp";

      if (e.key === forwardKey) {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % focusableElements.length;
      } else if (e.key === backwardKey) {
        e.preventDefault();
        nextIndex =
          (currentIndex - 1 + focusableElements.length) %
          focusableElements.length;
      } else {
        return;
      }

      const nextElement = focusableElements[nextIndex];
      activeElementRef.current = nextElement;
      nextElement.focus();
    };

    const addKeyListener = () =>
      document.addEventListener("keydown", handleKeyDown);
    const removeKeyListener = () =>
      document.removeEventListener("keydown", handleKeyDown);

    const handleFocusIn = () => {
      activeElementRef.current = document.activeElement as HTMLElement;
      addKeyListener();
    };

    const handleFocusOut = () => {
      activeElementRef.current = null;
      removeKeyListener();
    };

    menuRef.current.addEventListener("focusin", handleFocusIn);
    menuRef.current.addEventListener("focusout", handleFocusOut);

    return () => {
      menuRef.current?.removeEventListener("focusin", handleFocusIn);
      menuRef.current?.removeEventListener("focusout", handleFocusOut);
      removeKeyListener();
    };
  }, [menuRef, direction]);
};

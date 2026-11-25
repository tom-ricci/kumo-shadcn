import { useEffect, useMemo, type ReactNode } from "react";

// Kumo, packages/kumo/src/components/flow/parallel.tsx from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.1), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
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

import { useNode, useNodeGroup, useFlowStateContext } from "./diagram";
import { DescendantsProvider } from "./use-children";

type FlowParallelNodeProps = {
  children: ReactNode;
  /** When "end", each branch is right-aligned to the widest branch. */
  align?: "end";
};

export function FlowParallelNode({ children, align }: FlowParallelNodeProps) {
  const descendants = useNodeGroup();
  const { reportDescendants } = useFlowStateContext();

  // Only structural info (kind, id, children) is keyed — not DOM rects —
  // to avoid re-computing on every measurement update.
  const structuralKey = JSON.stringify(
    descendants.descendants.map((d) => ({
      id: d.id,
      kind: d.props.kind,
      children: d.props.kind !== "node" ? d.props.children : undefined,
    })),
  );

  const nodeProps = useMemo(
    () => ({
      kind: "parallel" as const,
      children: descendants.descendants.map((d) => d.id),
      align,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structuralKey, align],
  );

  const { index, id } = useNode(nodeProps);

  // Report our immediate descendants upward so FlowDiagram can reconstruct
  // the full tree for this parallel branch.
  useEffect(() => {
    reportDescendants(id, descendants.descendants);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralKey, reportDescendants, id]);

  return (
    <li data-node-index={index}>
      <DescendantsProvider value={descendants}>{children}</DescendantsProvider>
    </li>
  );
}

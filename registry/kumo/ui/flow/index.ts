import { FlowDiagram, FlowNodeList } from "./diagram";

// Kumo, packages/kumo/src/components/flow/index.ts from https://github.com/cloudflare/kumo
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

import { FlowNode, FlowAnchor } from "./node";
import { FlowParallelNode } from "./parallel";

/**
 * Flow - Components for visualizing workflows and data flows.
 *
 * @example
 * ```tsx
 * <Flow>
 *   <Flow.Node>Step 1</Flow.Node>
 *   <Flow.Node>Step 2</Flow.Node>
 *   <Flow.Parallel>
 *     <Flow.Node>Branch A</Flow.Node>
 *     <Flow.Node>Branch B</Flow.Node>
 *   </Flow.Parallel>
 *   <Flow.Node>Step 3</Flow.Node>
 * </Flow>
 * ```
 */
const Flow = Object.assign(FlowDiagram, {
  Node: FlowNode,
  Parallel: FlowParallelNode,
  List: FlowNodeList,
  Anchor: FlowAnchor,
});

export { Flow };

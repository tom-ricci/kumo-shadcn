import { memo } from "react";

// Kumo, packages/kumo/src/components/chart/timeseries-tooltip.tsx from https://github.com/cloudflare/kumo
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

import { Text } from "@/components/ui/text/text";
import type { TimeseriesMarker } from "./timeseries-markers";

export interface TooltipRow {
  name: string;
  value: number;
  color: string;
}

export interface SeriesTooltipState {
  type: "series";
  ts: number;
  rows: TooltipRow[];
  hiddenCount: number;
}

export interface MarkerTooltipState {
  type: "marker";
  ts: number;
  color: string;
  markers: TimeseriesMarker[];
  rows: TooltipRow[];
  hiddenCount: number;
}

export type TooltipState = SeriesTooltipState | MarkerTooltipState;

export interface TooltipContentProps {
  state: TooltipState;
  formatValue?: (v: number) => string;
  formatTimestamp: (timestamp: number) => string;
  footer?: string;
}

export const TooltipContent = memo(function TooltipContent({
  state,
  formatValue,
  formatTimestamp,
  footer,
}: TooltipContentProps) {
  return (
    <>
      {state.type === "marker" ? (
        <MarkerTooltipContent
          state={state}
          formatValue={formatValue}
          formatTimestamp={formatTimestamp}
        />
      ) : (
        <>
          <div className="mb-1 text-xs font-semibold text-kumo-default">
            {formatTimestamp(state.ts)}
          </div>
          <SeriesTooltipRows
            rows={state.rows}
            hiddenCount={state.hiddenCount}
            formatValue={formatValue}
          />
        </>
      )}
      {footer && (
        <div className="mt-1">
          <Text variant="secondary" size="xs">
            {footer}
          </Text>
        </div>
      )}
    </>
  );
});

function MarkerTooltipContent({
  state,
  formatValue,
  formatTimestamp,
}: {
  state: MarkerTooltipState;
  formatValue?: (v: number) => string;
  formatTimestamp: (timestamp: number) => string;
}) {
  return (
    <>
      {state.markers.length === 1 && (
        <div className="mb-1 text-xs font-semibold text-kumo-default">
          {formatTimestamp(state.markers[0].timestamp)}
        </div>
      )}
      <div className="space-y-1">
        {state.markers.map((marker, index) => (
          <div key={`${marker.timestamp}-${marker.label}-${index}`}>
            <div className="flex items-center gap-2 text-xs text-kumo-default">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: marker.color ?? state.color }}
              />
              <span className="font-medium">
                {marker.label ?? "Reference marker"}
              </span>
              {state.markers.length > 1 && (
                <span className="text-kumo-subtle">
                  {formatTimestamp(marker.timestamp)}
                </span>
              )}
            </div>
            {marker.description && (
              <div className="mt-0.5 ml-5 text-xs text-kumo-default">
                {marker.description}
              </div>
            )}
          </div>
        ))}
      </div>
      {state.rows.length > 0 && (
        <div className="mt-2 border-t border-kumo-line pt-2">
          <SeriesTooltipRows
            rows={state.rows}
            hiddenCount={state.hiddenCount}
            formatValue={formatValue}
          />
        </div>
      )}
    </>
  );
}

function SeriesTooltipRows({
  rows,
  hiddenCount,
  formatValue,
}: {
  rows: TooltipRow[];
  hiddenCount: number;
  formatValue?: (v: number) => string;
}) {
  return (
    <>
      {rows.map((row) => (
        <div
          key={row.name}
          className="flex items-center justify-between gap-4 py-0.5"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span
              className="truncate text-xs font-medium text-kumo-default"
              title={row.name}
            >
              {row.name}
            </span>
          </div>
          <span className="shrink-0 text-xs font-semibold text-kumo-default">
            {formatValue
              ? formatValue(row.value)
              : formatDefaultValue(row.value)}
          </span>
        </div>
      ))}
      {hiddenCount > 0 && (
        <div className="mt-1 text-xs text-kumo-subtle">+{hiddenCount} more</div>
      )}
    </>
  );
}

const defaultNumberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 3,
});

function formatDefaultValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return defaultNumberFormat.format(value);
}

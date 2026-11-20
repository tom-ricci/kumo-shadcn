"use client";

// Kumo, packages/kumo/src/components/chart/timeseries-markers.ts from https://github.com/cloudflare/kumo
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

export interface TimeseriesMarker {
  /** Unix timestamp in milliseconds. */
  timestamp: number;
  /** Short label shown on/near the marker. */
  label?: string;
  /** Optional longer tooltip/body text. */
  description?: string;
  /** Optional marker color. Defaults to a neutral/subtle chart color. */
  color?: string;
  /** Optional line style. Defaults to dashed. */
  lineStyle?: "solid" | "dashed" | "dotted";
}

export interface TimeseriesMarkerCluster {
  timestamp: number;
  label?: string;
  color?: string;
  lineStyle?: TimeseriesMarker["lineStyle"];
  markers: TimeseriesMarker[];
}

export interface TimeseriesMarkerAnnotationStyle {
  color: string;
  labelBackgroundColor: string;
}

export function buildTimeseriesMarkerAnnotations(
  clusters: TimeseriesMarkerCluster[],
  style: TimeseriesMarkerAnnotationStyle,
) {
  if (clusters.length === 0) return undefined;

  const labelStyle = {
    backgroundColor: style.labelBackgroundColor,
    padding: [2, 4],
    borderRadius: 6,
    shadowBlur: 8,
    shadowColor: style.labelBackgroundColor,
  };

  return {
    markLine: {
      symbol: "none" as const,
      silent: false,
      animation: false,
      z: 10,
      lineStyle: {
        type: "dashed" as const,
        color: style.color,
        width: 1,
      },
      emphasis: {
        lineStyle: { width: 2 },
      },
      blur: {
        lineStyle: { opacity: 1 },
        label: { opacity: 1 },
      },
      label: {
        show: true,
        formatter: (params: { name?: string }) => params.name ?? "",
        position: "insideEndTop" as const,
        color: style.color,
        ...labelStyle,
      },
      data: clusters.map((cluster) => ({
        name: cluster.label,
        xAxis: cluster.timestamp,
        lineStyle: {
          type: cluster.lineStyle ?? "dashed",
          color: cluster.color ?? style.color,
          width: 1,
        },
        emphasis: {
          lineStyle: { width: 2 },
        },
        blur: {
          lineStyle: { opacity: 1 },
          label: { opacity: 1 },
        },
        label: {
          show: Boolean(cluster.label),
          color: cluster.color ?? style.color,
          ...labelStyle,
        },
        tooltip: { marker: cluster },
      })),
    },
  };
}

export function clusterTimeseriesMarkers(
  markers: TimeseriesMarker[] | undefined,
  interval: number,
): TimeseriesMarkerCluster[] {
  if (!markers?.length) return [];

  const sorted = [...markers].sort((a, b) => a.timestamp - b.timestamp);
  const clusters: TimeseriesMarker[][] = [];

  for (const marker of sorted) {
    const previous = clusters.at(-1);
    if (
      previous &&
      marker.timestamp - previous[previous.length - 1].timestamp <= interval
    ) {
      previous.push(marker);
    } else {
      clusters.push([marker]);
    }
  }

  return clusters.map((cluster) => {
    const first = cluster[0];
    return {
      timestamp: first.timestamp,
      label: cluster.length === 1 ? first.label : `${cluster.length} changes`,
      color: first.color,
      lineStyle: first.lineStyle,
      markers: cluster,
    };
  });
}

export function getApproximateMarkerClusterInterval(
  timestamps: Iterable<number>,
  tickCount: number,
): number {
  // A loop rather than Math.max(...timestamps): spreading large datasets into
  // a call exceeds the engine's argument limit.
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (const timestamp of timestamps) {
    if (timestamp < min) min = timestamp;
    if (timestamp > max) max = timestamp;
    count++;
  }
  if (count < 2) return 0;
  return (max - min) / tickCount;
}

export function getTimeseriesMarkerFromEvent(params: {
  componentType?: string;
  data?: { tooltip?: { marker?: TimeseriesMarkerCluster } };
}): TimeseriesMarkerCluster | undefined {
  if (params.componentType !== "markLine") {
    return undefined;
  }
  return params.data?.tooltip?.marker;
}

"use client";

import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Loader2 } from "lucide-react";
import worldAtlas from "world-atlas/countries-110m.json";
import { numericToAlpha3 } from "@/lib/reading-map/country-lookup";

const COLOR_SCALE_STOPS = [
  { threshold: 0, fill: "var(--paper-deep)" },
  { threshold: 1, fill: "#d6e8f7" },
  { threshold: 3, fill: "#8bb9e6" },
  { threshold: 10, fill: "#4a8ec9" },
  { threshold: 30, fill: "#1a5f9e" },
];

function getColor(count) {
  if (!count || count === 0) return COLOR_SCALE_STOPS[0].fill;
  for (let i = COLOR_SCALE_STOPS.length - 1; i >= 1; i--) {
    if (count >= COLOR_SCALE_STOPS[i].threshold) return COLOR_SCALE_STOPS[i].fill;
  }
  return COLOR_SCALE_STOPS[1].fill;
}

function maxCount(countryCounts) {
  const values = Object.values(countryCounts);
  if (!values.length) return 0;
  return Math.max(...values.map((v) => v.count || 0));
}

export function MapPanel({ countryCounts, selectedCountry, onCountryClick, pending }) {
  const [tooltipContent, setTooltipContent] = useState(null);
  const max = useMemo(() => maxCount(countryCounts), [countryCounts]);

  if (pending) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[var(--ink-soft)]">
          <Loader2 className="size-8 animate-spin" strokeWidth={1.5} />
          <span className="font-ui text-sm">加载阅读地图...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 130, center: [0, 30] }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={1} minZoom={1} maxZoom={6} center={[0, 30]}>
          <Geographies geography={worldAtlas}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const code = numericToAlpha3(geo.id, geo.properties?.name);
                const countData = code ? countryCounts[code] : undefined;
                const count = countData?.count || 0;
                const isSelected = code != null && selectedCountry === code;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getColor(count)}
                    stroke={isSelected ? "var(--gold)" : "var(--line)"}
                    strokeWidth={isSelected ? 1.5 : 0.5}
                    style={{
                      default: {
                        outline: "none",
                        transition: "fill 0.2s ease",
                      },
                      hover: {
                        fill: isSelected ? getColor(count) : "#b8d4f0",
                        outline: "none",
                        cursor: "pointer",
                      },
                      pressed: {
                        outline: "none",
                      },
                    }}
                    onClick={() => code && onCountryClick(code)}
                    onMouseEnter={() => {
                      const name = countData?.country_name || geo.properties?.name || code;
                      setTooltipContent({ name, count, x: 0, y: 0 });
                    }}
                    onMouseLeave={() => setTooltipContent(null)}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-md border border-border bg-[var(--paper)]/90 px-3 py-2 backdrop-blur-sm">
        <span className="font-ui text-xs text-[var(--ink-soft)]">少</span>
        {COLOR_SCALE_STOPS.slice(0, 5).map((stop, i) => (
          <span
            key={i}
            className="block size-3 rounded-sm"
            style={{ backgroundColor: stop.fill }}
          />
        ))}
        <span className="font-ui text-xs text-[var(--ink-soft)]">
          多{max > 0 ? ` (${max})` : ""}
        </span>
      </div>

      {/* Tooltip */}
      {tooltipContent && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-md border border-border bg-[var(--paper)] px-3 py-1.5 shadow-md">
          <span className="font-ui text-sm font-medium text-[var(--ink)]">
            {tooltipContent.name}
          </span>
          <span className="ml-2 font-ui text-xs text-[var(--ink-soft)]">
            {tooltipContent.count} 本书
          </span>
        </div>
      )}
    </div>
  );
}

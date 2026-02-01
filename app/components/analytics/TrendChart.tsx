import { Box, BlockStack, Text, InlineStack } from "@shopify/polaris";

interface TrendChartProps {
  data: {
    date: string;
    value: number;
  }[];
  title?: string;
  color?: "primary" | "success" | "warning" | "critical";
  height?: number;
}

/**
 * Simple bar chart for displaying trends
 * Uses pure CSS for rendering without external chart libraries
 */
export function TrendChart({
  data,
  title,
  color = "primary",
  height = 120,
}: TrendChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const colorMap = {
    primary: "var(--p-color-bg-fill-brand)",
    success: "var(--p-color-bg-fill-success)",
    warning: "var(--p-color-bg-fill-warning)",
    critical: "var(--p-color-bg-fill-critical)",
  };

  const barColor = colorMap[color] || colorMap.primary;

  return (
    <BlockStack gap="200">
      {title && (
        <Text as="h3" variant="headingSm">
          {title}
        </Text>
      )}
      <Box
        background="bg-surface-secondary"
        borderRadius="200"
        padding="300"
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            height: `${height}px`,
            gap: "4px",
          }}
        >
          {data.map((item, index) => {
            const barHeight = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            return (
              <div
                key={index}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "40px",
                    height: `${Math.max(barHeight, 2)}%`,
                    backgroundColor: barColor,
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.3s ease",
                  }}
                  title={`${item.date}: ${item.value}`}
                />
              </div>
            );
          })}
        </div>
        <InlineStack align="space-between">
          {data.map((item, index) => (
            <Text key={index} as="span" variant="bodySm" tone="subdued">
              {formatDateLabel(item.date)}
            </Text>
          ))}
        </InlineStack>
      </Box>
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm" tone="subdued">
          Total: {data.reduce((sum, d) => sum + d.value, 0)}
        </Text>
        <Text as="span" variant="bodySm" tone="subdued">
          Avg: {Math.round(data.reduce((sum, d) => sum + d.value, 0) / data.length)}
        </Text>
      </InlineStack>
    </BlockStack>
  );
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
}

/**
 * Mini sparkline for inline display
 */
export function Sparkline({
  data,
  width = 100,
  height = 24,
  color = "primary",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: "primary" | "success" | "warning" | "critical";
}) {
  if (data.length === 0) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const colorMap = {
    primary: "var(--p-color-border-brand)",
    success: "var(--p-color-border-success)",
    warning: "var(--p-color-border-warning)",
    critical: "var(--p-color-border-critical)",
  };

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={colorMap[color]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Stat card with trend indicator
 */
export function StatWithTrend({
  label,
  value,
  previousValue,
  format = "number",
}: {
  label: string;
  value: number;
  previousValue?: number;
  format?: "number" | "percent";
}) {
  const formattedValue =
    format === "percent" ? `${value}%` : value.toLocaleString();

  let trendIcon = null;
  let trendColor: "success" | "critical" | "subdued" = "subdued";

  if (previousValue !== undefined) {
    const diff = value - previousValue;
    if (diff > 0) {
      trendIcon = "↑";
      trendColor = "success";
    } else if (diff < 0) {
      trendIcon = "↓";
      trendColor = "critical";
    }
  }

  return (
    <BlockStack gap="100">
      <InlineStack gap="100" blockAlign="center">
        <Text as="p" variant="headingLg">
          {formattedValue}
        </Text>
        {trendIcon && (
          <Text as="span" variant="bodySm" tone={trendColor}>
            {trendIcon} {Math.abs((previousValue || 0) - value)}
          </Text>
        )}
      </InlineStack>
      <Text as="p" variant="bodySm" tone="subdued">
        {label}
      </Text>
    </BlockStack>
  );
}

/**
 * Donut/Pie chart for breakdown display
 */
export function DonutChart({
  segments,
  size = 100,
  thickness = 20,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <Box>
      <svg width={size} height={size} style={{ display: "block" }}>
        {segments.map((segment, index) => {
          const percentage = segment.value / total;
          const strokeLength = circumference * percentage;
          const offset = currentOffset;
          currentOffset += strokeLength;

          return (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </svg>
      <BlockStack gap="100">
        {segments.map((segment, index) => (
          <InlineStack key={index} gap="100" blockAlign="center">
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: segment.color,
              }}
            />
            <Text as="span" variant="bodySm">
              {segment.label}: {Math.round((segment.value / total) * 100)}%
            </Text>
          </InlineStack>
        ))}
      </BlockStack>
    </Box>
  );
}

import { Badge, Tooltip } from "@shopify/polaris";
import type { SeoStatus } from "../../types/seo";

interface SeoScoreIndicatorProps {
  score: number;
  status: SeoStatus;
  showScore?: boolean;
}

const STATUS_CONFIG = {
  critical: {
    tone: "critical" as const,
    label: "Critical",
    description: "Major SEO issues found",
  },
  warning: {
    tone: "warning" as const,
    label: "Warning",
    description: "Some SEO improvements needed",
  },
  success: {
    tone: "success" as const,
    label: "Good",
    description: "SEO is well optimized",
  },
};

export function SeoScoreIndicator({
  score,
  status,
  showScore = true,
}: SeoScoreIndicatorProps) {
  const config = STATUS_CONFIG[status];

  const content = showScore ? `${score}%` : config.label;

  return (
    <Tooltip content={`${config.description} (${score}%)`}>
      <Badge tone={config.tone}>{content}</Badge>
    </Tooltip>
  );
}

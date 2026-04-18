import type { CSSProperties } from "react";

import { getStatusBadgeStyle, getStatusLabel } from "@/lib/tasks/statusConfig";

type TaskStatusBadgeProps = {
  status: string | null | undefined;
  style?: CSSProperties;
  className?: string;
};

/**
 * Compacte status-pill voor taakkaarten (gebruikt `task.status`).
 */
export function TaskStatusBadge({ status, style, className }: TaskStatusBadgeProps) {
  return (
    <span
      className={className}
      style={{
        ...getStatusBadgeStyle(status),
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
        display: "inline-block",
        lineHeight: 1.25,
        ...style,
      }}
    >
      {getStatusLabel(status)}
    </span>
  );
}

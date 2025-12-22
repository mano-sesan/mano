import { ReactNode } from "react";

/** Contextual alert with Bootstrap-like color variants. */

type AlertColor = "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "light" | "dark";

interface AlertProps {
  color?: AlertColor;
  children: ReactNode;
  className?: string;
}

const colorClasses = {
  primary:
    "tw-bg-[#cce5ff] tw-text-[#004085] tw-border tw-border-[#b8daff] tw-border-l-4 tw-border-l-[#004085]",
  secondary:
    "tw-bg-[#e2e3e5] tw-text-[#383d41] tw-border tw-border-[#d6d8db] tw-border-l-4 tw-border-l-[#383d41]",
  success:
    "tw-bg-[#d4edda] tw-text-[#155724] tw-border tw-border-[#c3e6cb] tw-border-l-4 tw-border-l-[#155724]",
  danger:
    "tw-bg-[#f8d7da] tw-text-[#721c24] tw-border tw-border-[#f5c6cb] tw-border-l-4 tw-border-l-[#721c24]",
  warning:
    "tw-bg-[#fff3cd] tw-text-[#856404] tw-border tw-border-[#ffeeba] tw-border-l-4 tw-border-l-[#856404]",
  info:
    "tw-bg-[#d1ecf1] tw-text-[#0c5460] tw-border tw-border-[#bee5eb] tw-border-l-4 tw-border-l-[#0c5460]",
  light:
    "tw-bg-[#fefefe] tw-text-[#818182] tw-border tw-border-[#fdfdfe] tw-border-l-4 tw-border-l-[#818182]",
  dark:
    "tw-bg-[#d6d8d9] tw-text-[#1b1e21] tw-border tw-border-[#c6c8ca] tw-border-l-4 tw-border-l-[#1b1e21]",
};

const DEFAULT_COLOR: AlertColor = "info";

export default function Alert({ color, children, className = "" }: AlertProps) {
  const safeColor = color && colorClasses[color] ? color : DEFAULT_COLOR;

  return (
    <div
      className={[
        "tw-rounded tw-p-4 tw-text-base tw-mb-4 tw-shadow-sm",
        colorClasses[safeColor],
        className,
      ].join(" ")}
      role="alert"
    >
      {children}
    </div>
  );
}

import { ReactNode } from "react";

interface AlertProps {
  color: "danger" | "warning" | "info" | "success";
  children: ReactNode;
  className?: string;
}

const colorClasses = {
  danger: "tw-bg-red-50 tw-border-red-200 tw-text-red-800",
  warning: "tw-bg-yellow-50 tw-border-yellow-200 tw-text-yellow-800",
  info: "tw-bg-blue-50 tw-border-blue-200 tw-text-blue-800",
  success: "tw-bg-green-50 tw-border-green-200 tw-text-green-800",
};

export default function Alert({ color, children, className = "" }: AlertProps) {
  return (
    <div
      className={[
        "tw-rounded tw-border tw-p-4 tw-text-sm tw-mb-4",
        colorClasses[color],
        className,
      ].join(" ")}
      role="alert"
    >
      {children}
    </div>
  );
}

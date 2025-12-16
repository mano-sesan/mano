interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "white" | "main" | "current";
  className?: string;
}

const sizeClasses = {
  sm: "tw-h-4 tw-w-4 tw-border-2",
  md: "tw-h-6 tw-w-6 tw-border-2",
  lg: "tw-h-8 tw-w-8 tw-border-[3px]",
};

const colorClasses = {
  white: "tw-border-white tw-border-t-transparent",
  main: "tw-border-main tw-border-t-transparent",
  current: "tw-border-current tw-border-t-transparent",
};

export default function Spinner({ size = "sm", color = "current", className = "" }: SpinnerProps) {
  return (
    <div
      className={[
        "tw-inline-block tw-animate-spin tw-rounded-full",
        sizeClasses[size],
        colorClasses[color],
        className,
      ].join(" ")}
      role="status"
      aria-label="Chargement"
    />
  );
}

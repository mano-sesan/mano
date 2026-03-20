import { MouseEventHandler } from "react";
import Spinner from "./tailwind/Spinner";

const COLOR_CLASSES = {
  primary: "tw-bg-main tw-text-white hover:tw-bg-mainDark",
  secondary: "tw-bg-black tw-text-white hover:tw-bg-black75",
  link: "tw-bg-transparent tw-text-main tw-font-semibold hover:tw-underline",
  cancel: "tw-bg-transparent tw-text-main hover:tw-underline",
  danger: "tw-bg-redLight tw-text-redDark hover:tw-opacity-80",
  warning: "tw-bg-orangeLight tw-text-orangeDark hover:tw-opacity-80",
} as const;

const ButtonCustom = ({
  color = "primary",
  onClick,
  className = "",
  loading,
  title = "ButtonCustom",
  type,
  disabled,
  icon,
  padding,
  style,
  ...rest
}: {
  type: "button" | "submit" | "reset";
  color?: keyof typeof COLOR_CLASSES;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  loading?: boolean;
  title?: string;
  disabled?: boolean;
  icon?: string;
  padding?: string;
  style?: React.CSSProperties;
  id?: string;
}) => {
  const isDisabled = loading || disabled;

  return (
    <button
      className={[
        "noprint tw-relative tw-grid tw-max-w-[450px] tw-items-center tw-justify-center tw-rounded-lg tw-border-none tw-text-sm tw-shadow-none",
        "disabled:tw-cursor-not-allowed disabled:tw-opacity-50",
        COLOR_CLASSES[color] || COLOR_CLASSES.primary,
        className,
      ].join(" ")}
      onClick={onClick}
      disabled={isDisabled}
      type={type}
      aria-busy={loading || undefined}
      style={style}
      {...rest}
    >
      {loading && (
        <span className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center">
          <Spinner color="white" size="sm" />
        </span>
      )}
      <span
        className={[
          "tw-flex tw-items-center",
          padding === "0px" ? "tw-p-0" : padding === "12px 24px" ? "tw-px-6 tw-py-3" : "tw-px-4 tw-py-2",
          loading ? "tw-invisible" : "",
        ].join(" ")}
      >
        {!!icon && (
          <span
            className="tw-mr-2 tw-inline-block tw-h-5 tw-w-5 tw-bg-contain tw-bg-center tw-bg-no-repeat"
            style={{ backgroundImage: `url("${icon}")` }}
            aria-hidden="true"
          />
        )}
        {title}
      </span>
    </button>
  );
};

export default ButtonCustom;

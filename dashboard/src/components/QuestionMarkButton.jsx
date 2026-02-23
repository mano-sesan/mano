import React from "react";

export default function QuestionMarkButton({ className = "", questionMarkColor = "main", ...props }) {
  return (
    <button
      type="button"
      className={[
        className,
        "tw-ml-1 tw-inline-flex tw-h-5 tw-w-5 tw-items-center tw-justify-center tw-rounded-full tw-border tw-text-xs tw-font-bold tw-shadow-none tw-transition-colors hover:tw-scale-105",
        questionMarkColor === "violet"
          ? "hover:tw-border-[#707597] tw-bg-[#707597] hover:tw-text-[#707597] tw-text-white hover:tw-bg-white tw-border-white"
          : "tw-border-main hover:tw-bg-main tw-text-main hover:tw-text-white tw-bg-white hover:tw-border-white",
      ].join(" ")}
      {...props}
    >
      ?
    </button>
  );
}

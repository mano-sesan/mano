import React from "react";
import HelpButtonAndModal from "./HelpButtonAndModal";
import { useStatsContext } from "../scenes/stats/StatsContext";

const Card = ({ title, count, unit, children, countId, dataTestId, help, onClick = null }) => {
  dataTestId = dataTestId || title.toLocaleLowerCase().split(" ").join("-");
  const { v2 } = useStatsContext();

  const Component = onClick ? "button" : "div";
  const props = onClick ? { onClick, type: "button", name: "card", className: "button-cancel" } : {};
  return (
    <>
      <div className="tw-relative tw-flex tw-h-full tw-w-full tw-flex-col tw-items-start tw-justify-start tw-rounded-2xl tw-border tw-border-main25 tw-bg-white tw-font-bold print:tw-break-inside-avoid">
        {!!title && (
          <div
            className={[
              "tw-w-full tw-flex tw-items-center tw-col-span-7 print:tw-col-span-1 tw-text-white print:tw-text-black tw-bg-[#707597] print:tw-bg-white tw-rounded-t-2xl",
              v2 ? "tw-px-3 tw-py-1.5 tw-text-base tw-font-normal" : "tw-px-4 tw-py-2 tw-text-lg tw-font-medium",
            ].join(" ")}
          >
            {v2 ? (
              <>
                <div className="tw-flex-1">{title}</div>
                <div className="tw-flex-none -tw-mt-1">{!!help && <HelpButtonAndModal questionMarkColor="violet" title={title} help={help} />}</div>
              </>
            ) : (
              <>
                {title} {!!help && <HelpButtonAndModal questionMarkColor="violet" title={title} help={help} />}
              </>
            )}
          </div>
        )}
        <div className="tw-p-4 tw-w-full tw-flex tw-flex-col tw-items-center tw-justify-end tw-grow">
          <Component {...props} className={["tw-grow tw-flex tw-items-end tw-text-6xl tw-text-main tw-my-2"].join(" ")}>
            <div className="tw-flex tw-items-end">
              <span data-test-id={`${dataTestId}-${count}`} id={countId}>
                {count}
              </span>
              {!!unit && <span className="tw-ml-2.5 tw-mb-1 tw-text-base">{unit}</span>}
            </div>
          </Component>
          {children}
        </div>
      </div>
    </>
  );
};

export default Card;

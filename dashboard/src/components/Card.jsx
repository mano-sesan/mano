import React from "react";
import HelpButtonAndModal from "./HelpButtonAndModal";

const Card = ({ title, count, unit, children, countId, dataTestId, help, onClick = null }) => {
  dataTestId = dataTestId || title.toLocaleLowerCase().split(" ").join("-");

  const Component = onClick ? "button" : "div";
  const props = onClick ? { onClick, type: "button", name: "card", className: "button-cancel" } : {};
  return (
    <>
      <div className="tw-relative tw-flex tw-h-full tw-w-full tw-flex-col tw-items-start tw-justify-start tw-rounded-2xl tw-border tw-border-main25 tw-bg-white tw-font-bold print:tw-break-inside-avoid">
        {!!title && (
          <div className="tw-w-full tw-flex tw-bg-[#707597] px-4 py-2 tw-text-lg tw-font-medium tw-items-center tw-col-span-7 print:tw-col-span-1 tw-text-white print:tw-text-black print:tw-bg-white tw-rounded-t-2xl">
            {title} {!!help && <HelpButtonAndModal questionMarkColor="violet" title={title} help={help} />}
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

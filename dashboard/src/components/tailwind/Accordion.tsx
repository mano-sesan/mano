import { Disclosure } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import React from "react";

interface AccordionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  onToggle?: (open: boolean) => void;
  rightElement?: React.ReactNode;
}

export function Accordion({ title, children, defaultOpen = false, className = "", onToggle, rightElement }: AccordionProps) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <div className={["tw-border tw-border-gray-200 tw-rounded-lg tw-overflow-hidden", className].join(" ")}>
          <Disclosure.Button
            className="tw-flex tw-w-full tw-justify-between tw-items-center tw-px-4 tw-py-3 tw-text-left tw-text-sm tw-font-medium tw-text-gray-900 hover:tw-bg-gray-50 focus:tw-outline-none"
            onClick={() => onToggle?.(!open)}
          >
            <span className="tw-flex tw-items-center tw-gap-2">{title}</span>
            <span className="tw-flex tw-items-center tw-gap-2">
              {rightElement}
              <ChevronDownIcon className={["tw-h-5 tw-w-5 tw-text-gray-500 tw-transition-transform", open ? "tw-rotate-180" : ""].join(" ")} />
            </span>
          </Disclosure.Button>
          <Disclosure.Panel className="tw-px-4 tw-pb-4 tw-pt-2 tw-text-sm tw-text-gray-700 tw-bg-gray-50">{children}</Disclosure.Panel>
        </div>
      )}
    </Disclosure>
  );
}

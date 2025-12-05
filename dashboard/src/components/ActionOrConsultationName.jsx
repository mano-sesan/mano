import React from "react";
import { useStore } from "../store";
import { disableConsultationRow } from "../recoil/consultations";
import { getName } from "../recoil/actions";
import UserName from "./UserName";
import RepeatIcon from "../assets/icons/RepeatIcon";

export default function ActionOrConsultationName({ item, hideType = false }) {
  const me = useStore((state) => state.user);
  if (!!item.isConsultation && disableConsultationRow(item, me)) {
    if (!me.healthcareProfessional) return <div />; // a non healthcare professional cannot see the name of a consultation anyway
    return (
      <div className="tw-italic tw-opacity-30">
        Seulement visible par
        {hideType ? " " : <br />}
        <UserName id={item.user} />
      </div>
    );
  }
  return (
    <>
      {item.recurrence ? (
        <div className="tw-flex tw-items-center">
          <RepeatIcon className="tw-size-5 tw-mr-1.5 tw-text-main" />
          {getName(item)}
        </div>
      ) : (
        <div>{getName(item)}</div>
      )}
      <div>
        {item.categories?.map((category) => (
          <span
            className="tw-whitespace-no-wrap tw-mx-0.5 tw-my-px tw-inline-block tw-rounded tw-bg-main75 tw-px-1 tw-py-0.5 tw-text-center tw-align-baseline tw-text-[10.5px] tw-font-bold tw-leading-none tw-text-white"
            color="info"
            key={category}
            data-test-id={item.name + category}
          >
            {category}
          </span>
        ))}
        {!!item.isConsultation && !hideType && <small className="text-muted">{item.type}</small>}
      </div>
    </>
  );
}

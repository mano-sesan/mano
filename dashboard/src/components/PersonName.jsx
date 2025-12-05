import React from "react";
import { useHistory } from "react-router-dom";
import { useAtomValue } from "jotai";
import { personsObjectSelector } from "../recoil/selectors";
import { getPersonInfo } from "../utils/get-person-infos";

export default function PersonName({ item, onClick = null, redirectToTab = "Résumé" }) {
  const history = useHistory();
  const persons = useAtomValue(personsObjectSelector);
  const person = item?.personPopulated ?? persons[item.person];

  return (
    <span
      className="hover:tw-cursor-zoom-in hover:tw-bg-yellow-400 my-tooltip"
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) return onClick();
        if (item.person) history.push(`/person/${item.person}?tab=${redirectToTab}`);
      }}
      data-tooltip={getPersonInfo(person)}
    >
      {person?.name}
      {person?.otherNames ? <em className="tw-inline tw-text-main"> - {person?.otherNames}</em> : null}
    </span>
  );
}

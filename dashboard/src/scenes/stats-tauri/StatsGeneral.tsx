import {
  sqlSelectActionsCount,
  sqlSelectPersonnesCreesCount,
  sqlSelectPersonnesSuiviesAuMoinsUneActionCount,
  sqlSelectPersonnesSuiviesCount,
  sqlSelectRencontresCount,
  sqlSelectPassagesCount,
} from "./queries";
import { useEffect } from "react";
import { useState } from "react";
import { StatsContext } from "./queries";
import { Block } from "../stats/Blocks";
import { organisationState } from "../../recoil/auth";
import { useRecoilValue } from "recoil";

export function StatsGeneral({ context }: { context: StatsContext }) {
  const organisation = useRecoilValue(organisationState);
  return (
    <div className="tw-grid tw-grid-cols-2 xl:tw-grid-cols-3 2xl:tw-grid-cols-4 tw-gap-4 tw-my-8">
      <PersonnesCrees context={context} />
      <PersonnesSuivies context={context} />
      <PersonnesSuiviesAuMoinsUneAction context={context} />
      <Actions context={context} />
      {organisation.rencontresEnabled ? <Rencontres context={context} /> : null}
      {organisation.passagesEnabled ? <Passages context={context} /> : null}
    </div>
  );
}

function PersonnesCrees({ context }: { context: StatsContext }) {
  const [personCrees, setPersonCrees] = useState<string>("-");
  useEffect(() => {
    sqlSelectPersonnesCreesCount(context).then((res) => setPersonCrees(res[0].total));
  }, [context]);
  return <Block title="Personnes créées" data={personCrees} />;
}

function PersonnesSuivies({ context }: { context: StatsContext }) {
  const [personSuivies, setPersonSuivies] = useState<string>("-");
  useEffect(() => {
    sqlSelectPersonnesSuiviesCount(context).then((res) => setPersonSuivies(res[0].total));
  }, [context]);
  return <Block title="Personnes suivies" data={personSuivies} />;
}

function PersonnesSuiviesAuMoinsUneAction({ context }: { context: StatsContext }) {
  const [personAuMoinsUneAction, setPersonAuMoinsUneAction] = useState<string>("-");
  useEffect(() => {
    sqlSelectPersonnesSuiviesAuMoinsUneActionCount(context).then((res) => setPersonAuMoinsUneAction(res[0].total));
  }, [context]);
  return <Block title="Personnes suivies au moins une action" data={personAuMoinsUneAction} />;
}

function Actions({ context }: { context: StatsContext }) {
  const [actions, setActions] = useState<string>("-");
  useEffect(() => {
    sqlSelectActionsCount(context).then((res) => setActions(res[0].total));
  }, [context]);
  return <Block title="Actions" data={actions} />;
}

function Rencontres({ context }: { context: StatsContext }) {
  const [rencontres, setRencontres] = useState<string>("-");
  useEffect(() => {
    sqlSelectRencontresCount(context).then((res) => setRencontres(res[0].total));
  }, [context]);
  return <Block title="Rencontres" data={rencontres} />;
}

function Passages({ context }: { context: StatsContext }) {
  const [passages, setPassages] = useState<string>("-");
  useEffect(() => {
    sqlSelectPassagesCount(context).then((res) => setPassages(res[0].total));
  }, [context]);
  return <Block title="Passages" data={passages} />;
}

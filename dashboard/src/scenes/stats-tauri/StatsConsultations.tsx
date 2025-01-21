import { sqlSelectConsultationsCount, sqlSelectPersonnesSuiviesAuMoinsUneConsultationCount } from "./queries";
import { useEffect } from "react";
import { useState } from "react";
import { StatsContext } from "./queries";
import { Block } from "../stats/Blocks";
import { organisationState } from "../../recoil/auth";
import { useRecoilValue } from "recoil";

export function StatsConsultations({ context }: { context: StatsContext }) {
  const organisation = useRecoilValue(organisationState);
  return (
    <div className="tw-grid tw-grid-cols-2 tw-gap-4 tw-my-8">
      <ConsultationsCount context={context} />
      <PersonnesSuiviesAuMoinsUneConsultation context={context} />
    </div>
  );
}

function PersonnesSuiviesAuMoinsUneConsultation({ context }: { context: StatsContext }) {
  const [personAuMoinsUneConsultation, setPersonAuMoinsUneConsultation] = useState<string>("-");
  useEffect(() => {
    sqlSelectPersonnesSuiviesAuMoinsUneConsultationCount(context).then((res) => setPersonAuMoinsUneConsultation(res[0].total));
  }, [context]);
  return <Block title="Personnes suivies au moins une consultation" data={personAuMoinsUneConsultation} />;
}

function ConsultationsCount({ context }: { context: StatsContext }) {
  const [consultations, setConsultations] = useState<string>("-");
  useEffect(() => {
    sqlSelectConsultationsCount(context).then((res) => setConsultations(res[0].total));
  }, [context]);
  return <Block title="Consultations" data={consultations} />;
}

/*
function ConsultationsParType({ context }: { context: StatsContext }) {
  const [consultationsParType, setConsultationsParType] = useState<string>("-");
  useEffect(() => {
    sqlSelectConsultationsParTypeCount(context).then((res) => setConsultationsParType(res[0].total));
  }, [context]);
  return <Block title="Consultations par type" data={consultationsParType} />;
}
*/

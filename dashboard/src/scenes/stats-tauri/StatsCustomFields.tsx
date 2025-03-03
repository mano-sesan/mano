import { useEffect, useState } from "react";
import {
  sqlSelectPersonnesByBooleanCustomField,
  sqlSelectPersonnesByBooleanCustomFieldCount,
  sqlSelectPersonnesByEnumCustomField,
  sqlSelectPersonnesByEnumCustomFieldCount,
  sqlSelectPersonnesByYesNoCustomField,
  sqlSelectPersonnesByYesNoCustomFieldCount,
  sqlSelectPersonnesDateCustomFieldAvg,
  sqlSelectPersonnesNumberCustomFieldCount,
  StatsContext,
  StatsPopulation,
} from "./queries";
import { SimpleBlockTotal } from "../stats/Blocks";
import { CustomResponsivePie } from "../stats/Charts";
import { CustomField } from "../../types/field";

type PersonLoose = {
  [key: string]: string | undefined | null | string[] | number | boolean;
};

export function CustomFieldBlock({
  context,
  population,
  field,
  onSliceClick,
}: {
  context: StatsContext;
  population: StatsPopulation;
  field: CustomField;
  onSliceClick: (label: string, value: string, data: PersonLoose[]) => void;
}) {
  if (field.type === "number") {
    return <NumberCustomField key={field.name} context={context} population={population} field={field} />;
  }
  if (field.type === "date" || field.type === "date-with-time" || field.type === "duration") {
    return <DateCustomField key={field.name} context={context} population={population} field={field} />;
  }
  if (field.type === "boolean") {
    return (
      <BooleanCustomField
        context={context}
        population={population}
        key={field.name}
        field={field}
        onSliceClick={(value, data) => {
          onSliceClick(field.label, value, data);
        }}
      />
    );
  }
  if (field.type === "yes-no") {
    return (
      <YesNoCustomField
        context={context}
        population={population}
        key={field.name}
        field={field}
        onSliceClick={(value, data) => {
          onSliceClick(field.label, value, data);
        }}
      />
    );
  }
  if (field.type === "enum") {
    return (
      <YesNoCustomField
        context={context}
        population={population}
        key={field.name}
        field={field}
        onSliceClick={(value, data) => {
          onSliceClick(field.label, value, data);
        }}
      />
    );
  }
  /*
  todo: "enum"
  if (field.type === "multi-choice") {
    return <CustomResponsivePie key={field.name} title={field.label} data={[]} />;
  }
  */
  return null;
}

export function BooleanCustomField({
  context,
  population,
  field,
  onSliceClick,
}: {
  context: StatsContext;
  population: StatsPopulation;
  field: CustomField;
  onSliceClick: (value: string, data: PersonLoose[]) => void;
}) {
  const [data, setData] = useState<{ total: string; field: string }[]>([]);
  useEffect(() => {
    sqlSelectPersonnesByBooleanCustomFieldCount(context, population, field.name).then((res) => setData(res));
  }, [context, population, field.name]);
  return (
    <CustomResponsivePie
      title={field.label}
      data={data.map((d) => ({ label: d.field, value: Number(d.total), id: d.field }))}
      onItemClick={(f) => {
        sqlSelectPersonnesByBooleanCustomField(context, population, field.name, f).then((res) => {
          onSliceClick(
            f,
            res.map((r) => ({ ...r, assignedTeams: (r.assignedTeams || "").split(",") }))
          );
        });
      }}
    />
  );
}

export function YesNoCustomField({
  context,
  population,
  field,
  onSliceClick,
}: {
  context: StatsContext;
  population: StatsPopulation;
  field: CustomField;
  onSliceClick: (value: string, data: PersonLoose[]) => void;
}) {
  const [data, setData] = useState<{ total: string; field: string }[]>([]);

  useEffect(() => {
    sqlSelectPersonnesByYesNoCustomFieldCount(context, population, field.name).then((res) => setData(res));
  }, [context, population, field.name]);

  return (
    <CustomResponsivePie
      title={field.label}
      data={data.map((d) => ({ label: d.field, value: Number(d.total), id: d.field }))}
      onItemClick={(f) => {
        sqlSelectPersonnesByYesNoCustomField(context, population, field.name, f).then((res) => {
          onSliceClick(
            f,
            res.map((r) => ({ ...r, assignedTeams: (r.assignedTeams || "").split(",") }))
          );
        });
      }}
    />
  );
}

export function EnumCustomField({
  context,
  population,
  field,
  onSliceClick,
}: {
  context: StatsContext;
  population: StatsPopulation;
  field: CustomField;
  onSliceClick: (value: string, data: PersonLoose[]) => void;
}) {
  const [data, setData] = useState<{ total: string; field: string }[]>([]);

  useEffect(() => {
    sqlSelectPersonnesByEnumCustomFieldCount(context, population, field.name).then((res) => setData(res));
  }, [context, population, field.name]);

  return (
    <CustomResponsivePie
      title={field.label}
      data={data.map((d) => ({ label: d.field, value: Number(d.total), id: d.field }))}
      onItemClick={(f) => {
        sqlSelectPersonnesByEnumCustomField(context, population, field.name, f).then((res) => {
          onSliceClick(
            f,
            res.map((r) => ({ ...r, assignedTeams: (r.assignedTeams || "").split(",") }))
          );
        });
      }}
    />
  );
}

const getDuration = (days: number) => {
  if (days < 90) return [days, "jours"];
  const months = days / (365 / 12);
  if (months < 24) return [Math.round(months), "mois"];
  const years = days / 365.25;
  return [Math.round(years), "années"];
};

export function DateCustomField({ context, population, field }: { context: StatsContext; population: StatsPopulation; field: CustomField }) {
  const [data, setData] = useState<{ avg: string }[]>([]);
  useEffect(() => {
    sqlSelectPersonnesDateCustomFieldAvg(context, population, field.name).then((res) => setData(res));
  }, [context, population, field.name]);

  const [count, unit] = data[0]?.avg ? getDuration(Number(data[0].avg)) : [null, null];
  return <SimpleBlockTotal title={field.label} total={count} unit={unit} help={null} withDecimals={false} />;
}

export function NumberCustomField({ context, population, field }: { context: StatsContext; population: StatsPopulation; field: CustomField }) {
  const [data, setData] = useState<{ total: string; avg: string }[]>([]);

  useEffect(() => {
    sqlSelectPersonnesNumberCustomFieldCount(context, population, field.name).then((res) => setData(res));
  }, [context, population, field.name]);

  const [total, avg] = data[0]?.total ? [data[0].total, data[0].avg] : [null, null];

  return <SimpleBlockTotal title={field.label} total={total} unit={null} avg={avg} help={null} />;
}

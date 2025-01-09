import { ResponsiveBar } from "@nivo/bar";

export default function ChartBar({ data }: { data: { label: string; value: number; id: string }[] }) {
  const chartData = data.map((d) => ({ name: d.label, [d.label]: d.value }));
  const categories = data.map((d) => d.label);
  const biggestValue = Math.max(...data.map((d) => d.value));
  return (
    <ResponsiveBar
      data={chartData}
      keys={categories}
      indexBy="name"
      maxValue={biggestValue}
      margin={{ top: 10, right: 0, bottom: 60, left: 60 }}
      padding={0.3}
      valueScale={{ type: "linear" }}
      indexScale={{ type: "band", round: true }}
      colors={{ scheme: "set2" }}
      borderColor={{ from: "color", modifiers: [["darker", 1.6]] }}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 2,
        tickPadding: 5,
        tickRotation: -15,
        legend: "Nombre de personnes",
        legendPosition: "middle",
        legendOffset: 50,
      }}
      axisLeft={{
        tickSize: 5,
        format: (e) => (e ? (Math.floor(e) === e ? e : "") : ""),
        tickPadding: 5,
        tickRotation: 0,
        legend: "Nombre de personnes",
        legendPosition: "middle",
        legendOffset: -50,
      }}
      labelSkipWidth={0}
      labelSkipHeight={0}
      labelTextColor={{ from: "color", modifiers: [["darker", 1.6]] }}
      animate={true}
    />
  );
}

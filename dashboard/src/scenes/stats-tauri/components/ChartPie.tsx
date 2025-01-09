import { ResponsivePie } from "@nivo/pie";

export default function ChartPie({ data }: { data: { label: string; value: number; id: string }[] }) {
  return (
    <ResponsivePie
      data={data}
      margin={{ top: 40, right: 0, bottom: 40, left: 0 }}
      sortByValue
      fit
      innerRadius={0.5}
      padAngle={0.7}
      cornerRadius={3}
      startAngle={360}
      endAngle={0}
      colors={{ scheme: "set2" }}
      borderWidth={1}
      borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
      arcLinkLabelsSkipAngle={data.length > 20 ? 12 : 8}
      arcLabelsSkipAngle={data.length > 20 ? 12 : 8}
      enableArcLinkLabels
      arcLabelsTextColor="#333333"
    />
  );
}

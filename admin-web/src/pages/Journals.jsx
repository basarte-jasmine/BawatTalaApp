import Card from "../components/Card";
import Layout from "../components/Layout";
import RankBars from "../components/charts/RankBars";
import VerticalBarGrid from "../components/charts/VerticalBarGrid";
import MetricTile from "../components/ui/MetricTile";

const MOOD_TREND = [
  { label: "Week 1", value: 62 },
  { label: "Week 2", value: 71 },
  { label: "Week 3", value: 75 },
  { label: "Week 4", value: 69 },
];

const COMMON_TAGS = [
  { label: "Academic Stress", value: 44 },
  { label: "Family", value: 32 },
  { label: "Health", value: 27 },
  { label: "Relationships", value: 21 },
];

export default function Journals({ onLogout }) {
  return (
    <Layout title="Journals" subtitle="Entry trends and content insights" onLogout={onLogout}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Mood Trend" subtitle="Monthly check-in trajectory">
          <VerticalBarGrid
            data={MOOD_TREND}
            color="linear-gradient(180deg, #7226ff 0%, #f042ff 100%)"
          />
        </Card>

        <Card title="Top Journal Themes" subtitle="Keyword distribution">
          <RankBars data={COMMON_TAGS} />
        </Card>

        <Card title="Journal Status" subtitle="Processing overview" className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricTile label="Total Entries" value={310} />
            <MetricTile label="Flagged Entries" value={17} valueClassName="text-admin-accent" />
            <MetricTile label="Reviewed Today" value={26} valueClassName="text-admin-brand" />
          </div>
        </Card>
      </div>
    </Layout>
  );
}

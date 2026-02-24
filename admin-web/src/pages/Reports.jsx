import Card from "../components/Card";
import Layout from "../components/Layout";
import MetricTile from "../components/ui/MetricTile";
import StatusPill from "../components/ui/StatusPill";

const REPORTS = [
  {
    title: "User Growth Report",
    description: "Summary of onboarding, verification, and retention trends.",
    status: "Ready",
    updated: "Today, 9:12 AM",
  },
  {
    title: "Program Distribution Report",
    description: "Breakdown of students by course and concentration.",
    status: "Ready",
    updated: "Today, 8:50 AM",
  },
  {
    title: "Barangay Insights Report",
    description: "Location-based participation and coverage statistics.",
    status: "Generating",
    updated: "Queued, 10:01 AM",
  },
];

export default function Reports({ onLogout }) {
  return (
    <Layout title="Reports" subtitle="Export and monitor admin-generated reports" onLogout={onLogout}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricTile
            label="Ready Reports"
            value={REPORTS.filter((report) => report.status === "Ready").length}
            valueClassName="text-admin-brand"
          />
          <MetricTile
            label="In Progress"
            value={REPORTS.filter((report) => report.status !== "Ready").length}
            valueClassName="text-admin-accent"
          />
          <MetricTile label="Last Sync" value="Today, 10:02 AM" />
        </div>

        <Card title="Report Queue" subtitle="Current exports and generated documents">
          <div className="space-y-3">
            {REPORTS.map((report) => (
              <div
                key={report.title}
                className="flex flex-col gap-3 rounded-xl border border-admin-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h4 className="font-semibold text-admin-ink">{report.title}</h4>
                  <p className="text-sm text-admin-muted">{report.description}</p>
                  <p className="mt-1 text-xs text-admin-muted">{report.updated}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={report.status === "Ready" ? "success" : "warning"}>
                    {report.status}
                  </StatusPill>
                  <button
                    type="button"
                    className="rounded-lg border border-admin-border bg-admin-ink px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                    disabled={report.status !== "Ready"}
                  >
                    Export
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
}

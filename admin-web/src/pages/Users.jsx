import { useMemo, useState } from "react";
import Card from "../components/Card";
import Layout from "../components/Layout";
import MetricTile from "../components/ui/MetricTile";
import StatusPill from "../components/ui/StatusPill";

const SAMPLE_USERS = [
  {
    name: "JASMINE GOCO BASARTE",
    studentId: "23-2903",
    email: "basartejasmine@gmail.com",
    program: "BS Information Technology",
    barangay: "Malanday",
    status: "Active",
  },
  {
    name: "MARIA SANTOS",
    studentId: "24-1201",
    email: "maria.santos@gmail.com",
    program: "BS Psychology",
    barangay: "Karuhatan",
    status: "Active",
  },
  {
    name: "PAOLO REYES",
    studentId: "23-4409",
    email: "paolo.reyes@gmail.com",
    program: "BS Civil Engineering",
    barangay: "Gen. T. de Leon",
    status: "Pending",
  },
  {
    name: "ANNA DELA CRUZ",
    studentId: "25-3007",
    email: "anna.cruz@gmail.com",
    program: "BSEd English",
    barangay: "Marulas",
    status: "Active",
  },
];

export default function Users({ onLogout }) {
  const [query, setQuery] = useState("");

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SAMPLE_USERS;
    return SAMPLE_USERS.filter((user) =>
      [user.name, user.studentId, user.email, user.program, user.barangay]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query]);

  return (
    <Layout title="Users" subtitle="Student records and account overview" onLogout={onLogout}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricTile label="Total Users" value={SAMPLE_USERS.length} />
          <MetricTile
            label="Active"
            value={SAMPLE_USERS.filter((u) => u.status === "Active").length}
            valueClassName="text-admin-brand"
          />
          <MetricTile
            label="Pending"
            value={SAMPLE_USERS.filter((u) => u.status === "Pending").length}
            valueClassName="text-admin-accent"
          />
        </div>

        <Card title="User Directory" subtitle="Responsive table view">
          <div className="mb-4">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, student ID, email, program, barangay"
              className="h-11 w-full rounded-lg border border-admin-border px-3 text-sm text-admin-ink focus:border-admin-brand focus:outline-none focus:ring-2 focus:ring-admin-brand/20"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-admin-border">
            <table className="min-w-[760px] w-full bg-white text-sm">
              <thead className="bg-admin-surface text-left text-admin-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Student ID</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Barangay</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.studentId} className="border-t border-admin-border">
                    <td className="px-4 py-3 font-semibold text-admin-ink">{user.name}</td>
                    <td className="px-4 py-3 text-admin-ink">{user.studentId}</td>
                    <td className="px-4 py-3 text-admin-muted">{user.email}</td>
                    <td className="px-4 py-3 text-admin-ink">{user.program}</td>
                    <td className="px-4 py-3 text-admin-ink">{user.barangay}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={user.status === "Active" ? "success" : "warning"}>
                        {user.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

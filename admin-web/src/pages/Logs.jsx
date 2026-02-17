import { useState } from "react";
import Card from "../components/Card";
import Layout from "../components/Layout";

export default function Logs() {
  const [selectedType, setSelectedType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const logs = [
    {
      id: 1,
      type: "error",
      timestamp: "2024-01-20 10:45:23",
      message: "Database connection timeout",
      user: "System",
      severity: "high",
    },
    {
      id: 2,
      type: "info",
      timestamp: "2024-01-20 10:40:15",
      message: "User login successful: john_doe",
      user: "john_doe",
      severity: "low",
    },
    {
      id: 3,
      type: "success",
      timestamp: "2024-01-20 10:35:42",
      message: "Backup completed successfully",
      user: "System",
      severity: "low",
    },
    {
      id: 4,
      type: "warning",
      timestamp: "2024-01-20 10:30:18",
      message: "High memory usage detected: 87%",
      user: "System",
      severity: "medium",
    },
    {
      id: 5,
      type: "error",
      timestamp: "2024-01-20 10:25:05",
      message: "Payment processing failed for user_123",
      user: "user_123",
      severity: "high",
    },
    {
      id: 6,
      type: "info",
      timestamp: "2024-01-20 10:20:33",
      message: "Feature toggle: New Dashboard enabled",
      user: "admin",
      severity: "low",
    },
    {
      id: 7,
      type: "success",
      timestamp: "2024-01-20 10:15:47",
      message: "Email verification sent to sarah@email.com",
      user: "sarah_smith",
      severity: "low",
    },
    {
      id: 8,
      type: "warning",
      timestamp: "2024-01-20 10:10:22",
      message: "API rate limit approaching: 950/1000 requests",
      user: "System",
      severity: "medium",
    },
  ];

  const getIcon = (type) => {
    switch (type) {
      case "error":
        return <span className="text-lg text-secondary-rust">❌</span>;
      case "success":
        return <span className="text-lg text-green-600">✅</span>;
      case "warning":
        return <span className="text-lg text-yellow-600">⚠️</span>;
      default:
        return <span className="text-lg text-primary-mint">ℹ️</span>;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "high":
        return "bg-secondary-rust/10 text-secondary-rust";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-neutral-100 text-neutral-700";
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesType = selectedType === "all" || log.type === selectedType;
    const matchesSearch =
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <Layout title="Logs">
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="w-full md:flex-1 relative">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-mint focus:ring-2 focus:ring-primary-mint/20 transition-colors"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 w-full md:w-auto flex-wrap">
            <button
              onClick={() => setSelectedType("all")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedType === "all"
                  ? "bg-primary-mint text-white"
                  : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedType("error")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedType === "error"
                  ? "bg-secondary-rust text-white"
                  : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
              }`}
            >
              Errors
            </button>
            <button
              onClick={() => setSelectedType("warning")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedType === "warning"
                  ? "bg-yellow-500 text-white"
                  : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
              }`}
            >
              Warnings
            </button>
            <button
              onClick={() => setSelectedType("success")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedType === "success"
                  ? "bg-green-600 text-white"
                  : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
              }`}
            >
              Success
            </button>
          </div>

          {/* Export Button */}
          <button className="px-4 py-2 bg-primary-lime text-secondary-coffee font-medium rounded-lg hover:shadow-md transition-all flex items-center gap-2">
            <Download size={18} />
            Export
          </button>
        </div>

        {/* Logs Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-900">
                    Severity
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-neutral-200 hover:bg-neutral-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          {getIcon(log.type)}
                          <span className="capitalize font-medium text-neutral-700">
                            {log.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">
                        {log.timestamp}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-700 max-w-xs truncate">
                        {log.message}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">
                        {log.user}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(log.severity)}`}
                        >
                          {log.severity.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-8 text-center text-neutral-500"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <FileText size={32} className="text-neutral-300" />
                        <p>No logs found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card title="Total Logs" subtitle="All time">
            <p className="text-3xl font-bold text-primary-mint">14,582</p>
          </Card>
          <Card title="Errors" subtitle="Last 7 days">
            <p className="text-3xl font-bold text-secondary-rust">142</p>
            <p className="text-sm text-neutral-600 mt-2">2.2 errors/hour</p>
          </Card>
          <Card title="Warnings" subtitle="Last 7 days">
            <p className="text-3xl font-bold text-yellow-600">58</p>
            <p className="text-sm text-neutral-600 mt-2">0.9 warnings/hour</p>
          </Card>
          <Card title="System Health" subtitle="Current status">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <p className="font-semibold text-green-600">Healthy</p>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

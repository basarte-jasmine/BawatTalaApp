import { useState } from "react";
import Card from "../components/Card";
import Chart from "../components/Chart";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";

export default function Dashboard({ onLogout }) {
  const [recentActivities] = useState([
    {
      id: 1,
      user: "Sarah Johnson",
      action: "Created new journal entry",
      time: "2 hours ago",
      icon: "📝",
    },
    {
      id: 2,
      user: "Mike Chen",
      action: "Unlocked achievement",
      time: "4 hours ago",
      icon: "🏆",
    },
    {
      id: 3,
      user: "Emma Wilson",
      action: "Joined the app",
      time: "6 hours ago",
      icon: "👋",
    },
    {
      id: 4,
      user: "Alex Brown",
      action: "Completed weekly reflection",
      time: "1 day ago",
      icon: "✨",
    },
  ]);

  const userGrowthData = [
    { label: "Week 1", value: 245 },
    { label: "Week 2", value: 389 },
    { label: "Week 3", value: 532 },
    { label: "Week 4", value: 689 },
  ];

  return (
    <Layout title="Dashboard" onLogout={onLogout}>
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon="👥"
          label="Total Users"
          value="2,543"
          change="12"
          isPositive={true}
        />
        <StatCard
          icon="📖"
          label="Journal Entries"
          value="8,294"
          change="23"
          isPositive={true}
        />
        <StatCard
          icon="📈"
          label="Engagement Score"
          value="8.7/10"
          change="5"
          isPositive={true}
        />
        <StatCard
          icon="⚡"
          label="Daily Active Users"
          value="1,834"
          change="8"
          isPositive={true}
        />
        <StatCard
          icon={TrendingUp}
          label="Active Sessions"
          value="1,247"
          change="8"
          isPositive={true}
        />
        <StatCard
          icon={Activity}
          label="Engagement Rate"
          value="68%"
          change="5"
          isPositive={true}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* User Growth Chart */}
        <div className="lg:col-span-2">
          <Chart title="User Growth (Monthly)" data={userGrowthData} />
        </div>

        {/* Recent Activities */}
        <Card title="Recent Activities" className="lg:col-span-1">
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex gap-3 pb-3 border-b border-neutral-100 last:border-0"
              >
                <span className="text-xl">{activity.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 truncate">
                    {activity.user}
                  </p>
                  <p className="text-sm text-neutral-600">{activity.action}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Top Features Used"
          className="bg-gradient-to-br from-primary-yellow/30 to-transparent"
        >
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-neutral-700">Journal Writing</span>
              <span className="font-semibold text-neutral-900">45%</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div
                className="h-full bg-primary-lime rounded-full"
                style={{ width: "45%" }}
              ></div>
            </div>
          </div>
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-neutral-700">Achievements</span>
              <span className="font-semibold text-neutral-900">28%</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div
                className="h-full bg-primary-mint rounded-full"
                style={{ width: "28%" }}
              ></div>
            </div>
          </div>
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-neutral-700">Reflections</span>
              <span className="font-semibold text-neutral-900">27%</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div
                className="h-full bg-primary-turquoise rounded-full"
                style={{ width: "27%" }}
              ></div>
            </div>
          </div>
        </Card>

        <Card
          title="System Health"
          className="bg-gradient-to-br from-green-50 to-transparent"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-neutral-700">Server Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-green-600">Operational</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-700">Response Time</span>
              <span className="font-medium text-neutral-900">142ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-700">Uptime</span>
              <span className="font-medium text-neutral-900">99.9%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-700">Database</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-green-600">Healthy</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

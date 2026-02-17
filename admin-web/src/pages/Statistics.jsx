import Card from "../components/Card";
import Chart from "../components/Chart";
import Layout from "../components/Layout";

export default function Statistics() {
  const monthlyStats = [
    { label: "January", value: 320 },
    { label: "February", value: 450 },
    { label: "March", value: 520 },
    { label: "April", value: 680 },
    { label: "May", value: 750 },
    { label: "June", value: 820 },
  ];

  const featureUsage = [
    { label: "Journaling", value: 890 },
    { label: "Achievements", value: 720 },
    { label: "Reflections", value: 650 },
    { label: "Mindfulness", value: 580 },
  ];

  const deviceStats = [
    { label: "iOS", value: 1200 },
    { label: "Android", value: 950 },
    { label: "Web", value: 680 },
    { label: "Tablet", value: 320 },
  ];

  return (
    <Layout title="Statistics">
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card icon="📊" title="Total Sessions" subtitle="All time">
            <p className="text-3xl font-bold text-primary-lime">142,580</p>
            <p className="text-sm text-neutral-600 mt-2">
              Average: 45 sessions/day
            </p>
          </Card>
          <Card
            icon="📈"
            title="Avg Session Duration"
            subtitle="User engagement"
          >
            <p className="text-3xl font-bold text-primary-mint">14m 32s</p>
            <p className="text-sm text-neutral-600 mt-2">
              Peak: 8:00 PM - 10:00 PM
            </p>
          </Card>
          <Card icon="🥧" title="Return Rate" subtitle="30-day window">
            <p className="text-3xl font-bold text-primary-turquoise">68.4%</p>
            <p className="text-sm text-neutral-600 mt-2">
              ↑ 12% from last month
            </p>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Chart title="Monthly User Growth" data={monthlyStats} />
          <Chart title="Feature Usage Statistics" data={featureUsage} />
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Chart title="Device Distribution" data={deviceStats} />

          <Card title="Top Performing Hours">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-neutral-700">8:00 PM - 10:00 PM</span>
                  <span className="font-semibold text-primary-lime">
                    2.4K sessions
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="h-full bg-primary-lime rounded-full"
                    style={{ width: "100%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-neutral-700">10:00 PM - 12:00 AM</span>
                  <span className="font-semibold text-primary-mint">
                    2.0K sessions
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="h-full bg-primary-mint rounded-full"
                    style={{ width: "83%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-neutral-700">6:00 PM - 8:00 PM</span>
                  <span className="font-semibold text-primary-turquoise">
                    1.8K sessions
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="h-full bg-primary-turquoise rounded-full"
                    style={{ width: "75%" }}
                  ></div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Engagement Stats */}
        <Card
          title="User Engagement Metrics"
          className="bg-gradient-to-r from-primary-yellow/20 to-transparent"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-sm text-neutral-600 mb-2">
                Daily Active Users
              </p>
              <p className="text-2xl font-bold text-primary-lime">1,240</p>
              <p className="text-xs text-neutral-600 mt-1">48.8% of total</p>
            </div>
            <div className="text-center border-l border-neutral-200">
              <p className="text-sm text-neutral-600 mb-2">
                Weekly Active Users
              </p>
              <p className="text-2xl font-bold text-primary-mint">2,140</p>
              <p className="text-xs text-neutral-600 mt-1">84.1% of total</p>
            </div>
            <div className="text-center border-l border-neutral-200">
              <p className="text-sm text-neutral-600 mb-2">New Users</p>
              <p className="text-2xl font-bold text-primary-turquoise">320</p>
              <p className="text-xs text-neutral-600 mt-1">Last 7 days</p>
            </div>
            <div className="text-center border-l border-neutral-200">
              <p className="text-sm text-neutral-600 mb-2">Churn Rate</p>
              <p className="text-2xl font-bold text-secondary-rust">2.3%</p>
              <p className="text-xs text-neutral-600 mt-1">Monthly</p>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

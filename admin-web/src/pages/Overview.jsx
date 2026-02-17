import Card from "../components/Card";
import Layout from "../components/Layout";

export default function Overview() {
  return (
    <Layout title="Overview">
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card icon="👥" title="Active Users" subtitle="Last 30 days">
            <p className="text-3xl font-bold text-primary-mint mb-2">2,543</p>
            <p className="text-sm text-green-600">↑ 12% from last month</p>
          </Card>
          <Card icon="🎯" title="Conversion Rate" subtitle="Total signups">
            <p className="text-3xl font-bold text-primary-lime mb-2">23.4%</p>
            <p className="text-sm text-green-600">↑ 4.5% improvement</p>
          </Card>
          <Card
            icon="📈"
            title="Monthly Revenue"
            subtitle="Subscription growth"
          >
            <p className="text-3xl font-bold text-primary-turquoise mb-2">
              $12.5K
            </p>
            <p className="text-sm text-green-600">↑ 18% increase</p>
          </Card>
          <Card
            icon="📊"
            title="Avg Session Duration"
            subtitle="User engagement"
          >
            <p className="text-3xl font-bold text-secondary-coffee mb-2">
              14m 32s
            </p>
            <p className="text-sm text-green-600">↑ 3m increase</p>
          </Card>
        </div>

        {/* Detailed Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="User Demographics" className="lg:col-span-1">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-neutral-700">Ages 18-25</span>
                  <span className="font-semibold">35%</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="h-full bg-primary-lime rounded-full"
                    style={{ width: "35%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-neutral-700">Ages 26-35</span>
                  <span className="font-semibold">42%</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="h-full bg-primary-mint rounded-full"
                    style={{ width: "42%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-neutral-700">Ages 36-50</span>
                  <span className="font-semibold">18%</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="h-full bg-primary-turquoise rounded-full"
                    style={{ width: "18%" }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-neutral-700">Ages 50+</span>
                  <span className="font-semibold">5%</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="h-full bg-secondary-coffee rounded-full"
                    style={{ width: "5%" }}
                  ></div>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Platform Usage" className="lg:col-span-1">
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-neutral-200">
                <span className="text-neutral-700">Mobile</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">58%</span>
                  <div className="w-12 h-6 bg-primary-lime rounded-full"></div>
                </div>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-neutral-200">
                <span className="text-neutral-700">Desktop</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">35%</span>
                  <div className="w-8 h-6 bg-primary-mint rounded-full"></div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-700">Tablet</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">7%</span>
                  <div className="w-2 h-6 bg-primary-turquoise rounded-full"></div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Performance Overview */}
        <Card
          title="Performance Metrics"
          className="bg-gradient-to-r from-primary-yellow/20 to-transparent"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <p className="text-sm text-neutral-600 mb-2">Page Load Time</p>
              <p className="text-2xl font-bold text-primary-mint">1.23s</p>
              <p className="text-xs text-green-600 mt-1">↓ 15% improvement</p>
            </div>
            <div className="text-center p-4 border-l border-r border-neutral-200">
              <p className="text-sm text-neutral-600 mb-2">Error Rate</p>
              <p className="text-2xl font-bold text-primary-lime">0.02%</p>
              <p className="text-xs text-green-600 mt-1">↓ 0.8% improvement</p>
            </div>
            <div className="text-center p-4">
              <p className="text-sm text-neutral-600 mb-2">Cache Hit Rate</p>
              <p className="text-2xl font-bold text-primary-turquoise">94.5%</p>
              <p className="text-xs text-green-600 mt-1">↑ 8% improvement</p>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

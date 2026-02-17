import { useState } from "react";
import Card from "../components/Card";
import Layout from "../components/Layout";

export default function FeatureToggles() {
  const [features, setFeatures] = useState([
    {
      id: 1,
      name: "Advanced Analytics",
      description: "Detailed user analytics and insights dashboard",
      icon: "📊",
      enabled: true,
      rolloutPercentage: 100,
      createdAt: "2024-01-10",
    },
    {
      id: 2,
      name: "AI Writing Assistant",
      description: "AI-powered writing suggestions for journal entries",
      icon: "⚡",
      enabled: true,
      rolloutPercentage: 50,
      createdAt: "2024-01-15",
    },
    {
      id: 3,
      name: "Social Sharing",
      description: "Share achievements and milestones on social media",
      icon: "👥",
      enabled: false,
      rolloutPercentage: 30,
      createdAt: "2024-01-20",
    },
    {
      id: 4,
      name: "Premium Themes",
      description: "Access to exclusive customization themes",
      icon: "📚",
      enabled: true,
      rolloutPercentage: 75,
      createdAt: "2024-01-18",
    },
    {
      id: 5,
      name: "Gamification 2.0",
      description: "Enhanced achievement system and badges",
      icon: "🏆",
      enabled: false,
      rolloutPercentage: 20,
      createdAt: "2024-01-22",
    },
    {
      id: 6,
      name: "Smart Notifications",
      description: "Intelligent push notifications based on user patterns",
      icon: "🔔",
      enabled: true,
      rolloutPercentage: 100,
      createdAt: "2024-01-12",
    },
  ]);

  const toggleFeature = (id) => {
    setFeatures(
      features.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)),
    );
  };

  const updateRollout = (id, percentage) => {
    setFeatures(
      features.map((f) =>
        f.id === id ? { ...f, rolloutPercentage: percentage } : f,
      ),
    );
  };

  return (
    <Layout title="Feature Toggles">
      <div className="space-y-6">
        <div className="bg-primary-yellow/20 border border-primary-lime rounded-lg p-4">
          <p className="text-sm text-neutral-700">
            <strong>Tip:</strong> Use rollout percentages to gradually deploy
            features to users. Enable/disable to control feature availability.
          </p>
        </div>

        {/* Features Grid */}
        <div className="space-y-4">
          {features.map((feature) => {
            return (
              <Card
                key={feature.id}
                className="border-l-4 border-l-primary-mint"
              >
                <div className="flex items-start justify-between gap-6">
                  {/* Feature Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-primary-yellow rounded-lg text-xl">
                        {feature.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900">
                          {feature.name}
                        </h3>
                        <p className="text-sm text-neutral-600">
                          {feature.description}
                        </p>
                      </div>
                    </div>

                    {/* Rollout Percentage */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-neutral-600">
                          Rollout: {feature.rolloutPercentage}%
                        </span>
                        <span className="text-xs text-neutral-500">
                          {Math.round((feature.rolloutPercentage / 100) * 2543)}{" "}
                          users
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={feature.rolloutPercentage}
                        onChange={(e) =>
                          updateRollout(feature.id, parseInt(e.target.value))
                        }
                        disabled={!feature.enabled}
                        className="w-full h-2 bg-neutral-200 rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed accent-primary-mint"
                      />
                    </div>

                    {/* Meta Info */}
                    <p className="text-xs text-neutral-500 mt-3">
                      Created: {feature.createdAt}
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex flex-col items-end gap-4">
                    <button
                      onClick={() => toggleFeature(feature.id)}
                      className={`w-14 h-8 rounded-full transition-all flex items-center ${
                        feature.enabled
                          ? "bg-green-500 justify-end"
                          : "bg-neutral-300 justify-start"
                      } p-1`}
                    >
                      <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
                    </button>
                    <span
                      className={`text-sm font-medium ${
                        feature.enabled ? "text-green-600" : "text-neutral-500"
                      }`}
                    >
                      {feature.enabled ? "ON" : "OFF"}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Feature Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title="Active Features" subtitle="Currently enabled">
            <p className="text-3xl font-bold text-primary-lime">
              {features.filter((f) => f.enabled).length}
            </p>
            <p className="text-sm text-neutral-600 mt-2">
              {features.length} total features
            </p>
          </Card>
          <Card title="Avg Rollout" subtitle="Across all features">
            <p className="text-3xl font-bold text-primary-mint">
              {Math.round(
                features.reduce((sum, f) => sum + f.rolloutPercentage, 0) /
                  features.length,
              )}
              %
            </p>
            <p className="text-sm text-neutral-600 mt-2">Staged deployment</p>
          </Card>
          <Card title="Users Affected" subtitle="By active features">
            <p className="text-3xl font-bold text-primary-turquoise">
              {Math.round(
                (features
                  .filter((f) => f.enabled)
                  .reduce((sum, f) => sum + f.rolloutPercentage, 0) /
                  features.filter((f) => f.enabled).length) *
                  2543,
              )}
            </p>
            <p className="text-sm text-neutral-600 mt-2">Out of 2,543 users</p>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

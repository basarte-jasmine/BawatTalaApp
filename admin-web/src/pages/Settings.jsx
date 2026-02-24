import { useState } from "react";
import Card from "../components/Card";
import Layout from "../components/Layout";
import MetricTile from "../components/ui/MetricTile";
import SettingToggleRow from "../components/ui/SettingToggleRow";

export default function Settings({ onLogout }) {
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    emailNotifications: true,
    securityAlerts: true,
    autoBackups: true,
  });

  return (
    <Layout title="Settings" subtitle="System preferences and admin configuration" onLogout={onLogout}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="General" subtitle="Base system controls">
          <div className="space-y-4">
            <div className="rounded-xl border border-admin-border bg-admin-surface p-4">
              <p className="text-sm font-semibold text-admin-ink">Application Name</p>
              <p className="mt-1 text-admin-muted">BAWAT TALA ADMIN</p>
            </div>
            <div className="rounded-xl border border-admin-border bg-admin-surface p-4">
              <p className="text-sm font-semibold text-admin-ink">Environment</p>
              <p className="mt-1 text-admin-muted">Production</p>
            </div>
          </div>
        </Card>

        <Card title="Feature Controls" subtitle="Enable or disable modules">
          <div className="space-y-3">
            <SettingToggleRow
              label="Maintenance Mode"
              value={settings.maintenanceMode}
              onChange={(value) => setSettings((prev) => ({ ...prev, maintenanceMode: value }))}
            />
            <SettingToggleRow
              label="Email Notifications"
              value={settings.emailNotifications}
              onChange={(value) => setSettings((prev) => ({ ...prev, emailNotifications: value }))}
            />
            <SettingToggleRow
              label="Security Alerts"
              value={settings.securityAlerts}
              onChange={(value) => setSettings((prev) => ({ ...prev, securityAlerts: value }))}
            />
            <SettingToggleRow
              label="Automatic Backups"
              value={settings.autoBackups}
              onChange={(value) => setSettings((prev) => ({ ...prev, autoBackups: value }))}
            />
          </div>
        </Card>

        <Card title="Security" subtitle="Session and password policy" className="xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricTile label="Session Timeout" value="30 min" />
            <MetricTile label="Failed Login Limit" value="3 tries" />
            <MetricTile label="Reset OTP Expiry" value="60 sec" />
          </div>
        </Card>
      </div>
    </Layout>
  );
}

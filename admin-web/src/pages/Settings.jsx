import { useState } from "react";
import Card from "../components/Card";
import Layout from "../components/Layout";

export default function Settings() {
  const [settings, setSettings] = useState({
    appName: "BAWAT TALA",
    appVersion: "2.1.0",
    maintenanceMode: false,
    emailNotifications: true,
    pushNotifications: true,
    securityAlerts: true,
    dataBackup: true,
    backupFrequency: "daily",
    maxLoginAttempts: 5,
    sessionTimeout: 30,
    twoFactorAuth: false,
  });

  const [saved, setSaved] = useState(false);

  const handleChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Layout title="Settings">
      <div className="space-y-6 max-w-4xl">
        {/* Save Notification */}
        {saved && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
              ✓
            </div>
            Settings saved successfully!
          </div>
        )}

        {/* General Settings */}
        <Card title="General Settings" icon={Shield}>
          <div className="space-y-6">
            {/* App Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Application Name
              </label>
              <input
                type="text"
                value={settings.appName}
                onChange={(e) => handleChange("appName", e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-mint focus:ring-2 focus:ring-primary-mint/20 transition-colors"
              />
            </div>

            {/* Version */}
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                App Version
              </label>
              <div className="px-4 py-2 bg-neutral-100 rounded-lg text-neutral-700">
                {settings.appVersion}
              </div>
            </div>

            {/* Maintenance Mode */}
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div>
                <p className="font-medium text-neutral-900">Maintenance Mode</p>
                <p className="text-sm text-neutral-600">
                  Temporarily disable app for maintenance
                </p>
              </div>
              <button
                onClick={() =>
                  handleChange("maintenanceMode", !settings.maintenanceMode)
                }
                className={`w-14 h-8 rounded-full transition-all flex items-center ${
                  settings.maintenanceMode
                    ? "bg-yellow-500 justify-end"
                    : "bg-neutral-300 justify-start"
                } p-1`}
              >
                <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
              </button>
            </div>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card title="Notifications" icon={Bell}>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div>
                <p className="font-medium text-neutral-900">
                  Email Notifications
                </p>
                <p className="text-sm text-neutral-600">
                  Receive email alerts for important events
                </p>
              </div>
              <button
                onClick={() =>
                  handleChange(
                    "emailNotifications",
                    !settings.emailNotifications,
                  )
                }
                className={`w-14 h-8 rounded-full transition-all flex items-center ${
                  settings.emailNotifications
                    ? "bg-green-500 justify-end"
                    : "bg-neutral-300 justify-start"
                } p-1`}
              >
                <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div>
                <p className="font-medium text-neutral-900">
                  Push Notifications
                </p>
                <p className="text-sm text-neutral-600">
                  System-wide push notifications
                </p>
              </div>
              <button
                onClick={() =>
                  handleChange("pushNotifications", !settings.pushNotifications)
                }
                className={`w-14 h-8 rounded-full transition-all flex items-center ${
                  settings.pushNotifications
                    ? "bg-green-500 justify-end"
                    : "bg-neutral-300 justify-start"
                } p-1`}
              >
                <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div>
                <p className="font-medium text-neutral-900">Security Alerts</p>
                <p className="text-sm text-neutral-600">
                  Get notified of security events
                </p>
              </div>
              <button
                onClick={() =>
                  handleChange("securityAlerts", !settings.securityAlerts)
                }
                className={`w-14 h-8 rounded-full transition-all flex items-center ${
                  settings.securityAlerts
                    ? "bg-green-500 justify-end"
                    : "bg-neutral-300 justify-start"
                } p-1`}
              >
                <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
              </button>
            </div>
          </div>
        </Card>

        {/* Data & Backup */}
        <Card title="Data & Backup" icon={Mail}>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div>
                <p className="font-medium text-neutral-900">
                  Automatic Backups
                </p>
                <p className="text-sm text-neutral-600">
                  Enable automatic data backups
                </p>
              </div>
              <button
                onClick={() => handleChange("dataBackup", !settings.dataBackup)}
                className={`w-14 h-8 rounded-full transition-all flex items-center ${
                  settings.dataBackup
                    ? "bg-green-500 justify-end"
                    : "bg-neutral-300 justify-start"
                } p-1`}
              >
                <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
              </button>
            </div>

            {settings.dataBackup && (
              <div>
                <label className="block text-sm font-medium text-neutral-900 mb-2">
                  Backup Frequency
                </label>
                <select
                  value={settings.backupFrequency}
                  onChange={(e) =>
                    handleChange("backupFrequency", e.target.value)
                  }
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-mint focus:ring-2 focus:ring-primary-mint/20 transition-colors"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}

            <button className="w-full py-2 px-4 bg-primary-lime text-secondary-coffee font-medium rounded-lg hover:shadow-md transition-all">
              Download Backup Now
            </button>
          </div>
        </Card>

        {/* Security Settings */}
        <Card title="Security" icon={Lock}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Max Login Attempts
              </label>
              <input
                type="number"
                value={settings.maxLoginAttempts}
                onChange={(e) =>
                  handleChange("maxLoginAttempts", parseInt(e.target.value))
                }
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-mint focus:ring-2 focus:ring-primary-mint/20 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) =>
                  handleChange("sessionTimeout", parseInt(e.target.value))
                }
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-primary-mint focus:ring-2 focus:ring-primary-mint/20 transition-colors"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <div>
                <p className="font-medium text-neutral-900">
                  Two-Factor Authentication
                </p>
                <p className="text-sm text-neutral-600">
                  Require 2FA for admin accounts
                </p>
              </div>
              <button
                onClick={() =>
                  handleChange("twoFactorAuth", !settings.twoFactorAuth)
                }
                className={`w-14 h-8 rounded-full transition-all flex items-center ${
                  settings.twoFactorAuth
                    ? "bg-green-500 justify-end"
                    : "bg-neutral-300 justify-start"
                } p-1`}
              >
                <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
              </button>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-4 pt-6 border-t border-neutral-200">
          <button className="px-6 py-2 border border-neutral-300 text-neutral-700 font-medium rounded-lg hover:bg-neutral-50 transition-all">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-gradient-to-r from-primary-lime to-primary-mint text-secondary-coffee font-medium rounded-lg hover:shadow-md transition-all flex items-center gap-2"
          >
            <Save size={18} />
            Save Settings
          </button>
        </div>
      </div>
    </Layout>
  );
}

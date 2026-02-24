import ToggleSwitch from "./ToggleSwitch";

export default function SettingToggleRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-admin-border bg-white p-3">
      <p className="font-semibold text-admin-ink">{label}</p>
      <ToggleSwitch value={value} onChange={onChange} />
    </div>
  );
}

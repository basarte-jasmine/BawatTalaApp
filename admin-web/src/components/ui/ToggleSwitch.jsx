export default function ToggleSwitch({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`h-8 w-14 rounded-full p-1 transition ${
        value ? "bg-admin-brand" : "bg-admin-border"
      }`}
    >
      <span
        className={`block h-6 w-6 rounded-full bg-white transition ${
          value ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}

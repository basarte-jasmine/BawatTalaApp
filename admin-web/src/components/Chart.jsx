export default function Chart({ title, data = [] }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 shadow-sm">
      <h3 className="font-semibold text-neutral-900 mb-4">{title}</h3>
      <div className="space-y-4">
        {data.length > 0 ? (
          data.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-600">{item.label}</span>
                <span className="font-medium text-neutral-900">
                  {item.value}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-mint to-primary-lime transition-all duration-300"
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                ></div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-neutral-500 text-center py-8">No data available</p>
        )}
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export default function Toast({ message, type = "success", onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isSuccess = type === "success";
  const isError = type === "error";

  const bgClasses = isSuccess
    ? "bg-[#1f4a35] text-white border border-[#2f684c]"
    : isError
    ? "bg-[#991b1b] text-white border border-[#b91c1c]"
    : "bg-[#1e293b] text-white border border-[#334155]";

  const IconComponent = isSuccess ? CheckCircle2 : isError ? AlertCircle : Info;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex max-w-md items-center gap-3 rounded-2xl px-4 py-3.5 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
      <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg ${bgClasses}`}>
        <IconComponent className="h-5 w-5 shrink-0 text-emerald-300" />
        <p className="text-sm font-medium leading-snug">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

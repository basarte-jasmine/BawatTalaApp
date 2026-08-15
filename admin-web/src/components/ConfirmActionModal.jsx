import Modal from "./Modal";

export default function ConfirmActionModal({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmTone = "emerald",
  description,
  isOpen,
  onClose,
  onConfirm,
  inputLabel = "",
  inputPlaceholder = "",
  inputRequired = false,
  inputValue = "",
  onInputChange,
  title,
}) {
  const confirmClassName =
    confirmTone === "rose"
      ? "bg-rose-500 hover:bg-rose-600"
      : confirmTone === "amber"
        ? "bg-amber-500 hover:bg-amber-600"
        : "bg-[#229365] hover:bg-[#1b7b54]";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{description}</p>
        {inputLabel ? (
          <label className="block text-sm font-semibold text-slate-700">
            {inputLabel}
            <textarea
              value={inputValue}
              onChange={(event) => onInputChange?.(event.target.value)}
              rows={3}
              placeholder={inputPlaceholder}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        ) : null}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={inputRequired && !String(inputValue || "").trim()}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

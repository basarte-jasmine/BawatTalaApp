import Modal from "./Modal";

export default function ConfirmActionModal({
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmTone = "emerald",
  description,
  isOpen,
  onClose,
  onConfirm,
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
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

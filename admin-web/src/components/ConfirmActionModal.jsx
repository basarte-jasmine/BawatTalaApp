import { useEffect, useRef } from "react";
import Modal from "./Modal";

function PinBoxes({ length = 4, value = "", onChange, autoFocus = true }) {
  const inputRefs = useRef([]);
  const chars = Array.from({ length }, (_, i) => value[i] || "");

  useEffect(() => {
    if (autoFocus) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  function setChar(index, char) {
    const next = chars.slice();
    next[index] = char;
    onChange?.(next.join(""));
  }

  function setDigitsFrom(index, rawValue) {
    const digits = String(rawValue || "").replace(/\D/g, "").slice(0, length - index);
    if (!digits) {
      setChar(index, "");
      return;
    }

    const next = chars.slice();
    digits.split("").forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    onChange?.(next.join(""));
    const nextIdx = Math.min(index + digits.length, length - 1);
    inputRefs.current[nextIdx]?.focus();
  }

  return (
    <div className="flex justify-center gap-3 py-3">
      {chars.map((char, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete="new-password"
          value={char}
          onChange={(event) => {
            setDigitsFrom(index, event.target.value);
          }}
          onPaste={(event) => {
            event.preventDefault();
            setDigitsFrom(0, event.clipboardData.getData("text"));
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !chars[index] && inputRefs.current[index - 1]) {
              inputRefs.current[index - 1].focus();
            }
          }}
          className="h-14 w-14 rounded-2xl border-2 border-slate-200 bg-slate-50/60 text-center text-2xl font-bold tracking-wider text-slate-800 transition focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-600/15"
        />
      ))}
    </div>
  );
}

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
  inputType = "textarea",
  inputValue = "",
  onInputChange,
  title,
}) {
  const confirmClassName =
    confirmTone === "rose"
      ? "bg-rose-500 hover:bg-rose-600"
      : confirmTone === "amber"
        ? "bg-amber-500 hover:bg-amber-600"
        : "bg-emerald-700 hover:bg-emerald-800";

  const sharedInputClassName =
    "mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-600">{description}</p>
        {inputLabel ? (
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600">
              {inputLabel}
            </div>
            {inputType === "pin" ? (
              <PinBoxes value={inputValue} onChange={onInputChange} length={4} autoFocus={isOpen} />
            ) : inputType === "textarea" ? (
              <textarea
                value={inputValue}
                onChange={(event) => onInputChange?.(event.target.value)}
                rows={3}
                placeholder={inputPlaceholder}
                className={sharedInputClassName}
              />
            ) : (
              <input
                type={inputType}
                value={inputValue}
                onChange={(event) => onInputChange?.(event.target.value)}
                placeholder={inputPlaceholder}
                autoComplete="off"
                inputMode={inputType === "password" ? "numeric" : undefined}
                className={sharedInputClassName}
              />
            )}
          </div>
        ) : null}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={inputRequired && (inputType === "pin" ? String(inputValue || "").length < 4 : !String(inputValue || "").trim())}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
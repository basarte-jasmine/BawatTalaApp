import { useRef } from "react";

export default function OtpBoxes({ length = 6, value, onChange }) {
  const inputRefs = useRef([]);
  const chars = Array.from({ length }, (_, i) => value[i] || "");

  function setChar(index, char) {
    const next = chars.slice();
    next[index] = char;
    onChange(next.join(""));
  }

  function setDigitsFrom(index, rawValue) {
    const digits = rawValue.replace(/\D/g, "").slice(0, length - index);
    if (!digits) {
      setChar(index, "");
      return;
    }

    const next = chars.slice();
    digits.split("").forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    onChange(next.join(""));
    inputRefs.current[Math.min(index + digits.length, length - 1)]?.focus();
  }

  return (
    <div className="flex justify-center gap-2">
      {chars.map((char, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={length}
          value={char}
          onChange={(event) => {
            setDigitsFrom(index, event.target.value);
          }}
          onPaste={(event) => {
            event.preventDefault();
            setDigitsFrom(index, event.clipboardData.getData("text"));
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !chars[index] && inputRefs.current[index - 1]) {
              inputRefs.current[index - 1].focus();
            }
          }}
          className="h-12 w-11 rounded-lg border border-admin-border bg-white text-center text-xl font-semibold text-admin-ink focus:border-admin-brand focus:outline-none focus:ring-2 focus:ring-admin-brand/20"
        />
      ))}
    </div>
  );
}

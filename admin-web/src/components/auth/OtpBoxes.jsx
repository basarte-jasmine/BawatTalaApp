import { useRef } from "react";

export default function OtpBoxes({ length = 6, value, onChange }) {
  const inputRefs = useRef([]);
  const chars = Array.from({ length }, (_, i) => value[i] || "");

  function setChar(index, char) {
    const next = chars.slice();
    next[index] = char;
    onChange(next.join(""));
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
          maxLength={1}
          value={char}
          onChange={(event) => {
            const digit = event.target.value.replace(/\D/g, "").slice(-1);
            setChar(index, digit);
            if (digit && inputRefs.current[index + 1]) {
              inputRefs.current[index + 1].focus();
            }
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

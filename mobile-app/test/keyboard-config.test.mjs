import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Regression guard for the shipped Android keyboard bug.
 *
 * These are static assertions on the auth screens only. They cannot prove that the IME stays
 * open — that needs a real Android device/emulator. What they do prove is that the exact
 * configuration that shipped broken (an Android `KeyboardAvoidingView` with `behavior="height"`
 * on top of `adjustResize`) cannot silently come back, and that the login field contract
 * (focus handlers, password visibility, scroll behaviour) is intact.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const AUTH_SCREENS = [
  "app/login.tsx",
  "app/register.tsx",
  "app/reset-password.tsx",
  "app/reset-password-otp.tsx",
  "app/reset-password-new.tsx",
  "app/profile-reset-password.tsx",
  "components/layout/AuthCardLayout.tsx",
];

test("no auth screen adds Android keyboard compensation on top of adjustResize", () => {
  for (const screen of AUTH_SCREENS) {
    const source = read(screen);
    assert.doesNotMatch(
      source,
      /behavior=\{[^}]*:\s*"(?:height|padding|position)"/,
      screen + " must not set a non-iOS KeyboardAvoidingView behavior",
    );
  }
});

test("login keeps the keyboard open while typing and scrolling", () => {
  const source = read("app/login.tsx");

  assert.match(source, /keyboardShouldPersistTaps="always"/);
  assert.match(source, /keyboardDismissMode="none"/);
  assert.doesNotMatch(source, /Keyboard\.dismiss\(/);
});

test("login Student ID and Password fields both report focus", () => {
  const source = read("app/login.tsx");

  assert.match(source, /onFocus=\{\(\) => setFocusedField\("studentId"\)\}/);
  assert.match(source, /onFocus=\{\(\) => setFocusedField\("password"\)\}/);
  assert.match(source, /onBlur=\{\(\) => setFocusedField\(null\)\}/);
});

test("login password visibility and submission are still wired", () => {
  const source = read("app/login.tsx");

  assert.match(source, /secureTextEntry=\{!showPassword\}/);
  assert.match(source, /onSubmitEditing=\{handleLogin\}/);
});

test("Android is configured to resize for the IME", () => {
  const appJson = JSON.parse(read("app.json"));

  assert.equal(appJson.expo.android.softwareKeyboardLayoutMode, "resize");
  assert.equal(appJson.expo.android.edgeToEdgeEnabled, true);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMasterPasswordStrength } from "./masterPasswordStrength.js";

test("12 karakterden kısa parola reddedilir", () => {
  const result = checkMasterPasswordStrength("kisa-parola");
  assert.equal(result.ok, false);
});

test("tek karakterin tekrarından oluşan parola reddedilir", () => {
  const result = checkMasterPasswordStrength("111111111111");
  assert.equal(result.ok, false);
});

test("makul uzunlukta, çeşitli bir parola kabul edilir", () => {
  const result = checkMasterPasswordStrength("dogru-at-akvaryum-42");
  assert.equal(result.ok, true);
});

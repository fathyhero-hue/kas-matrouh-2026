import test from "node:test";
import assert from "node:assert/strict";
import { hasRegistrationAccess, isRegistrationPaid, getRegistrationPaymentMethod } from "../lib/sport/registration-payment.ts";

test("online and confirmed cash registrations share the paid state", () => {
  assert.equal(isRegistrationPaid({ payment_status: "paid", payment_method: "paymob" }), true);
  assert.equal(isRegistrationPaid({ payment_status: "paid", payment_method: "cash" }), true);
  assert.equal(getRegistrationPaymentMethod({ payment_status: "paid", payment_method: "paymob_wallet" }), "paymob");
  assert.equal(getRegistrationPaymentMethod({ payment_status: "paid", payment_method: "cash" }), "cash");
});

test("legacy manual_access preserves access without being treated as paid", () => {
  const registration = { payment_status: "manual_access", payment_method: "manual_admin", admin_manual_access: true };
  assert.equal(isRegistrationPaid(registration), false);
  assert.equal(hasRegistrationAccess(registration), true);
  assert.equal(getRegistrationPaymentMethod(registration), "legacy");
});

test("pending and failed registrations are neither paid nor accessible", () => {
  for (const payment_status of ["pending_payment", "failed"]) {
    assert.equal(isRegistrationPaid({ payment_status }), false);
    assert.equal(hasRegistrationAccess({ payment_status }), false);
  }
});

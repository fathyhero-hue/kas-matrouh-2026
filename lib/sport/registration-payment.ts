export type RegistrationPaymentRecord = {
  payment_status?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  roster_access_active?: boolean | null;
  admin_manual_access?: boolean | null;
};

/** A registration is paid only after a real payment or an explicit cash confirmation. */
export function isRegistrationPaid(registration: RegistrationPaymentRecord | null | undefined): boolean {
  return registration?.payment_status === "paid";
}

/** Preserve legacy access behavior separately from the public paid status. */
export function hasRegistrationAccess(registration: RegistrationPaymentRecord | null | undefined): boolean {
  return Boolean(
    registration &&
      (isRegistrationPaid(registration) ||
        registration.payment_status === "manual_access" ||
        registration.roster_access_active === true ||
        registration.admin_manual_access === true)
  );
}

export function getRegistrationPaymentMethod(registration: RegistrationPaymentRecord | null | undefined): "paymob" | "cash" | "legacy" | null {
  if (!registration) return null;
  if (registration.payment_status === "manual_access") return "legacy";
  if (registration.payment_method === "cash") return "cash";
  if (registration.payment_method === "paymob" || registration.payment_method === "paymob_wallet") return "paymob";
  return null;
}

export function maskGivenName(givenName: string, familyName: string): string {
  const initial = familyName.trim().charAt(0).toUpperCase();
  return `${givenName} ${initial}.`;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(user.length - 2, 3))}@${domain}`;
}

export function maskPhone(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `**** ${last4}`;
}

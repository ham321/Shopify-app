/** Constants that are safe to import from both server and browser code. */

export const VISIBILITY: Record<string, string> = {
  PUBLIC: "Public - guests can search for it",
  LINK_ONLY: "Link only - only people with the link",
  PASSWORD: "Password protected",
};

export const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct / typed link",
  copy: "Copied link",
  mail: "Email",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  sms: "Text message",
  social: "Other social",
  search: "Search engines",
  other: "Other websites",
};

export function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

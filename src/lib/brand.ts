import logoAsset from "@/assets/logo.png.asset.json";

export const LOGO_URL = logoAsset.url;

export const COMPANY = "52 Logistics, Inc.";

export const PUBLIC_NAV = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Careers", to: "/careers" },
  { label: "Driver Resources", to: "/driver-resources" },
  { label: "FAQ", to: "/faq" },
  { label: "Contact", to: "/contact" },
] as const;

export const LEGAL_NAV = [
  { label: "Privacy", to: "/privacy" },
  { label: "Applicant Notice", to: "/applicant-notice" },
  { label: "Terms", to: "/terms" },
  { label: "Accessibility", to: "/accessibility" },
] as const;

/** Approved fleet identifiers from the SRS. Never invent additional numbers. */
export const APPROVED_FLEET_IDS = ["529062", "529063", "529064", "529065", "338917"];

export function formatAddress(s: Record<string, string | null>) {
  const line1 = s["address_line1"] ?? "";
  const city = s["address_city"] ?? "";
  const state = s["address_state"] ?? "";
  const zip = s["address_zip"] ?? "";
  return [line1, [city, state].filter(Boolean).join(", "), zip].filter(Boolean).join(" · ");
}

import { table } from "./mock/db";

export function generateResumeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function applicationResumeDays(): number {
  const value = table("site_settings").find((setting) => setting["key"] === "application_resume_days")?.["value"];
  const days = Number(value);
  return Number.isInteger(days) && days > 0 && days <= 36500 ? days : 30;
}

export function resumeExpiry(now = Date.now()): string {
  return new Date(now + applicationResumeDays() * 86400000).toISOString();
}

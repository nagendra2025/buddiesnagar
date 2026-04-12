/**
 * Canonical profile timezones (edit profile, API validation, weather resolution).
 * Keep in sync with `ProfilesSection` optgroups.
 */
export const PROFILE_TIMEZONES = [
  "Asia/Kolkata",
  "America/New_York",
  "America/Detroit",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "America/Halifax",
  "America/St_Johns",
] as const;

export type ProfileTimezone = (typeof PROFILE_TIMEZONES)[number];

const CA_TIMEZONES = new Set<string>([
  "America/Toronto",
  "America/Vancouver",
  "America/Edmonton",
  "America/Winnipeg",
  "America/Halifax",
  "America/St_Johns",
]);

/**
 * When `profiles.city` has no `,CC` suffix, pick OpenWeather country from `profiles.timezone`.
 */
export function countrySuffixForOpenWeather(tz: string | null | undefined): string {
  if (!tz?.trim()) return "IN";
  if (tz === "Asia/Kolkata") return "IN";
  if (CA_TIMEZONES.has(tz)) return "CA";
  if (tz.startsWith("America/") || tz === "Pacific/Honolulu") return "US";
  return "IN";
}

/**
 * When the user has a timezone but no city, use a representative OpenWeather `q`
 * for that IANA zone (same keys as {@link PROFILE_TIMEZONES}).
 */
export const DEFAULT_WEATHER_Q_BY_TIMEZONE: Record<ProfileTimezone, string> = {
  "Asia/Kolkata": "Kolkata,IN",
  "America/New_York": "New York,US",
  "America/Detroit": "Detroit,US",
  "America/Chicago": "Chicago,US",
  "America/Denver": "Denver,US",
  "America/Phoenix": "Phoenix,US",
  "America/Los_Angeles": "Los Angeles,US",
  "America/Anchorage": "Anchorage,US",
  "Pacific/Honolulu": "Honolulu,US",
  "America/Toronto": "Toronto,CA",
  "America/Vancouver": "Vancouver,CA",
  "America/Edmonton": "Edmonton,CA",
  "America/Winnipeg": "Winnipeg,CA",
  "America/Halifax": "Halifax,CA",
  "America/St_Johns": "St. John's,CA",
};

export function defaultWeatherQueryFromProfileTimezone(
  tz: string | null | undefined,
): string | null {
  if (!tz?.trim()) return null;
  const q = DEFAULT_WEATHER_Q_BY_TIMEZONE[tz as ProfileTimezone];
  return q ?? null;
}

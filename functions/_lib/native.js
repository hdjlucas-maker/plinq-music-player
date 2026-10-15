export const NATIVE_APP_ORIGINS = new Set([
  "https://localhost",
  "capacitor://localhost",
  "http://localhost",
]);

export function isNativeAppRequest(request) {
  return NATIVE_APP_ORIGINS.has(request.headers.get("Origin") || "");
}

/** @typedef {'admin' | 'user'} DevRole */

export const DEV_ROLE_STORAGE_KEY = "dev-role";

/**
 * Huidige dev-rol. In development altijd admin (auth bypass / snelle test).
 * In productie: localStorage of default user.
 * @returns {DevRole}
 */
export function getDevRole() {
  if (typeof window === "undefined") return "user";
  const v = window.localStorage.getItem(DEV_ROLE_STORAGE_KEY);
  if (process.env.NODE_ENV === "development") {
    if (v === "admin" || v === "user") return v;
    return "admin";
  }
  return v === "admin" ? "admin" : "user";
}

/**
 * @param {DevRole} role
 */
export function setDevRole(role) {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "development") return;
  window.localStorage.setItem(
    DEV_ROLE_STORAGE_KEY,
    role === "admin" ? "admin" : "user"
  );
  window.dispatchEvent(new Event("dev-role-change"));
}

export function isDevelopment() {
  return process.env.NODE_ENV === "development";
}

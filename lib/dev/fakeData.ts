/**
 * Alleen voor server-side dev-helpers (`ensureDevTestUsers` e.d.).
 * Geen client-imports — seeden via `POST /api/dev/*` in development.
 */

export const DEV_SEED_USER_EMAILS = ["user1@test.nl", "user2@test.nl", "user3@test.nl"] as const;

/** Zelfde wachtwoord voor testaccounts (alleen `NODE_ENV === "development"`). */
export const DEV_SEED_USER_PASSWORD = "ClubInzetDev2024!";

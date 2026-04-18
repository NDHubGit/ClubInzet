/** Header: `user` = user1@test.nl, `admin` = admin@test.nl (alleen development). */
export const DEV_ROLE_HEADER = "x-clubinzet-dev-role";

/** Vaste UUID’s (ook in auth.users na bootstrap) — FK-compatibel met tasks/profiles. */
export const DEV_USER1_ID = "10000000-0000-4000-8000-000000000001";
export const DEV_ADMIN_ID = "10000000-0000-4000-8000-000000000002";

/** Stabiele referentie voor seed / ensureFixtureAuthUsers — runtime-id komt uit `profiles`. */
export const DEV_FIXTURE_USER = {
  id: DEV_USER1_ID,
  email: "user1@test.nl",
  role: "user" as const,
};

export const DEV_FIXTURE_ADMIN = {
  id: DEV_ADMIN_ID,
  email: "admin@test.nl",
  role: "admin" as const,
};

// openDemo.ts — the open demo: OrchestrAV opens straight onto the fleet cockpit, with no sign-in screen.
//
// Chase, 2026-10-02: "Remove both orchestra and pulse sign in pages or login screens. I'm not worried about logins
// currently while I am just using this for illustration purposes. Eventually, when we open it up to consumers and
// others, we will build the login and security credentials. But right now we just need for illustrative and rendering
// immediately when someone opens the application and no login barrier entry that slows down that process."
//
// So every route renders without a session, and the pages that exist only for a signed-in account (sign-in, password
// reset, profile, user admin) lead to the cockpit instead. Nothing was deleted: set VITE_REQUIRE_LOGIN=1 and the
// sign-in gate and those pages return exactly as they were. The cockpit reads the twin anonymously, as it always has;
// the open demo grants no write the anonymous key did not already have.
export const LOGIN_REQUIRED = import.meta.env.VITE_REQUIRE_LOGIN === "1";

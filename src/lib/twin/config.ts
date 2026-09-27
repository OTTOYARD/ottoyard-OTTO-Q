// OTTO-Q / OTTO-TWIN backend (Supabase project gxdrcyphqjzjsuhxuqtg, "otto-q-core").
// The anon key is public by design (the same key the twin cockpit ships, see
// ottoyarddepot-sim src/lib/ottoTwin.ts). It grants READ access to the twin's
// published feeds only.
export const OTTOQ_URL = "https://gxdrcyphqjzjsuhxuqtg.supabase.co";
export const OTTOQ_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4ZHJjeXBocWp6anN1aHh1cXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjk3MDMsImV4cCI6MjA5MDkwNTcwM30.v7erbnrlciPknvx_EpUpewXrvR9-F3D-hH-jWmTW0zI";

/** The depot the twin simulates. Every run the twin cockpit starts lands here. */
export const FLAGSHIP_DEPOT_ID = "11111111-1111-1111-1111-111111111111";

/** One poll cadence for every live panel, so the cockpits tick together. */
export const LIVE_POLL_MS = 5000;

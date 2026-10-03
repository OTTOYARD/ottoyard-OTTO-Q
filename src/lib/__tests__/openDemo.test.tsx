// openDemo.test.tsx — Chase, 2026-10-02: no sign-in screen; OrchestrAV opens straight onto the fleet cockpit. The route
// guard lets every page render without touching a session, and VITE_REQUIRE_LOGIN=1 brings the gate back as it was.
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(() => new Promise(() => {})), // never answers: the gate stays on its loader
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
  signOut: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.clearAllMocks(); });

async function guardAt(requireLogin: boolean) {
  vi.resetModules();
  vi.stubEnv("VITE_REQUIRE_LOGIN", requireLogin ? "1" : "");
  const { default: ProtectedRoute } = await import("@/components/ProtectedRoute");
  const { LOGIN_REQUIRED } = await import("@/lib/openDemo");
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<ProtectedRoute><main>THE FLEET COCKPIT</main></ProtectedRoute>} />
        <Route path="/auth" element={<p>SIGN IN</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { html, LOGIN_REQUIRED };
}

describe("the open demo", () => {
  it("renders the cockpit with no session, and never asks for one", async () => {
    const { html, LOGIN_REQUIRED } = await guardAt(false);
    expect(LOGIN_REQUIRED).toBe(false);
    expect(html).toContain("THE FLEET COCKPIT");
    expect(html).not.toContain("SIGN IN");
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("puts the sign-in gate back with VITE_REQUIRE_LOGIN=1", async () => {
    const { html, LOGIN_REQUIRED } = await guardAt(true);
    expect(LOGIN_REQUIRED).toBe(true);
    expect(html).not.toContain("THE FLEET COCKPIT");
    expect(html).toContain("Loading...");
  });
});

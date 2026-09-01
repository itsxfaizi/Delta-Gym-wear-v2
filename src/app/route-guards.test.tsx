import { render, screen } from "@testing-library/react";

import AdminLayout from "./(admin)/admin/layout";
import RootError from "./error";
import { resolveTenantPrincipal } from "@/server/authorization/principal";

// No admin page ships this pass (decision O-002), so `/admin` 404s either way
// and a browser cannot tell whether the gate ran. This file is the proof.
jest.mock("../server/authorization/principal", () => ({ resolveTenantPrincipal: jest.fn() }));

function digestOf(error: unknown): string {
  return String((error as { digest?: unknown }).digest ?? "");
}

describe("admin route group gate", () => {
  it("refuses to render the admin tree without an active membership", async () => {
    (resolveTenantPrincipal as jest.Mock).mockResolvedValue(null);

    // `notFound()` signals by throwing; a layout that returned its children
    // instead would resolve here and fail this test.
    const error = await AdminLayout({ children: "admin page" }).catch((thrown: unknown) => thrown);

    expect(digestOf(error)).toContain("404");
  });

  it("refuses to render when principal resolution fails closed", async () => {
    (resolveTenantPrincipal as jest.Mock).mockRejectedValue(new Error("session store unavailable"));

    await expect(AdminLayout({ children: "admin page" })).rejects.toThrow();
  });

  it("renders the admin surface for an active member", async () => {
    (resolveTenantPrincipal as jest.Mock).mockResolvedValue({
      userId: "22222222-2222-4222-8222-222222222222",
      tenantId: "11111111-1111-4111-8111-111111111111",
      role: "auditor",
      status: "active",
    });

    render(await AdminLayout({ children: "admin page" }));

    expect(screen.getByText("admin page")).toBeInTheDocument();
  });
});

describe("root error boundary", () => {
  it("shows no exception message, stack or query text", async () => {
    const error = Object.assign(
      new Error('select "products"."handle" from "products" where tenant_id = $1'),
      { digest: "3f2a91", stack: "at listPublishedProducts (src/features/catalog/queries.ts:170:3)" },
    );

    render(<RootError error={error} reset={() => {}} />);

    const rendered = document.body.textContent ?? "";
    expect(rendered).toContain("Something went wrong");
    expect(rendered).not.toContain("select");
    expect(rendered).not.toContain("products");
    expect(rendered).not.toContain("queries.ts");
    // The opaque digest is the one thing that may cross: it is a hash, not content.
    expect(rendered).toContain("3f2a91");
  });
});

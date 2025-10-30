import { expect, test } from "../fixtures";

const DEMO_TOKEN = "demo";
const DEMO_CONTROL_TOKEN = "demo-control-token";
const DEMO_SELECTOR = '[data-headlinetester-target="headline"]';

test.describe("/api/widget/experiments", () => {
  test("requires a control token", async ({ adaContext }) => {
    const response = await adaContext.request.post("/api/widget/experiments", {
      data: {
        token: DEMO_TOKEN,
        path: "/",
        selector: DEMO_SELECTOR,
        controlHeadline: "Original headline",
        variantHeadline: "Updated headline",
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("unauthorized:api");
  });

  test("rejects an invalid control token", async ({ adaContext }) => {
    const response = await adaContext.request.post("/api/widget/experiments", {
      data: {
        token: DEMO_TOKEN,
        path: "/",
        selector: DEMO_SELECTOR,
        controlHeadline: "Original headline",
        variantHeadline: "Updated headline",
      },
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("forbidden:api");
  });

  test("persists a draft experiment", async ({ adaContext }) => {
    const variantHeadline = `Variant headline ${Date.now()}`;
    const response = await adaContext.request.post("/api/widget/experiments", {
      data: {
        token: DEMO_TOKEN,
        path: "/",
        selector: DEMO_SELECTOR,
        controlHeadline: "Original headline",
        variantHeadline,
      },
      headers: {
        Authorization: `Bearer ${DEMO_CONTROL_TOKEN}`,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("experiment");
    expect(body.experiment).toMatchObject({
      path: "/",
      selector: DEMO_SELECTOR,
      controlHeadline: "Original headline",
      variantHeadline,
      status: "draft",
    });
    expect(typeof body.experiment.id).toBe("string");
    expect(typeof body.experiment.updatedAt).toBe("string");
  });

  test("marks experiment as paused on reset", async ({ adaContext }) => {
    const response = await adaContext.request.post("/api/widget/experiments", {
      data: {
        token: DEMO_TOKEN,
        path: "/",
        selector: DEMO_SELECTOR,
        controlHeadline: "Original headline",
        variantHeadline: null,
        action: "reset",
      },
      headers: {
        Authorization: `Bearer ${DEMO_CONTROL_TOKEN}`,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.experiment).toMatchObject({
      path: "/",
      status: "paused",
      variantHeadline: null,
    });
  });
});

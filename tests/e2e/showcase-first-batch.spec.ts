import { test, expect, devices, type Page, type Browser } from "@playwright/test";
import { loginAs } from "./d1-review-helpers";

async function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
}

async function verifyShowcasePage(page: Page, config: {
  url: string;
  title: string;
  explainLine: string;
  primaryButton: string;
}) {
  const errors = await collectPageErrors(page);
  await page.goto(config.url, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: config.title })).toBeVisible();
  await expect(page.getByText("主画布")).toBeVisible();
  await expect(page.getByRole("heading", { name: "家长一眼懂" })).toBeVisible();
  await expect(page.getByText(config.explainLine)).toBeVisible();
  await expect(page.getByRole("button", { name: config.primaryButton })).toBeVisible();
  await expect(page.getByRole("button", { name: "回到原样" })).toBeVisible();
  await expect(page.getByText("口播提示")).toBeVisible();

  await page.waitForTimeout(300);
  expect(errors, `page errors on ${config.url}: ${errors.join(" | ")}`).toHaveLength(0);
}

async function captureMobile(browser: Browser, config: {
  url: string;
  title: string;
  explainLine: string;
  primaryButton: string;
  screenshotPath: string;
}) {
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  await loginAs(page, "parent@example.com");
  await verifyShowcasePage(page, config);
  await page.screenshot({ path: config.screenshotPath, fullPage: true });
  await context.close();
}

test.describe("M1 showcase first batch acceptance", () => {
  test("function-vertex page is stable", async ({ page, browser }, testInfo) => {
    await loginAs(page, "parent@example.com");
    await verifyShowcasePage(page, {
      url: "/showcase/function-vertex",
      title: "一换顶点就乱",
      explainLine: "这周先盯两个动作：顶点在哪、口往哪开。",
      primaryButton: "看他为什么乱"
    });

    await page.screenshot({
      path: testInfo.outputPath("showcase-function-vertex-desktop.png"),
      fullPage: true
    });

    await captureMobile(browser, {
      url: "/showcase/function-vertex",
      title: "一换顶点就乱",
      explainLine: "这周先盯两个动作：顶点在哪、口往哪开。",
      primaryButton: "看他为什么乱",
      screenshotPath: testInfo.outputPath("showcase-function-vertex-mobile.png")
    });
  });

  test("geometry-helper page is stable", async ({ page, browser }, testInfo) => {
    await loginAs(page, "parent@example.com");
    await verifyShowcasePage(page, {
      url: "/showcase/geometry-helper",
      title: "不知道该画哪条线",
      explainLine: "这周先盯：先看已知和目标，再出线。",
      primaryButton: "看正确那条线"
    });

    await page.screenshot({
      path: testInfo.outputPath("showcase-geometry-helper-desktop.png"),
      fullPage: true
    });

    await captureMobile(browser, {
      url: "/showcase/geometry-helper",
      title: "不知道该画哪条线",
      explainLine: "这周先盯：先看已知和目标，再出线。",
      primaryButton: "看正确那条线",
      screenshotPath: testInfo.outputPath("showcase-geometry-helper-mobile.png")
    });
  });
});

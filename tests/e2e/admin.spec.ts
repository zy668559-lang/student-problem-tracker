import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { resetStudentMembership, resetStudentTrialAccess } from "./membership-test-helpers";

const fixturePath = path.join(process.cwd(), "tests", "fixtures", "sample-upload.png");
const logStore = new Map<string, string[]>();

test.beforeEach(async ({ page }, testInfo) => {
  const logs: string[] = [];
  logStore.set(testInfo.testId, logs);
  page.on("console", (message) => {
    logs.push(`[console:${message.type()}] ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    logs.push(`[pageerror] ${error.message}`);
  });
});

test.afterEach(async ({}, testInfo) => {
  const logs = logStore.get(testInfo.testId) ?? [];
  await fs.writeFile(testInfo.outputPath("browser.log"), logs.join("\n"), "utf8");
  logStore.delete(testInfo.testId);
});

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("demo123");
  const loginResponse = page.waitForResponse((response) => response.url().includes("/api/auth/login") && response.request().method() === "POST");
  await page.locator('button[type="submit"]').click();
  const response = await loginResponse;
  const payload = await response.json() as { ok?: boolean; message?: string };
  expect(response.ok(), payload.message ?? 'login response failed').toBeTruthy();
  expect(payload.ok, payload.message ?? 'login payload not ok').toBeTruthy();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
}

async function switchStudent(page: Page, studentId: string) {
  const waitForSwitch = page.waitForResponse((response) => response.url().includes("/api/students/switch") && response.request().method() === "POST");
  await page.locator("select").first().selectOption(studentId);
  await waitForSwitch;
}

test("admin access is protected and admin operations work with logs", async ({ page }, testInfo) => {
  test.setTimeout(480_000);
  const assetTitle = `Playwright Asset ${Date.now()}`;
  const updatedAssetTitle = `${assetTitle} Updated`;

  await login(page, "parent@example.com");
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin/);
  await expect(page).toHaveURL(/\/(login|dashboard)/, { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("01-parent-admin-blocked.png"), fullPage: true });
  if (!page.url().includes("/login")) {
    await logout(page);
  }

  await login(page, "admin@example.com");
  await resetStudentTrialAccess(page, [1, 2]);
  await resetStudentMembership(page, [1, 2]);
  await page.goto(`/admin?run=${Date.now()}`);
  await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("运营后台");
  await page.screenshot({ path: testInfo.outputPath("02-admin-home.png"), fullPage: true });

  await page.goto("/admin/whitelist");
  const whitelistForm = page.locator("form").filter({ hasText: "林可可" }).first();
  await expect(whitelistForm).toBeVisible();
  await whitelistForm.locator('input[type="checkbox"]').first().uncheck();
  await whitelistForm.locator('input[name^="total-"]').fill("2");
  await whitelistForm.getByRole("button", { name: "保存白名单设置" }).click();
  await expect(whitelistForm.locator('input[type="checkbox"]').first()).not.toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("03-whitelist-disabled.png"), fullPage: true });

  const created = await page.evaluate(async (payload) => {
    const response = await fetch("/api/admin/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await response.json();
  }, {
    subject: "math",
    module: "函数",
    tag: "function_entry_step",
    difficulty: "middle",
    assetType: "worksheet",
    title: assetTitle,
    summary: "Playwright asset summary",
    fileUrl: "/assets/playwright.pdf",
    previewUrl: "/assets/playwright.png",
    useStage: "diagnosis",
    paidOnly: false
  });
  expect(created.ok).toBeTruthy();

  const listAfterCreate = await page.evaluate(async () => {
    const response = await fetch("/api/admin/assets");
    return await response.json();
  }) as { ok: boolean; items: Array<{ id: number; title: string }> };
  const createdAsset = listAfterCreate.items.find((item) => item.title === assetTitle);
  expect(createdAsset?.id).toBeGreaterThan(0);

  await page.goto(`/admin/assets?run=${Date.now()}`);
  await expect(page.locator(`input[value="${assetTitle}"]`)).toBeVisible();

  const updated = await page.evaluate(async ({ id, title }) => {
    const response = await fetch(`/api/admin/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });
    return await response.json();
  }, { id: createdAsset!.id, title: updatedAssetTitle });
  expect(updated.ok).toBeTruthy();
  await page.goto(`/admin/assets?run=${Date.now()}`);
  await expect(page.locator(`input[value="${updatedAssetTitle}"]`)).toBeVisible();

  const removed = await page.evaluate(async (id) => {
    const response = await fetch(`/api/admin/assets/${id}`, { method: "DELETE" });
    return await response.json();
  }, createdAsset!.id);
  expect(removed.ok).toBeTruthy();
  await page.goto(`/admin/assets?run=${Date.now()}`);
  await expect(page.locator(`input[value="${updatedAssetTitle}"]`)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("04-assets-crud.png"), fullPage: true });

  await page.goto("/admin/operations");
  await expect(page.locator("main")).toContainText("管理员操作日志");
  await expect(page.locator("main")).toContainText("update_trial_access");
  await expect(page.locator("main")).toContainText("create_skill_asset");
  await expect(page.locator("main")).toContainText("delete_skill_asset");
  await page.screenshot({ path: testInfo.outputPath("05-admin-logs.png"), fullPage: true });
  await logout(page);

  await login(page, "parent@example.com");
  await switchStudent(page, "2");
  await page.goto("/upload");
  await expect(page.locator("main")).toContainText("当前孩子：林可可");
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption("math");
  await page.locator('select[name="module"]').selectOption("函数");
  await page.locator('input[name="scoreNote"]').fill("60 / 100");
  await page.locator('textarea[name="studentSelfReport"]').fill("admin permission test");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/upload$/, { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("当前孩子：林可可", { timeout: 30_000 });
  await logout(page);

  await login(page, "admin@example.com");
  await page.goto("/admin/whitelist");
  const restoreForm = page.locator("form").filter({ hasText: "林可可" }).first();
  await restoreForm.locator('input[type="checkbox"]').first().check();
  await restoreForm.locator('input[name^="total-"]').fill("50");
  await restoreForm.getByRole("button", { name: "保存白名单设置" }).click();
  await expect(restoreForm.locator('input[type="checkbox"]').first()).toBeChecked();
});
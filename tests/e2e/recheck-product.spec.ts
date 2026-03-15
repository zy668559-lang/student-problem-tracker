import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixturePath = path.join(process.cwd(), "tests", "fixtures", "sample-upload.png");
const logStore = new Map<string, string[]>();

test.beforeEach(async ({ page }, testInfo) => {
  const logs: string[] = [];
  logStore.set(testInfo.testId, logs);
  page.on("console", (message) => logs.push(`[console:${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => logs.push(`[pageerror] ${error.message}`));
  page.on("requestfailed", (request) => logs.push(`[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`));
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
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

async function resetStudentQuota(page: Page) {
  await login(page, "admin@example.com");
  const response = await page.request.patch("/api/admin/trial-access/1", {
    data: {
      whitelistEnabled: true,
      freeTrialTotal: 200,
      freeTrialUsed: 0,
      maxImagesPerUpload: 1,
      enabledGrades: ["七年级", "八年级"],
      enabledSubjects: ["math", "english"],
      trackingStatus: "trial",
      paidTrackingEnabled: false
    }
  });
  expect(response.ok()).toBeTruthy();
}

async function createDiagnosis(page: Page, tag: string) {
  await login(page, "parent@example.com");
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption("math");
  await page.locator('select[name="module"]').selectOption("函数");
  await page.locator('input[name="scoreNote"]').fill("72 / 100");
  await page.locator('input[name="note"]').fill("productized recheck flow");
  await page.locator('textarea[name="studentSelfReport"]').fill(tag);
  const uploadResponse = page.waitForResponse((response) => response.url().includes("/api/uploads") && response.request().method() === "POST");
  await page.locator('button[type="submit"]').click();
  const response = await uploadResponse;
  const payload = await response.json() as { ok: boolean; diagnosisId: number; recheckTaskId: number | null };
  expect(payload.ok).toBeTruthy();
  await expect(page).toHaveURL(/\/diagnosis\/\d+$/, { timeout: 180_000 });
  return payload;
}

test("recheck page submits separate recheck upload and shows compare entry", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const tag = `Playwright-Recheck-Page-${Date.now()}`;

  await resetStudentQuota(page);
  const first = await createDiagnosis(page, tag);
  expect(first.recheckTaskId).toBeTruthy();

  await expect(page.locator("main")).toContainText("进入复检任务页", { timeout: 30_000 });
  await page.getByRole("link", { name: "进入复检任务页" }).click();
  await expect(page).toHaveURL(new RegExp(`/recheck/${first.recheckTaskId}$`), { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("上次问题摘要");
  await expect(page.locator("main")).toContainText("结果对比入口");
  await page.screenshot({ path: testInfo.outputPath("01-recheck-task-page.png"), fullPage: true });

  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('input[name="scoreNote"]').fill("95 / 100");
  await page.locator('textarea[name="studentSelfReport"]').fill(`${tag} 这次比上次顺多了`);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/diagnosis\/\d+$/, { timeout: 180_000 });
  await expect(page.locator("main")).toContainText("复检结果", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("进入复检任务页", { timeout: 30_000 });
});

test("manual recheck correction writes back priority and weekly report", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const tag = `Playwright-Recheck-Manual-${Date.now()}`;

  await resetStudentQuota(page);
  const first = await createDiagnosis(page, tag);
  expect(first.recheckTaskId).toBeTruthy();

  await login(page, "admin@example.com");
  await page.goto("/admin/recheck-tasks");
  const taskCard = page.locator(`[data-testid="recheck-task-${first.recheckTaskId}"]`);
  await expect(taskCard).toBeVisible({ timeout: 30_000 });
  await taskCard.locator(`select[name="decision-${first.recheckTaskId}"]`).selectOption("bombing");
  await taskCard.locator(`input[name="priority-${first.recheckTaskId}"]`).fill("下轮先继续轰炸这条，不要换线。");
  await taskCard.locator(`textarea[name="reason-${first.recheckTaskId}"]`).fill("老师判断这块还没站住，同类题再压一轮更稳。");
  await taskCard.getByRole("button", { name: "保存人工纠偏" }).click();
  await expect(taskCard).toContainText("上次人工处理", { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("02-admin-recheck-manual.png"), fullPage: true });

  await login(page, "parent@example.com");
  await page.goto("/dashboard");
  await expect(page.locator("main")).toContainText("下轮先继续轰炸这条，不要换线。", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText(/复检状态|继续轰炸/, { timeout: 30_000 });

  const weeklyHref = await page.locator('a[href^="/weekly-report/"]').last().getAttribute("href");
  expect(weeklyHref).toBeTruthy();
  await page.goto(weeklyHref!);
  await expect(page.locator("main")).toContainText("是否建议继续追踪", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("下轮先继续轰炸这条，不要换线。", { timeout: 30_000 });
});

test("weekly batch and tracking intent are visible in admin operations", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const tag = `Playwright-Intent-${Date.now()}`;

  await resetStudentQuota(page);
  const first = await createDiagnosis(page, tag);
  expect(first.recheckTaskId).toBeTruthy();

  await page.getByRole("link", { name: "继续追踪" }).click();
  await expect(page).toHaveURL(new RegExp(`/recheck/${first.recheckTaskId}$`), { timeout: 30_000 });
  await page.goto(`/diagnosis/${first.diagnosisId}`);
  await page.locator('textarea').last().fill("这周想继续看 4 周变化，先别让这条又掉回去。");
  await page.getByRole("button", { name: "提交开通意向" }).click();
  await expect(page.locator("main")).toContainText("我先把这条继续追踪意向记下来了", { timeout: 30_000 });

  await login(page, "admin@example.com");
  await page.goto("/admin/operations");
  await expect(page.locator("main")).toContainText("立即跑本周周报批处理", { timeout: 30_000 });
  await page.getByRole("button", { name: "立即跑本周周报批处理" }).click();
  await expect(page.locator("main")).toContainText("谁提交了开通意向", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("这周想继续看 4 周变化", { timeout: 30_000 });
  await page.getByRole("button", { name: "标记已开通" }).first().click();
  await expect(page.locator("main")).toContainText("谁已开通", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("当前状态：active", { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("03-operations-growth.png"), fullPage: true });
});

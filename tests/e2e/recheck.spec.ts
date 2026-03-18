import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { resetStudentTrialAccess, setStudentMembership } from "./membership-test-helpers";
import { finalizeDraftByAdmin, restoreParentContext } from "./d1-review-helpers";

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

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

async function loginParent(page: Page) {
  await login(page, "parent@example.com", "demo123");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

async function loginAdmin(page: Page) {
  await login(page, "admin@example.com", "demo123");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

async function resetTrialQuota(page: Page) {
  await loginAdmin(page);
  await resetStudentTrialAccess(page, [1]);
  await setStudentMembership(page, 1, "self_service", { reason: "e2e recheck self service" });
}

async function uploadDiagnosis(page: Page, studentId: number, input: { tag: string; scoreNote: string; note: string }) {
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption("math");
  await page.locator('select[name="module"]').selectOption("函数");
  await page.locator('input[name="scoreNote"]').fill(input.scoreNote);
  await page.locator('input[name="note"]').fill(input.note);
  await page.locator('textarea[name="studentSelfReport"]').fill(input.tag);
  const uploadResponse = page.waitForResponse((response) => response.url().includes("/api/uploads") && response.request().method() === "POST");
  await page.locator('button[type="submit"]').click();
  const response = await uploadResponse;
  const payload = await response.json() as { ok: boolean; draftId: number };
  expect(payload.ok).toBeTruthy();
  await expect(page).toHaveURL(/\/review-draft\/\d+$/, { timeout: 180_000 });
  const draftId = Number(page.url().match(/\/review-draft\/(\d+)$/)?.[1] ?? payload.draftId);
  const finalized = await finalizeDraftByAdmin(page, draftId);
  await restoreParentContext(page, studentId);
  await page.goto(`/diagnosis/${finalized.officialDiagnosisId}`);
  await expect(page.locator("main")).toContainText("复检状态", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("下轮优先级", { timeout: 30_000 });
  const diagnosisId = Number(page.url().match(/\/diagnosis\/(\d+)$/)?.[1] ?? finalized.officialDiagnosisId ?? 0);
  const weeklyHref = await page.locator('a[href^="/weekly-report/"]').first().getAttribute("href");
  const weeklyReportId = Number(weeklyHref?.match(/\/weekly-report\/(\d+)$/)?.[1] ?? finalized.officialWeeklyReportId ?? 0);
  return { diagnosisId, weeklyReportId, recheckTaskId: finalized.recheckTaskId ?? null };
}

test("recheck task is created automatically and repeat counters accumulate correctly", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const tag = `Playwright-Recheck-${testInfo.parallelIndex}-${Date.now()}`;

  await resetTrialQuota(page);
  await loginParent(page);
  const first = await uploadDiagnosis(page, 1, { tag, scoreNote: "68 / 100", note: "第一次诊断" });
  await expect(page.locator("main")).toContainText("继续追踪理由");
  expect(first.recheckTaskId).toBeTruthy();

  await loginAdmin(page);
  let response = await page.request.get("/api/admin/recheck-tasks");
  expect(response.ok()).toBeTruthy();
  let payload = await response.json() as { ok: boolean; items: Array<{ id: number; diagnosisId: number | null; tag: string; repeatCount7d: number; repeatCount30d: number }> };
  const beforeTask = payload.items.find((item) => item.id === first.recheckTaskId);
  expect(beforeTask).toBeTruthy();

  await loginParent(page);
  const second = await uploadDiagnosis(page, 1, { tag, scoreNote: "72 / 100", note: "第二次还是同类题" });
  expect(second.recheckTaskId).toBe(first.recheckTaskId);

  await loginAdmin(page);
  response = await page.request.get("/api/admin/recheck-tasks");
  expect(response.ok()).toBeTruthy();
  payload = await response.json() as { ok: boolean; items: Array<{ id: number; diagnosisId: number | null; tag: string; repeatCount7d: number; repeatCount30d: number }> };
  const task = payload.items.find((item) => item.id === first.recheckTaskId);
  expect(task).toBeTruthy();
  expect(task!.repeatCount7d).toBe((beforeTask?.repeatCount7d ?? 0) + 1);
  expect(task!.repeatCount30d).toBe((beforeTask?.repeatCount30d ?? 0) + 1);

  await page.goto("/admin/recheck-tasks");
  await expect(page.locator("main")).toContainText("复检任务台");
  await page.screenshot({ path: testInfo.outputPath("01-recheck-created.png"), fullPage: true });
});

test("recheck completion writes back memory, weekly report and change logs", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const tag = `Playwright-Recheck-Writeback-${testInfo.parallelIndex}-${Date.now()}`;

  await resetTrialQuota(page);
  await loginParent(page);
  const first = await uploadDiagnosis(page, 1, { tag, scoreNote: "64 / 100", note: "先挂复检" });
  await uploadDiagnosis(page, 1, { tag, scoreNote: "95 / 100", note: "复检通过，今天这一类题基本过了" });

  await expect(page.locator("main")).toContainText(/有进步.*还没稳/, { timeout: 30_000 });
  await page.goto(`/weekly-report/${first.weeklyReportId}`);
  await expect(page.locator("main")).toContainText("复检状态", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText(/有进步.*还没稳/, { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("今天先做", { timeout: 30_000 });

  await page.goto("/dashboard");
  await expect(page.locator("main")).toContainText("复检状态", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText(/有进步.*还没稳/, { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("02-recheck-writeback.png"), fullPage: true });
});

test("recheck stabilization requires two passed attempts and shows 已稳住", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const tag = `Playwright-Stable-${testInfo.parallelIndex}-${Date.now()}`;

  await resetTrialQuota(page);
  await loginParent(page);
  await uploadDiagnosis(page, 1, { tag, scoreNote: "61 / 100", note: "先建立复检任务" });
  await uploadDiagnosis(page, 1, { tag, scoreNote: "94 / 100", note: "复检通过一次" });
  const last = await uploadDiagnosis(page, 1, { tag, scoreNote: "96 / 100", note: "复检通过第二次，已经稳住" });

  await expect(page.locator("main")).toContainText("已稳住", { timeout: 30_000 });
  await page.goto(`/weekly-report/${last.weeklyReportId}`);
  await expect(page.locator("main")).toContainText("已稳住", { timeout: 30_000 });

  await page.goto("/dashboard");
  await expect(page.locator("main")).toContainText("已稳住", { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("03-recheck-stabilized.png"), fullPage: true });
});

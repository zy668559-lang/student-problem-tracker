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

function followupLeadCard(page: Page, sourceRefId: number) {
  return page.locator('[data-testid^="followup-lead-"]').filter({
    has: page.locator(`text=/source_ref_id\\s+${sourceRefId}(?!\\d)/`)
  }).first();
}

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
      enabledGrades: [],
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
  await page.locator('select[name="module"]').selectOption({ index: 0 });
  await page.locator('input[name="scoreNote"]').fill("72 / 100");
  await page.locator('input[name="note"]').fill("a4 evidence layer flow");
  await page.locator('textarea[name="studentSelfReport"]').fill(tag);
  const uploadResponse = page.waitForResponse((response) => response.url().includes("/api/uploads") && response.request().method() === "POST");
  await page.locator('button[type="submit"]').click();
  const response = await uploadResponse;
  const payload = await response.json() as { ok: boolean; diagnosisId: number; recheckTaskId: number | null };
  expect(payload.ok).toBeTruthy();
  await expect(page).toHaveURL(/\/diagnosis\/\d+$/, { timeout: 180_000 });
  return payload;
}

test("recheck upload lands on dedicated compare page with parent-friendly summary", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const tag = `Playwright-Compare-${Date.now()}`;

  await resetStudentQuota(page);
  const first = await createDiagnosis(page, tag);
  expect(first.recheckTaskId).toBeTruthy();

  await page.getByRole("link", { name: "进入复检任务页" }).click();
  await expect(page).toHaveURL(new RegExp(`/recheck/${first.recheckTaskId}$`), { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("上次问题摘要");

  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('input[name="scoreNote"]').fill("95 / 100");
  await page.locator('textarea[name="studentSelfReport"]').fill(`${tag} 这轮我按老师说的再做一遍`);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/diagnosis\/\d+$/, { timeout: 180_000 });
  await page.getByRole("link", { name: "看结果对比页" }).click();
  await expect(page).toHaveURL(new RegExp(`/compare/${first.recheckTaskId}$`), { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("上次主要问题");
  await expect(page.locator("main")).toContainText("本次复检结果");
  await expect(page.locator("main")).toContainText("下轮优先级");
  await expect(page.locator("main")).toContainText("建议继续追踪理由");
  await expect(page.locator("main")).toContainText("继续追踪 4 周");
  await page.screenshot({ path: testInfo.outputPath("01-compare-page.png"), fullPage: true });
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
  await taskCard.locator(`input[name="priority-${first.recheckTaskId}"]`).fill("下轮先继续轰炸这个高频错因，先别换线。");
  await taskCard.locator(`textarea[name="reason-${first.recheckTaskId}"]`).fill("这块最近重复回来得太勤，现在最怕的是看着懂了，过几天又掉回去。先别松手。");
  await taskCard.getByRole("button", { name: "保存人工纠偏" }).click();
  await expect(taskCard.locator(`input[name="priority-${first.recheckTaskId}"]`)).toHaveValue("下轮先继续轰炸这个高频错因，先别换线。", { timeout: 30_000 });
  await expect(taskCard.locator(`textarea[name="reason-${first.recheckTaskId}"]`)).toHaveValue(/这块最近重复回来得太勤/, { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("02-admin-recheck-manual.png"), fullPage: true });

  await login(page, "parent@example.com");
  await page.goto("/dashboard");
  await expect(page.locator("main")).toContainText(/下轮先继续轰炸这个高频错因/ , { timeout: 30_000 });

  const weeklyHref = await page.locator('a[href^="/weekly-report/"]').last().getAttribute("href");
  expect(weeklyHref).toBeTruthy();
  await page.goto(weeklyHref!);
  await expect(page.locator("main")).toContainText("下周优先项", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("下轮先继续轰炸这个高频错因，先别换线。", { timeout: 30_000 });
});

test("weekly scheduler and follow-up funnel are visible and editable in admin", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const tag = `Playwright-Followup-${Date.now()}`;
  const followupNote = `家长这周先看变化，${Date.now()}`;

  await resetStudentQuota(page);
  const first = await createDiagnosis(page, tag);
  expect(first.recheckTaskId).toBeTruthy();

  const intentResponse = page.waitForResponse((response) => response.url().includes("/api/tracking-intents") && response.request().method() === "POST");
  await page.locator('textarea').last().fill("如果这条还不稳，我想继续追踪 4 周，别让它回弹。");
  await page.getByRole("button", { name: "提交开通意向" }).click();
  const intentPayload = await (await intentResponse).json() as { ok: boolean; id: number };
  expect(intentPayload.ok).toBeTruthy();
  await expect(page.locator("main")).toContainText("我先把这条继续追踪意向记下来了", { timeout: 30_000 });

  await login(page, "admin@example.com");
  await page.goto("/admin/operations");
  await expect(page.locator("main")).toContainText("周报调度状态", { timeout: 30_000 });
  await expect(page.locator('[data-testid^="weekly-batch-run-"]').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "手动重跑本周周报" }).click();
  await expect(page.locator("main")).toContainText(/上次状态：成功|上次状态：正在跑/, { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("03-operations-scheduler.png"), fullPage: true });

  await page.goto("/admin/followups");
  const card = followupLeadCard(page, intentPayload.id);
  await expect(card).toContainText("source_type tracking_intent", { timeout: 30_000 });
  await card.locator('select[name^="followup-status-"]').selectOption("contacted");
  await card.locator('select[name^="followup-action-"]').selectOption("wechat_contacted");
  await card.locator('textarea[name^="followup-note-"]').fill(followupNote);
  await card.getByRole("button", { name: "保存这条跟进" }).click();
  await expect(card).toContainText("当前状态：已联系", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText(followupNote, { timeout: 30_000 });
  await card.locator('select[name^="followup-status-"]').selectOption("activated");
  await card.locator('select[name^="followup-action-"]').selectOption("activated");
  await card.getByRole("button", { name: "保存这条跟进" }).click();
  await expect(card).toContainText("当前状态：已开通", { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("04-followup-funnel.png"), fullPage: true });
});

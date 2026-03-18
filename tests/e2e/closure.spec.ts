import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { finalizeDraftByAdmin } from "./d1-review-helpers";
import { resetStudentMembership, resetStudentTrialAccess, setStudentMembership } from "./membership-test-helpers";

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
  page.on("requestfailed", (request) => {
    logs.push(`[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
});

test.afterEach(async ({}, testInfo) => {
  const logs = logStore.get(testInfo.testId) ?? [];
  await fs.writeFile(testInfo.outputPath("browser.log"), logs.join("\n"), "utf8");
  logStore.delete(testInfo.testId);
});

async function safeScreenshot(page: Page, pathName: string) {
  try {
    await page.screenshot({ path: pathName, fullPage: true });
  } catch {
    await page.screenshot({ path: pathName });
  }
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  if (await page.locator('input[name="email"]').count() === 0) {
    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
  }
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("demo123");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

async function loginParent(page: Page, testInfo?: TestInfo) {
  await login(page, "parent@example.com");
  await expect(page.locator('a[href="/upload"]').first()).toBeVisible();
  if (testInfo) {
    await safeScreenshot(page, testInfo.outputPath("02-dashboard-page.png"));
  }
}

async function prepareSelfService(page: Page) {
  await page.context().clearCookies();
  await login(page, "admin@example.com");
  await resetStudentTrialAccess(page, [1]);
  await resetStudentMembership(page, [1]);
  await setStudentMembership(page, 1, "self_service", { reason: "e2e closure self service" });
}

async function uploadAndOpenDraft(page: Page, testInfo: TestInfo, reportLabel: string) {
  await page.goto("/upload");
  await expect(page.locator('input[type="file"]')).toBeVisible();
  await safeScreenshot(page, testInfo.outputPath(`03-upload-page-${reportLabel}.png`));

  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption("math");
  await page.locator('select[name="module"]').selectOption("函数");
  await page.locator('input[name="scoreNote"]').fill("76 / 100");
  await page.locator('select[name="uploadType"]').selectOption("题图");
  await page.locator('input[name="note"]').fill(`Playwright acceptance ${reportLabel}`);
  await page.locator('textarea[name="studentSelfReport"]').fill("Playwright local closure validation for diagnosis flow.");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/review-draft\/\d+$/, { timeout: 180_000 });
  await expect(page.locator("main")).toContainText("这次上传已经收到了", { timeout: 30_000 });
  await safeScreenshot(page, testInfo.outputPath(`04-review-draft-page-${reportLabel}.png`));

  const draftId = Number(page.url().match(/\/review-draft\/(\d+)$/)?.[1]);
  expect(draftId).toBeGreaterThan(0);
  return { draftId };
}

function reviewCard(page: Page, draftId: number) {
  return page.locator("article").filter({ has: page.locator(`a[href="/review-draft/${draftId}"]`) }).first();
}

test("full closure: login -> upload draft -> review edit -> approve -> official diagnosis -> weekly report", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await prepareSelfService(page);
  await loginParent(page, testInfo);
  const { draftId } = await uploadAndOpenDraft(page, testInfo, "approve-flow");

  await login(page, "admin@example.com");
  await page.goto("/review-queue");
  const card = reviewCard(page, draftId);
  await expect(card).toBeVisible();
  await safeScreenshot(page, testInfo.outputPath("06-review-queue-before-edit.png"));

  const editedPayload = {
    current_stage: "Playwright review-edited stage",
    subject: "math",
    module: "函数",
    problem_tags: ["审题遗漏条件", "图像变化判断不稳"],
    repair_actions: ["Playwright Repair Action A", "Playwright Repair Action B"],
    parent_summary: "Playwright updated parent summary.",
    confidence: 0.92,
    review_status: "pending"
  };

  await card.locator("textarea").first().fill(JSON.stringify(editedPayload, null, 2));
  const editResponse = page.waitForResponse((response) => response.url().includes(`/api/review/${draftId}`) && response.request().method() === "PATCH");
  await card.getByRole("button", { name: "修改草稿" }).click();
  await editResponse;
  await expect(reviewCard(page, draftId).locator("textarea").first()).toContainText("Playwright Repair Action A");

  const approveResponsePromise = page.waitForResponse((response) => response.url().includes(`/api/review/${draftId}`) && response.request().method() === "PATCH");
  await reviewCard(page, draftId).getByRole("button", { name: "通过并正式入库" }).click();
  const approveResponse = await approveResponsePromise;
  const approvePayload = await approveResponse.json() as { ok: boolean; officialDiagnosisId?: number | null; officialWeeklyReportId?: number | null };
  expect(approvePayload.ok).toBeTruthy();
  const diagnosisId = Number(approvePayload.officialDiagnosisId ?? 0);
  expect(diagnosisId).toBeGreaterThan(0);
  await safeScreenshot(page, testInfo.outputPath("07-review-queue-approved.png"));

  await loginParent(page);
  await page.goto(`/diagnosis/${diagnosisId}`);
  await expect(page.locator("main")).toContainText("已通过");
  await expect(page.locator("main")).toContainText("Playwright Repair Action A");
  await expect(page.locator("main")).toContainText("家长这周先这么看：Playwright updated parent summary.");

  const weeklyReportId = Number(approvePayload.officialWeeklyReportId ?? (await page.locator('a[href^="/weekly-report/"]').first().getAttribute("href"))?.match(/\/weekly-report\/(\d+)$/)?.[1] ?? 0);
  expect(weeklyReportId).toBeGreaterThan(0);
  await page.goto(`/weekly-report/${weeklyReportId}`);
  await expect(page.locator("main")).toContainText("接下来先做");
  await expect(page.locator("main")).toContainText("已经稳住的地方");
  await expect(page.locator("main")).toContainText("函数");
  await safeScreenshot(page, testInfo.outputPath("08-weekly-report-page-approve-flow.png"));
});

test("review queue can reject a generated draft diagnosis", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await prepareSelfService(page);
  await loginParent(page, testInfo);
  const { draftId } = await uploadAndOpenDraft(page, testInfo, "reject-flow");

  await finalizeDraftByAdmin(page, draftId, "reject");
  await loginParent(page);
  await page.goto(`/review-draft/${draftId}`);
  await expect(page.locator("main")).toContainText("已驳回");
  await expect(page.locator("main")).toContainText("这条草稿这次先没入库");
  await safeScreenshot(page, testInfo.outputPath("09-review-draft-rejected.png"));
});

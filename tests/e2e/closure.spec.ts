import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
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

async function login(page: Page, testInfo: TestInfo) {
  await page.goto("/login");
  if (await page.locator('input[name="email"]').count() === 0) {
    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
  }
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await safeScreenshot(page, testInfo.outputPath("01-login-page.png"));

  await page.locator('input[name="email"]').fill("parent@example.com");
  await page.locator('input[name="password"]').fill("demo123");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await expect(page.locator('a[href="/upload"]').first()).toBeVisible();
  await expect(page.locator("main")).toContainText("学生记忆摘要");
  await safeScreenshot(page, testInfo.outputPath("02-dashboard-page.png"));
}

async function prepareSelfService(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="email"]').fill("admin@example.com");
  await page.locator('input[name="password"]').fill("demo123");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await resetStudentTrialAccess(page, [1]);
  await resetStudentMembership(page, [1]);
  await setStudentMembership(page, 1, "self_service", { reason: "e2e closure self service" });
}

async function uploadAndOpenDiagnosis(page: Page, testInfo: TestInfo, reportLabel: string) {
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

  await expect(page).toHaveURL(/\/diagnosis\/\d+$/, { timeout: 180_000 });
  await expect(page.locator("pre").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("main")).toContainText("家长这周先这么看", { timeout: 30_000 });
  await safeScreenshot(page, testInfo.outputPath(`04-diagnosis-page-${reportLabel}.png`));

  const diagnosisId = Number(page.url().match(/\/diagnosis\/(\d+)$/)?.[1]);
  expect(diagnosisId).toBeGreaterThan(0);

  const weeklyHref = await page.locator('a[href^="/weekly-report/"]').first().getAttribute("href");
  expect(weeklyHref).toMatch(/\/weekly-report\/\d+$/);
  const weeklyReportId = Number(weeklyHref?.match(/\/weekly-report\/(\d+)$/)?.[1]);
  expect(weeklyReportId).toBeGreaterThan(0);

  await page.locator('a[href^="/weekly-report/"]').first().click();
  await expect(page).toHaveURL(/\/weekly-report\/\d+$/, { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("反复冒出来的错因", { timeout: 30_000 });
  await safeScreenshot(page, testInfo.outputPath(`05-weekly-report-page-${reportLabel}.png`));

  return { diagnosisId, weeklyReportId };
}

function reviewCard(page: Page, diagnosisId: number) {
  return page.locator("article").filter({ has: page.locator(`a[href="/diagnosis/${diagnosisId}"]`) }).first();
}

test("full closure: login -> upload -> diagnosis -> weekly report -> review edit -> approve", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await prepareSelfService(page);
  await login(page, testInfo);
  const { diagnosisId, weeklyReportId } = await uploadAndOpenDiagnosis(page, testInfo, "approve-flow");

  await page.goto("/review-queue");
  const card = reviewCard(page, diagnosisId);
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
  await card.locator("button").nth(1).click();
  await expect(reviewCard(page, diagnosisId).locator("textarea").first()).toContainText("Playwright Repair Action A");

  await reviewCard(page, diagnosisId).locator("button").nth(0).click();
  await safeScreenshot(page, testInfo.outputPath("07-review-queue-approved.png"));

  await page.goto(`/diagnosis/${diagnosisId}`);
  await expect(page.locator("main")).toContainText("已通过");
  await expect(page.locator("main")).toContainText("Playwright Repair Action A");
  await expect(page.locator("main")).toContainText("家长这周先这么看：Playwright updated parent summary.");

  await page.goto(`/weekly-report/${weeklyReportId}`);
  await expect(page.locator("main")).toContainText("接下来先做");
  await expect(page.locator("main")).toContainText("已经稳住的地方");
  await expect(page.locator("main")).toContainText("函数");
});

test("review queue can reject a generated diagnosis", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await prepareSelfService(page);
  await login(page, testInfo);
  const { diagnosisId } = await uploadAndOpenDiagnosis(page, testInfo, "reject-flow");

  await page.goto("/review-queue");
  const card = reviewCard(page, diagnosisId);
  await expect(card).toBeVisible();

  await card.locator("button").nth(2).click();
  await safeScreenshot(page, testInfo.outputPath("08-review-queue-rejected.png"));

  await page.goto(`/diagnosis/${diagnosisId}`);
  await expect(page.locator("main")).toContainText("已驳回");
});

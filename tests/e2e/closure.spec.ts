import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

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

async function login(page: Page, testInfo: TestInfo) {
  await page.goto("/login");
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("01-login-page.png"), fullPage: true });

  await page.locator('input[name="email"]').fill("parent@example.com");
  await page.locator('input[name="password"]').fill("demo123");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('a[href="/upload"]').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("02-dashboard-page.png"), fullPage: true });
}

async function uploadAndOpenDiagnosis(page: Page, testInfo: TestInfo, reportLabel: string) {
  await page.goto("/upload");
  await expect(page.locator('input[type="file"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`03-upload-page-${reportLabel}.png`), fullPage: true });

  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption("math");
  await page.locator('select[name="module"]').selectOption({ label: "函数" });
  await page.locator('input[name="scoreNote"]').fill("76 / 100");
  await page.locator('select[name="uploadType"]').selectOption({ label: "题图" });
  await page.locator('input[name="note"]').fill(`Playwright acceptance ${reportLabel}`);
  await page.locator('textarea[name="studentSelfReport"]').fill("Playwright local closure validation for diagnosis flow.");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/diagnosis\/\d+$/);
  await expect(page.locator("pre")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`04-diagnosis-page-${reportLabel}.png`), fullPage: true });

  const diagnosisId = Number(page.url().match(/\/diagnosis\/(\d+)$/)?.[1]);
  expect(diagnosisId).toBeGreaterThan(0);

  const weeklyHref = await page.locator('a[href^="/weekly-report/"]').first().getAttribute("href");
  expect(weeklyHref).toMatch(/\/weekly-report\/\d+$/);
  const weeklyReportId = Number(weeklyHref?.match(/\/weekly-report\/(\d+)$/)?.[1]);
  expect(weeklyReportId).toBeGreaterThan(0);

  await page.locator('a[href^="/weekly-report/"]').first().click();
  await expect(page).toHaveURL(/\/weekly-report\/\d+$/);
  await expect(page.locator("main")).toContainText("this_week_problem");
  await page.screenshot({ path: testInfo.outputPath(`05-weekly-report-page-${reportLabel}.png`), fullPage: true });

  return { diagnosisId, weeklyReportId };
}

function reviewCard(page: Page, diagnosisId: number) {
  return page.locator("article").filter({
    has: page.locator(`a[href="/diagnosis/${diagnosisId}"]`)
  }).first();
}

test("full closure: login -> upload -> diagnosis -> weekly report -> review edit -> approve", async ({ page }, testInfo) => {
  await login(page, testInfo);
  const { diagnosisId, weeklyReportId } = await uploadAndOpenDiagnosis(page, testInfo, "approve-flow");

  await page.goto("/review-queue");
  const card = reviewCard(page, diagnosisId);
  await expect(card).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("06-review-queue-before-edit.png"), fullPage: true });

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

  await card.locator("textarea").fill(JSON.stringify(editedPayload, null, 2));
  await card.locator("button").nth(1).click();
  await expect(reviewCard(page, diagnosisId).locator("textarea")).toContainText("Playwright Repair Action A");

  await reviewCard(page, diagnosisId).locator("button").nth(0).click();
  await page.screenshot({ path: testInfo.outputPath("07-review-queue-approved.png"), fullPage: true });

  await page.goto(`/diagnosis/${diagnosisId}`);
  await expect(page.locator("pre")).toContainText('"review_status": "approved"');
  await expect(page.locator("main")).toContainText("Playwright Repair Action A");
  await expect(page.locator("main")).toContainText("Playwright updated parent summary.");

  await page.goto(`/weekly-report/${weeklyReportId}`);
  await expect(page.locator("main")).toContainText("Playwright Repair Action A");
});

test("review queue can reject a generated diagnosis", async ({ page }, testInfo) => {
  await login(page, testInfo);
  const { diagnosisId } = await uploadAndOpenDiagnosis(page, testInfo, "reject-flow");

  await page.goto("/review-queue");
  const card = reviewCard(page, diagnosisId);
  await expect(card).toBeVisible();

  await card.locator("button").nth(2).click();
  await page.screenshot({ path: testInfo.outputPath("08-review-queue-rejected.png"), fullPage: true });

  await page.goto(`/diagnosis/${diagnosisId}`);
  await expect(page.locator("pre")).toContainText('"review_status": "rejected"');
});
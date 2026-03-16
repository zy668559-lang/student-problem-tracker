import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { resetStudentMembership, resetStudentTrialAccess, setStudentMembership } from "./membership-test-helpers";

const fixturePath = path.join(process.cwd(), "tests", "fixtures", "sample-upload.png");
const logStore = new Map<string, string[]>();

test.beforeEach(async ({ page }, testInfo) => {
  const logs: string[] = [];
  logStore.set(testInfo.testId, logs);
  page.on("console", (message) => logs.push(`[console:${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => logs.push(`[pageerror] ${error.message}`));
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

async function resetStudentAccess(page: Page) {
  await login(page, "admin@example.com");
  await resetStudentTrialAccess(page, [1, 2]);
  await resetStudentMembership(page, [1, 2]);
  await setStudentMembership(page, 1, "self_service", { reason: "e2e timeline student 1" });
  await setStudentMembership(page, 2, "self_service", { reason: "e2e timeline student 2" });
}

async function switchStudent(page: Page, studentId: string, expectedName: string) {
  const waitForSwitch = page.waitForResponse((response) => response.url().includes("/api/students/switch") && response.request().method() === "POST");
  await page.locator("select").first().selectOption(studentId);
  await waitForSwitch;
  await page.goto("/timeline");
  await expect(page.locator("main")).toContainText(`${expectedName} 的证据时间轴`, { timeout: 30_000 });
}

async function uploadForCurrentStudent(page: Page, studentLabel: string, module = "函数") {
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption(module === "阅读定位" ? "english" : "math");
  await page.locator('select[name="module"]').selectOption(module);
  await page.locator('input[name="scoreNote"]').fill(module === "阅读定位" ? "82 / 100" : "74 / 100");
  await page.locator('input[name="note"]').fill(`timeline ${studentLabel}`);
  await page.locator('textarea[name="studentSelfReport"]').fill(`timeline-${studentLabel}`);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/diagnosis\/\d+$/, { timeout: 180_000 });
  const diagnosisId = Number(page.url().match(/\/diagnosis\/(\d+)$/)?.[1]);
  const weeklyHref = await page.locator('a[href^="/weekly-report/"]').last().getAttribute("href");
  const weeklyReportId = Number(weeklyHref?.match(/\/weekly-report\/(\d+)$/)?.[1]);
  expect(diagnosisId).toBeGreaterThan(0);
  expect(weeklyReportId).toBeGreaterThan(0);
  return { diagnosisId, weeklyReportId };
}

test("timeline page shows parent-friendly evidence nodes for current student", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await login(page, "parent@example.com");
  await switchStudent(page, "1", "林同学");
  const created = await uploadForCurrentStudent(page, `A-${Date.now()}`);

  await page.goto("/timeline");
  await expect(page.locator("main")).toContainText("上次主要问题", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("本次主要变化", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("已稳住", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("还没稳住", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("继续追踪 4 周", { timeout: 30_000 });
  await expect(page.locator('[data-testid^="timeline-node-"]').first()).toContainText("当时卡点");
  await expect(page.locator(`a[href="/diagnosis/${created.diagnosisId}"]`).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("01-timeline-page.png"), fullPage: true });
});

test("timeline page stays isolated after switching between two students", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await login(page, "parent@example.com");

  await switchStudent(page, "1", "林同学");
  const a = await uploadForCurrentStudent(page, `student-a-${Date.now()}`);

  await switchStudent(page, "2", "林可可");
  const b = await uploadForCurrentStudent(page, `student-b-${Date.now()}`, "阅读定位");

  await switchStudent(page, "1", "林同学");
  await expect(page.locator(`a[href="/diagnosis/${a.diagnosisId}"]`).first()).toBeVisible();
  await expect(page.locator(`a[href="/diagnosis/${b.diagnosisId}"]`)).toHaveCount(0);
  await expect(page.locator(`a[href="/weekly-report/${a.weeklyReportId}"]`).first()).toBeVisible();
  await expect(page.locator(`a[href="/weekly-report/${b.weeklyReportId}"]`)).toHaveCount(0);

  await switchStudent(page, "2", "林可可");
  await expect(page.locator(`a[href="/diagnosis/${b.diagnosisId}"]`).first()).toBeVisible();
  await expect(page.locator(`a[href="/diagnosis/${a.diagnosisId}"]`)).toHaveCount(0);
  await expect(page.locator(`a[href="/weekly-report/${b.weeklyReportId}"]`).first()).toBeVisible();
  await expect(page.locator(`a[href="/weekly-report/${a.weeklyReportId}"]`)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("02-timeline-isolation.png"), fullPage: true });
});

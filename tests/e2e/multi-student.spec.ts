import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { resetStudentMembership, resetStudentTrialAccess, setStudentMembership } from "./membership-test-helpers";
import { finalizeDraftByAdmin, restoreParentContext } from "./d1-review-helpers";

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
  await page.goto("/login");
  if (await page.locator('input[name="email"]').count() === 0) {
    await page.getByRole("button", { name: "退出登录" }).click();
    await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
  }

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("demo123");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

async function loginParent(page: Page) {
  await login(page, "parent@example.com");
}

async function switchStudent(page: Page, studentId: string, expectedName: string) {
  const waitForSwitch = page.waitForResponse((response) => response.url().includes("/api/students/switch") && response.request().method() === "POST");
  await page.locator("select").first().selectOption(studentId);
  await waitForSwitch;
  await page.goto("/dashboard");
  await expect(page.locator("main")).toContainText(`${expectedName} 的本周问题看板`, { timeout: 30_000 });
}

async function uploadForCurrentStudent(page: Page, studentId: number, module: string, reportLabel: string, expectedName: string) {
  await page.goto("/upload");
  await expect(page.locator("main")).toContainText(`当前孩子：${expectedName}`);
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption(module === "阅读定位" ? "english" : "math");
  await page.locator('select[name="module"]').selectOption(module);
  await page.locator('input[name="scoreNote"]').fill(reportLabel.includes("B") ? "84 / 100" : "76 / 100");
  await page.locator('select[name="uploadType"]').selectOption("题图");
  await page.locator('input[name="note"]').fill(`multi-student ${reportLabel}`);
  await page.locator('textarea[name="studentSelfReport"]').fill(`student isolation ${reportLabel}`);
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
  await expect(page.locator("main")).toContainText(`${expectedName} 的诊断结果`);
  const diagnosisId = Number(page.url().match(/\/diagnosis\/(\d+)$/)?.[1] ?? finalized.officialDiagnosisId ?? 0);
  const weeklyHref = await page.locator('a[href^="/weekly-report/"]').first().getAttribute("href");
  const weeklyReportId = Number(weeklyHref?.match(/\/weekly-report\/(\d+)$/)?.[1] ?? finalized.officialWeeklyReportId ?? 0);
  expect(diagnosisId).toBeGreaterThan(0);
  expect(weeklyReportId).toBeGreaterThan(0);
  return { diagnosisId, weeklyReportId };
}

async function resetStudentAccess(page: Page) {
  await login(page, "admin@example.com");
  await resetStudentTrialAccess(page, [1, 2]);
  await resetStudentMembership(page, [1, 2]);
  await setStudentMembership(page, 1, "self_service", { reason: "e2e multi student 1" });
  await setStudentMembership(page, 2, "self_service", { reason: "e2e multi student 2" });

  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
}

test("multi-student switch keeps uploads, diagnosis and weekly reports isolated by student_id", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await loginParent(page);
  await page.screenshot({ path: testInfo.outputPath("01-parent-dashboard.png"), fullPage: true });

  await switchStudent(page, "1", "林同学");
  const a = await uploadForCurrentStudent(page, 1, "函数", "A-flow", "林同学");
  await page.screenshot({ path: testInfo.outputPath("02-student-a-diagnosis.png"), fullPage: true });

  await switchStudent(page, "2", "林可可");
  const b = await uploadForCurrentStudent(page, 2, "阅读定位", "B-flow", "林可可");
  await page.screenshot({ path: testInfo.outputPath("03-student-b-diagnosis.png"), fullPage: true });

  await switchStudent(page, "1", "林同学");
  const aDiagnosisHref = await page.locator('a[href^="/diagnosis/"]').first().getAttribute("href");
  const aWeeklyHref = await page.locator('a[href^="/weekly-report/"]').first().getAttribute("href");
  expect(aDiagnosisHref).toBe(`/diagnosis/${a.diagnosisId}`);
  expect(aWeeklyHref).toBe(`/weekly-report/${a.weeklyReportId}`);

  await switchStudent(page, "2", "林可可");
  const bDiagnosisHref = await page.locator('a[href^="/diagnosis/"]').first().getAttribute("href");
  const bWeeklyHref = await page.locator('a[href^="/weekly-report/"]').first().getAttribute("href");
  expect(bDiagnosisHref).toBe(`/diagnosis/${b.diagnosisId}`);
  expect(bWeeklyHref).toBe(`/weekly-report/${b.weeklyReportId}`);

  await page.goto(`/diagnosis/${a.diagnosisId}`);
  await expect(page.locator("main")).toContainText("林同学 的诊断结果");
  await page.goto(`/diagnosis/${b.diagnosisId}`);
  await expect(page.locator("main")).toContainText("林可可 的诊断结果");

  await page.goto(`/weekly-report/${a.weeklyReportId}`);
  await expect(page.locator("main")).toContainText("林同学 的周总结");
  await page.goto(`/weekly-report/${b.weeklyReportId}`);
  await expect(page.locator("main")).toContainText("林可可 的周总结");

  await page.screenshot({ path: testInfo.outputPath("04-student-b-weekly-report.png"), fullPage: true });
});

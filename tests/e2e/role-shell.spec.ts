import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { resetStudentMembership, resetStudentTrialAccess } from "./membership-test-helpers";

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

async function resetStudentAccess(page: Page) {
  await login(page, "admin@example.com");
  await resetStudentTrialAccess(page, [1, 2]);
  await resetStudentMembership(page, [1, 2]);
}

async function switchStudent(page: Page, studentId: string, expectedName: string) {
  const waitForSwitch = page.waitForResponse((response) => response.url().includes("/api/students/switch") && response.request().method() === "POST");
  await page.locator("select").first().selectOption(studentId);
  await waitForSwitch;
  await page.goto("/dashboard");
  await expect(page.locator("main")).toContainText(expectedName, { timeout: 30_000 });
}

async function createDiagnosis(page: Page, studentLabel: string, subject: "math" | "english", module: string) {
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption(subject);
  await page.locator('select[name="module"]').selectOption(module);
  await page.locator('input[name="scoreNote"]').fill(subject === "english" ? "84 / 100" : "73 / 100");
  await page.locator('input[name="note"]').fill(`role-shell-${studentLabel}`);
  await page.locator('textarea[name="studentSelfReport"]').fill(`role-shell-${studentLabel}`);
  const uploadResponse = page.waitForResponse((response) => response.url().includes("/api/uploads") && response.request().method() === "POST");
  await page.locator('button[type="submit"]').click();
  const response = await uploadResponse;
  const payload = await response.json() as { ok: boolean; diagnosisId: number; recheckTaskId: number | null };
  expect(payload.ok).toBeTruthy();
  await expect(page).toHaveURL(/\/diagnosis\/\d+$/, { timeout: 180_000 });
  return payload;
}

test("student home follows current student_id data", async ({ page }) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await login(page, "parent@example.com");

  await switchStudent(page, "1", "林同学");
  const a = await createDiagnosis(page, `student-a-${Date.now()}`, "math", "函数");

  await switchStudent(page, "2", "林可可");
  const b = await createDiagnosis(page, `student-b-${Date.now()}`, "english", "阅读定位");

  await page.goto("/student-home");
  await expect(page.locator('[data-testid="student-home-hero"]')).toContainText("林可可", { timeout: 30_000 });
  await expect(page.locator(`a[href*="diagnosisId=${b.diagnosisId}"]`)).toBeVisible();
  await expect(page.locator(`a[href*="diagnosisId=${a.diagnosisId}"]`)).toHaveCount(0);

  await switchStudent(page, "1", "林同学");
  await page.goto("/student-home");
  await expect(page.locator('[data-testid="student-home-hero"]')).toContainText("林同学", { timeout: 30_000 });
  await expect(page.locator(`a[href*="diagnosisId=${a.diagnosisId}"]`)).toBeVisible();
  await expect(page.locator(`a[href*="diagnosisId=${b.diagnosisId}"]`)).toHaveCount(0);
});

test("parent overview keeps active summary isolated when switching students", async ({ page }) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await login(page, "parent@example.com");

  await switchStudent(page, "1", "林同学");
  await createDiagnosis(page, `overview-a-${Date.now()}`, "math", "函数");
  await page.goto("/parent-overview");
  await expect(page.locator('[data-testid="parent-overview-active"]')).toContainText("林同学", { timeout: 30_000 });
  await expect(page.locator('[data-testid="parent-overview-active"]')).not.toContainText("林可可");

  await switchStudent(page, "2", "林可可");
  await createDiagnosis(page, `overview-b-${Date.now()}`, "english", "阅读定位");
  await page.goto("/parent-overview");
  await expect(page.locator('[data-testid="parent-overview-active"]')).toContainText("林可可", { timeout: 30_000 });
  await expect(page.locator('[data-testid="parent-overview-active"]')).not.toContainText("林同学");
});

test("membership page entry and status display are correct", async ({ page }) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await login(page, "parent@example.com");
  await switchStudent(page, "1", "林同学");
  await createDiagnosis(page, `membership-${Date.now()}`, "math", "函数");

  await page.goto("/parent-overview");
  await page.getByTestId("parent-overview-active-membership").click();
  await expect(page).toHaveURL(/\/membership$/, { timeout: 30_000 });
  await expect(page.locator('[data-testid="membership-status"]')).toContainText("试用", { timeout: 30_000 });

  await page.getByTestId("membership-apply-self-service").click();
  await expect(page.locator('[data-testid="membership-status"]')).toContainText("自助会员", { timeout: 30_000 });
});

test("parent overview links to timeline and continue tracking correctly", async ({ page }) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await login(page, "parent@example.com");
  await switchStudent(page, "1", "林同学");
  const a = await createDiagnosis(page, `path-a-${Date.now()}`, "math", "函数");

  await page.goto("/parent-overview");
  await page.getByTestId("parent-overview-active-timeline").click();
  await expect(page).toHaveURL(/\/timeline$/, { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("林同学", { timeout: 30_000 });

  await page.goto("/parent-overview");
  await page.getByTestId("parent-overview-active-continue").click();
  await expect(page).toHaveURL(new RegExp(`/continue-tracking\\?[^\\n]*diagnosisId=${a.diagnosisId}`), { timeout: 30_000 });
});

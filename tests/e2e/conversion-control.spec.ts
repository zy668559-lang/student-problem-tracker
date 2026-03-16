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
  for (const id of [1, 2]) {
    const response = await page.request.patch(`/api/admin/trial-access/${id}`, {
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
}

async function switchStudent(page: Page, studentId: string, landing = "/dashboard") {
  const waitForSwitch = page.waitForResponse((response) => response.url().includes("/api/students/switch") && response.request().method() === "POST");
  await page.locator("select").first().selectOption(studentId);
  await waitForSwitch;
  await page.goto(landing);
  await expect(page.locator("select").first()).toHaveValue(studentId, { timeout: 30_000 });
}

async function createDiagnosis(page: Page, tag: string, subject: "math" | "english", module: string) {
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption(subject);
  await page.locator('select[name="module"]').selectOption(module);
  await page.locator('input[name="scoreNote"]').fill(subject === "math" ? "75 / 100" : "83 / 100");
  await page.locator('input[name="note"]').fill(tag);
  await page.locator('textarea[name="studentSelfReport"]').fill(tag);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/diagnosis\/\d+$/, { timeout: 180_000 });
  const diagnosisId = Number(page.url().match(/\/diagnosis\/(\d+)$/)?.[1]);
  expect(diagnosisId).toBeGreaterThan(0);
  return diagnosisId;
}

test("can enter tracking offer page from timeline and choose take advice", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await login(page, "parent@example.com");
  await switchStudent(page, "1");
  await createDiagnosis(page, `offer-a-${Date.now()}`, "math", "函数");

  await page.goto("/timeline");
  await page.getByRole("button", { name: "继续追踪 4 周", exact: true }).click();
  await expect(page).toHaveURL(/\/continue-tracking\?/, { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("为什么我建议继续追踪 4 周", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("当前最主要问题", { timeout: 30_000 });
  await page.getByTestId("tracking-offer-take-advice").click();
  await expect(page).toHaveURL(/\/(weekly-report|dashboard)\/?/, { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("01-offer-take-advice.png"), fullPage: true });
});

test("can continue from tracking offer page into recheck flow", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await login(page, "parent@example.com");
  await switchStudent(page, "1");
  await createDiagnosis(page, `offer-b-${Date.now()}`, "math", "函数");

  await page.goto("/timeline");
  await page.getByRole("button", { name: "继续追踪 4 周", exact: true }).click();
  await expect(page).toHaveURL(/\/continue-tracking\?/, { timeout: 30_000 });
  await page.getByTestId("tracking-offer-continue").click();
  await expect(page).toHaveURL(/\/(recheck|upload)\//, { timeout: 30_000 }).catch(async () => {
    await expect(page).toHaveURL(/\/upload$/, { timeout: 30_000 });
  });
  await page.screenshot({ path: testInfo.outputPath("02-offer-continue.png"), fullPage: true });
});

test("admin control center shows task metrics and summary cards", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await login(page, "admin@example.com");
  await page.goto("/admin");

  await expect(page.locator("main")).toContainText("今日待回访", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("今日待复检", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("今日待审核", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("本周高意向家长", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("本周周报状态", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText("今日模型成本", { timeout: 30_000 });
  await expect(page.getByRole("link", { name: /白名单管理/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /跟进漏斗/ }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("03-admin-control-center.png"), fullPage: true });
});

test("admin control center student summary stays isolated", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await login(page, "parent@example.com");
  await switchStudent(page, "1");
  await createDiagnosis(page, `control-a-${Date.now()}`, "math", "函数");
  await switchStudent(page, "2");
  await createDiagnosis(page, `control-b-${Date.now()}`, "english", "阅读定位");

  await login(page, "admin@example.com");
  await page.goto("/admin?student=1");
  const detail = page.getByTestId("control-selected-student");
  await expect(detail).toContainText("student_id 1", { timeout: 30_000 });
  await expect(detail).toContainText("林同学", { timeout: 30_000 });
  await expect(detail).not.toContainText("student_id 2");

  await page.getByTestId("control-student-2").click();
  await expect(page).toHaveURL(/student=2/, { timeout: 30_000 });
  await expect(detail).toContainText("student_id 2", { timeout: 30_000 });
  await expect(detail).toContainText("林可可", { timeout: 30_000 });
  await expect(detail).not.toContainText("student_id 1");
  await page.screenshot({ path: testInfo.outputPath("04-admin-control-isolation.png"), fullPage: true });
});

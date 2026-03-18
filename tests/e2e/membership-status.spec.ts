import fs from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { resetStudentMembership, resetStudentTrialAccess, setStudentMembership } from "./membership-test-helpers";
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

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("demo123");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

async function resetMembershipWorld(page: Page) {
  await login(page, "admin@example.com");
  await resetStudentTrialAccess(page, [1, 2]);
  await resetStudentMembership(page, [1, 2]);
}

async function switchStudent(page: Page, studentId: string) {
  const waitForSwitch = page.waitForResponse((response) => response.url().includes("/api/students/switch") && response.request().method() === "POST");
  await page.locator("select").first().selectOption(studentId);
  await waitForSwitch;
  await expect(page.locator("select").first()).toHaveValue(studentId, { timeout: 30_000 });
}

async function createDiagnosis(page: Page, studentId: number, studentLabel: string, subject: "math" | "english", module: string) {
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption(subject);
  await page.locator('select[name="module"]').selectOption(module);
  await page.locator('input[name="scoreNote"]').fill(subject === "math" ? "75 / 100" : "83 / 100");
  await page.locator('input[name="note"]').fill(`membership-${studentLabel}`);
  await page.locator('textarea[name="studentSelfReport"]').fill(`membership-${studentLabel}`);
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
  return Number(finalized.officialDiagnosisId ?? 0);
}

async function saveMembershipAction(page: Page, studentId: number) {
  const response = page.waitForResponse((item) => item.url().includes(`/api/admin/memberships/${studentId}`) && item.request().method() === "PATCH");
  await page.getByTestId(`membership-save-${studentId}`).click();
  const apiResponse = await response;
  expect(apiResponse.ok()).toBeTruthy();
}

test("three membership tiers and cta stay aligned per student", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetMembershipWorld(page);
  await setStudentMembership(page, 1, "self_service", { reason: "e2e membership self service" });
  await setStudentMembership(page, 2, "coaching", { reason: "e2e membership coaching" });

  await login(page, "parent@example.com");

  await switchStudent(page, "1");
  await createDiagnosis(page, 1, `student-a-${Date.now()}`, "math", "函数");
  await page.goto("/student-home");
  await expect(page.locator("main")).toContainText("想升级陪跑会员", { timeout: 30_000 });
  await page.goto("/membership");
  await expect(page.locator('[data-testid="membership-status"]')).toContainText("自助会员", { timeout: 30_000 });

  await switchStudent(page, "2");
  await createDiagnosis(page, 2, `student-b-${Date.now()}`, "english", "阅读定位");
  await page.goto("/student-home");
  await expect(page.locator("main")).toContainText("继续按陪跑节奏走", { timeout: 30_000 });
  await page.goto("/membership");
  await expect(page.locator('[data-testid="membership-status"]')).toContainText("陪跑会员", { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("01-membership-tier-display.png"), fullPage: true });
});

test("membership permissions and page prompts change with tier", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetMembershipWorld(page);

  await login(page, "parent@example.com");
  await switchStudent(page, "1");
  const diagnosisId = await createDiagnosis(page, 1, `trial-${Date.now()}`, "math", "函数");

  await page.goto("/timeline");
  await expect(page.locator('[data-testid^="timeline-node-"]')).toHaveCount(0);
  await expect(page.locator("main")).toContainText("试用先看清主问题", { timeout: 30_000 });
  await page.goto("/student-home");
  await expect(page.locator("main")).toContainText("申请开通自助会员", { timeout: 30_000 });

  await login(page, "admin@example.com");
  await setStudentMembership(page, 1, "self_service", { reason: "e2e upgrade to self service" });

  await login(page, "parent@example.com");
  await switchStudent(page, "1");
  await page.goto("/timeline");
  await expect(page.locator('[data-testid^="timeline-node-"]').first()).toBeVisible({ timeout: 30_000 });
  await page.goto("/student-home");
  await expect(page.locator("main")).toContainText("想升级陪跑会员", { timeout: 30_000 });

  await login(page, "admin@example.com");
  await setStudentMembership(page, 1, "coaching", { reason: "e2e upgrade to coaching" });

  await login(page, "parent@example.com");
  await switchStudent(page, "1");
  await page.goto(`/continue-tracking?diagnosisId=${diagnosisId}`);
  await expect(page.locator("main")).toContainText("继续按陪跑节奏练", { timeout: 30_000 });
  await page.goto("/student-home");
  await expect(page.locator("main")).toContainText("继续按陪跑节奏走", { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("02-membership-permissions.png"), fullPage: true });
});

test("admin manual membership actions take effect and leave logs", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetMembershipWorld(page);

  await login(page, "admin@example.com");
  await page.goto("/admin/memberships");
  const card = page.getByTestId("membership-card-1");
  await expect(card).toContainText("试用", { timeout: 30_000 });

  await card.locator('select[name="membership-action-1"]').selectOption("open");
  await card.locator('select[name="membership-tier-1"]').selectOption("coaching");
  await card.locator('textarea[name="membership-reason-1"]').fill("A6 open coaching");
  await saveMembershipAction(page, 1);
  await expect(card).toContainText("陪跑会员", { timeout: 30_000 });

  await card.locator('select[name="membership-action-1"]').selectOption("extend");
  await card.locator('select[name="membership-tier-1"]').selectOption("coaching");
  await card.locator('textarea[name="membership-reason-1"]').fill("A6 extend coaching");
  await card.locator('input[name="membership-effective-1"]').fill("2030-01-01T10:30");
  await saveMembershipAction(page, 1);

  await card.locator('select[name="membership-action-1"]').selectOption("downgrade");
  await card.locator('select[name="membership-tier-1"]').selectOption("self_service");
  await card.locator('textarea[name="membership-reason-1"]').fill("A6 downgrade self service");
  await saveMembershipAction(page, 1);
  await expect(card).toContainText("自助会员", { timeout: 30_000 });

  await card.locator('select[name="membership-action-1"]').selectOption("pause");
  await card.locator('textarea[name="membership-reason-1"]').fill("A6 pause self service");
  await saveMembershipAction(page, 1);
  await expect(card).toContainText("已暂停", { timeout: 30_000 });

  const logs = page.getByTestId("membership-logs");
  await expect(logs).toContainText("open", { timeout: 30_000 });
  await expect(logs).toContainText("extend", { timeout: 30_000 });
  await expect(logs).toContainText("downgrade", { timeout: 30_000 });
  await expect(logs).toContainText("pause", { timeout: 30_000 });
  await expect(logs).toContainText("A6 pause self service", { timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("03-admin-membership-actions.png"), fullPage: true });
});

test("membership state stays isolated across two students", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetMembershipWorld(page);
  await setStudentMembership(page, 1, "self_service", { reason: "e2e isolated self service" });
  await setStudentMembership(page, 2, "coaching", { reason: "e2e isolated coaching" });

  await login(page, "parent@example.com");

  await switchStudent(page, "1");
  await page.goto("/parent-overview");
  await expect(page.locator('[data-testid="parent-overview-active"]')).toContainText("自助会员", { timeout: 30_000 });
  await expect(page.locator('[data-testid="parent-overview-active"]')).not.toContainText("陪跑会员");

  await switchStudent(page, "2");
  await page.goto("/parent-overview");
  await expect(page.locator('[data-testid="parent-overview-active"]')).toContainText("陪跑会员", { timeout: 30_000 });
  await expect(page.locator('[data-testid="parent-overview-active"]')).not.toContainText("自助会员");
  await page.screenshot({ path: testInfo.outputPath("04-membership-isolation.png"), fullPage: true });
});

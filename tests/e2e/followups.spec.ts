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

async function resetStudentAccess(page: Page) {
  await login(page, "admin@example.com");
  await resetStudentTrialAccess(page, [1, 2]);
  await resetStudentMembership(page, [1, 2]);
}

async function switchStudent(page: Page, studentId: string) {
  const waitForSwitch = page.waitForResponse((response) => response.url().includes("/api/students/switch") && response.request().method() === "POST");
  await page.locator("select").first().selectOption(studentId);
  await waitForSwitch;
  await page.goto("/dashboard");
  await expect(page.locator("select").first()).toHaveValue(studentId, { timeout: 30_000 });
}

async function createDiagnosis(page: Page, studentId: number, studentLabel: string, subject: "math" | "english", moduleIndex: number) {
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption(subject);
  await page.locator('select[name="module"]').selectOption({ index: moduleIndex });
  await page.locator('input[name="scoreNote"]').fill(subject === "english" ? "84 / 100" : "73 / 100");
  await page.locator('input[name="note"]').fill(`followup-${studentLabel}`);
  await page.locator('textarea[name="studentSelfReport"]').fill(`followup-${studentLabel}`);
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
  return { ok: true, diagnosisId: Number(finalized.officialDiagnosisId ?? 0), recheckTaskId: finalized.recheckTaskId ?? null };
}

test("clicking continue tracking auto creates a followup lead", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await setStudentMembership(page, 1, "self_service", { reason: "e2e followup continue" });
  await login(page, "parent@example.com");
  await switchStudent(page, "1");
  const created = await createDiagnosis(page, 1, `lead-a-${Date.now()}`, "math", 0);

  await page.getByRole("button", { name: "继续追踪", exact: true }).click();
  await expect(page).toHaveURL(/\/recheck\/\d+$/, { timeout: 30_000 });

  await login(page, "admin@example.com");
  await page.goto("/admin/followups");
  const card = followupLeadCard(page, created.diagnosisId);
  await expect(card).toContainText("parent@example.com", { timeout: 30_000 });
  await expect(card).toContainText("student_id 1", { timeout: 30_000 });
  await expect(card).toContainText(`source_ref_id ${created.diagnosisId}`, { timeout: 30_000 });
  await card.screenshot({ path: testInfo.outputPath("01-followup-auto-pool.png") });
});

test("followup lead status can flow from contacted to activated with action logs", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await login(page, "parent@example.com");
  await switchStudent(page, "1");
  await createDiagnosis(page, 1, `intent-a-${Date.now()}`, "math", 0);

  const intentResponse = page.waitForResponse((response) => response.url().includes("/api/tracking-intents") && response.request().method() === "POST");
  await page.locator('textarea').last().fill(`intent-note-${Date.now()}`);
  await page.getByRole("button", { name: "提交开通意向" }).click();
  const intentPayload = await (await intentResponse).json() as { ok: boolean; id: number };
  expect(intentPayload.ok).toBeTruthy();

  await login(page, "admin@example.com");
  await page.goto("/admin/followups");
  const card = followupLeadCard(page, intentPayload.id);
  await expect(card).toContainText("student_id 1", { timeout: 30_000 });

  await card.locator('select[name^="followup-status-"]').selectOption("contacted");
  await card.locator('select[name^="followup-action-"]').selectOption("wechat_contacted");
  await card.locator('textarea[name^="followup-note-"]').fill("wechat-note");
  await card.locator('input[name^="followup-next-"]').fill("2026-03-18T20:30");
  await card.getByRole("button", { name: "保存这条跟进" }).click();
  await expect(card).toContainText("当前状态：已联系", { timeout: 30_000 });
  await expect(card).toContainText("wechat-note", { timeout: 30_000 });

  await card.locator('select[name^="followup-status-"]').selectOption("activated");
  await card.locator('select[name^="followup-action-"]').selectOption("activated");
  await card.locator('textarea[name^="followup-note-"]').fill("activated-note");
  await card.getByRole("button", { name: "保存这条跟进" }).click();
  await expect(card).toContainText("当前状态：已开通", { timeout: 30_000 });
  await expect(card).toContainText("activated-note", { timeout: 30_000 });
  await card.screenshot({ path: testInfo.outputPath("02-followup-status-flow.png") });
});

test("followup leads stay isolated between two students", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await setStudentMembership(page, 1, "self_service", { reason: "e2e followup student 1" });
  await setStudentMembership(page, 2, "self_service", { reason: "e2e followup student 2" });
  await login(page, "parent@example.com");

  await switchStudent(page, "1");
  const a = await createDiagnosis(page, 1, `student-a-${Date.now()}`, "math", 0);
  await page.getByRole("button", { name: "继续追踪", exact: true }).click();
  await expect(page).toHaveURL(/\/recheck\/\d+$/, { timeout: 30_000 });

  await switchStudent(page, "2");
  const b = await createDiagnosis(page, 2, `student-b-${Date.now()}`, "english", 0);
  await page.getByRole("button", { name: "继续追踪", exact: true }).click();
  await expect(page).toHaveURL(/\/recheck\/\d+$/, { timeout: 30_000 });

  await login(page, "admin@example.com");
  await page.goto("/admin/followups");
  const cardA = followupLeadCard(page, a.diagnosisId);
  const cardB = followupLeadCard(page, b.diagnosisId);
  await expect(cardA).toContainText("student_id 1", { timeout: 30_000 });
  await expect(cardA).not.toContainText("student_id 2");
  await expect(cardB).toContainText("student_id 2", { timeout: 30_000 });
  await expect(cardB).not.toContainText("student_id 1");
  await cardB.screenshot({ path: testInfo.outputPath("03-followup-multi-student.png") });
});


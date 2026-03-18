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

async function loginParent(page: Page) {
  await login(page, "parent@example.com");
}

async function loginAdmin(page: Page) {
  await login(page, "admin@example.com");
}

async function resetStudentAccess(page: Page) {
  await loginAdmin(page);
  await resetStudentTrialAccess(page, [1, 2]);
  await resetStudentMembership(page, [1, 2]);
}

async function switchStudent(page: Page, studentId: string, landing = "/dashboard") {
  const waitForSwitch = page.waitForResponse((response) => response.url().includes("/api/students/switch") && response.request().method() === "POST");
  await page.locator("select").first().selectOption(studentId);
  await waitForSwitch;
  await page.goto(landing);
  await expect(page.locator("select").first()).toHaveValue(studentId, { timeout: 30_000 });
}

async function uploadDraft(page: Page, tag: string, subject: "math" | "english", module: string) {
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.locator('select[name="subject"]').selectOption(subject);
  await page.locator('select[name="module"]').selectOption(module);
  await page.locator('input[name="scoreNote"]').fill(subject === "math" ? "71 / 100" : "82 / 100");
  await page.locator('input[name="note"]').fill(tag);
  await page.locator('textarea[name="studentSelfReport"]').fill(tag);
  const uploadResponse = page.waitForResponse((response) => response.url().includes("/api/uploads") && response.request().method() === "POST");
  await page.locator('button[type="submit"]').click();
  const response = await uploadResponse;
  const payload = await response.json() as { ok: boolean; draftId: number };
  expect(payload.ok).toBeTruthy();
  await expect(page).toHaveURL(/\/review-draft\/\d+$/, { timeout: 180_000 });
  const draftId = Number(page.url().match(/\/review-draft\/(\d+)$/)?.[1] ?? payload.draftId);
  return { draftId };
}

async function createDiagnosis(page: Page, studentId: number, tag: string, subject: "math" | "english", module: string) {
  await uploadDraft(page, tag, subject, module);
  const draftId = Number(page.url().match(/\/review-draft\/(\d+)$/)?.[1]);
  const finalized = await finalizeDraftByAdmin(page, draftId);
  await restoreParentContext(page, studentId);
  await page.goto(`/diagnosis/${finalized.officialDiagnosisId}`);
  return { ok: true, diagnosisId: Number(finalized.officialDiagnosisId ?? 0), recheckTaskId: finalized.recheckTaskId ?? null, weeklyReportId: finalized.officialWeeklyReportId ?? null };
}

async function clickDiagnosisContinueTracking(page: Page) {
  const eventResponse = page.waitForResponse((response) => response.url().includes("/api/result-events") && response.request().method() === "POST");
  await page.getByRole("button", { name: "继续追踪", exact: true }).click();
  await eventResponse;
  await expect(page).toHaveURL(/\/(upload|recheck)\/?/, { timeout: 30_000 });
}

async function forceTaskBackToRecheckDue(page: Page, taskId: number) {
  const response = await page.request.patch(`/api/admin/recheck-tasks/${taskId}`, {
    data: {
      decision: "bombing",
      manualPriority: `heartbeat-force-${Date.now()}`,
      reason: "heartbeat e2e force recheck due"
    }
  });
  expect(response.ok()).toBeTruthy();
}

async function stabilizeTask(page: Page, taskId: number) {
  const response = await page.request.patch(`/api/admin/recheck-tasks/${taskId}`, {
    data: {
      decision: "stabilized",
      manualPriority: `heartbeat-stable-${Date.now()}`,
      reason: "heartbeat e2e resolve open item"
    }
  });
  expect(response.ok()).toBeTruthy();
}

async function runHeartbeat(page: Page) {
  const response = await page.request.post("/api/admin/heartbeat");
  expect(response.ok()).toBeTruthy();
  const result = await response.json() as { ok: boolean; snapshot: { reminderItems: Array<any>; recheckItems: Array<any>; followupItems: Array<any>; operationsItems: Array<any> } };
  expect(result.ok).toBeTruthy();
  return result.snapshot;
}

test("heartbeat manual run creates followup and recheck events from existing product signals", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const recheckTag = `Heartbeat-Recheck-${testInfo.parallelIndex}-${Date.now()}`;

  await resetStudentAccess(page);
  await setStudentMembership(page, 2, "coaching", { reason: "heartbeat recheck student" });

  await loginParent(page);
  await switchStudent(page, "1");
  await createDiagnosis(page, 1, `Heartbeat-Followup-${Date.now()}`, "math", "函数");
  await clickDiagnosisContinueTracking(page);

  await switchStudent(page, "2");
  const first = await createDiagnosis(page, 2, recheckTag, "math", "函数");
  expect(first.recheckTaskId).toBeTruthy();
  const second = await createDiagnosis(page, 2, recheckTag, "math", "函数");
  expect(second.recheckTaskId).toBe(first.recheckTaskId);

  await loginAdmin(page);
  await forceTaskBackToRecheckDue(page, Number(first.recheckTaskId));
  const snapshot = await runHeartbeat(page);

  expect(snapshot.followupItems.some((item) => item.studentId === 1 && item.parentAccountId > 0)).toBeTruthy();
  expect(snapshot.recheckItems.some((item) => item.studentId === 2 && item.parentAccountId > 0)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("01-heartbeat-events.png"), fullPage: true });
});

test("pending draft does not leak into heartbeat today queue", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const draftTag = `Heartbeat-Draft-${testInfo.parallelIndex}-${Date.now()}`;

  await resetStudentAccess(page);
  await loginParent(page);
  await switchStudent(page, "1");
  await uploadDraft(page, draftTag, "math", "函数");

  await loginAdmin(page);
  await runHeartbeat(page);
  await page.goto("/admin");

  await expect(page.getByTestId("control-today-queue")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("control-today-queue")).not.toContainText(draftTag);
  await page.screenshot({ path: testInfo.outputPath("02-heartbeat-no-draft-leak.png"), fullPage: true });
});

test("admin control center orders today heartbeat items and refreshes after handling one", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  const recheckTag = `Heartbeat-Control-${testInfo.parallelIndex}-${Date.now()}`;

  await resetStudentAccess(page);
  await setStudentMembership(page, 2, "coaching", { reason: "heartbeat control recheck student" });

  await loginParent(page);
  await switchStudent(page, "1");
  await createDiagnosis(page, 1, `Heartbeat-Control-Followup-${Date.now()}`, "math", "函数");
  await clickDiagnosisContinueTracking(page);

  await switchStudent(page, "2");
  const first = await createDiagnosis(page, 2, recheckTag, "math", "函数");
  expect(first.recheckTaskId).toBeTruthy();
  await createDiagnosis(page, 2, recheckTag, "math", "函数");

  await loginAdmin(page);
  await forceTaskBackToRecheckDue(page, Number(first.recheckTaskId));
  await runHeartbeat(page);

  await page.goto("/admin");
  await expect(page.getByTestId("control-today-queue")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("control-today-queue")).toContainText("只放正式结果和现有运营信号，不放 draft", { timeout: 30_000 });
  await expect(page.getByTestId("control-today-item-student_recheck-2")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("control-today-item-parent_followup-1")).toBeVisible({ timeout: 30_000 });
  const todayOrder = await page.locator('[data-testid^="control-today-item-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid") ?? ""));
  expect(todayOrder.indexOf("control-today-item-student_recheck-2")).toBeGreaterThanOrEqual(0);
  expect(todayOrder.indexOf("control-today-item-parent_followup-1")).toBeGreaterThanOrEqual(0);
  expect(todayOrder.indexOf("control-today-item-student_recheck-2")).toBeLessThan(todayOrder.indexOf("control-today-item-parent_followup-1"));
  await expect(page.getByTestId("control-today-item-student_recheck-2")).toContainText("已逾期", { timeout: 30_000 });
  await expect(page.getByTestId("control-today-item-student_recheck-2")).toContainText("正式复检任务", { timeout: 30_000 });
  await expect(page.getByTestId("control-today-item-parent_followup-1")).toContainText("结果页 / 收口页行为", { timeout: 30_000 });

  await stabilizeTask(page, Number(first.recheckTaskId));
  await runHeartbeat(page);
  await page.goto("/admin");
  await expect(page.getByTestId("control-today-item-parent_followup-1")).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: testInfo.outputPath("03-heartbeat-control-center.png"), fullPage: true });
});

test("heartbeat events stay isolated across two students", async ({ page }, testInfo) => {
  test.setTimeout(420_000);
  await resetStudentAccess(page);
  await setStudentMembership(page, 1, "self_service", { reason: "suppress old followup on student 1" });

  await loginParent(page);
  await switchStudent(page, "2");
  await createDiagnosis(page, 2, `Heartbeat-Isolation-${Date.now()}`, "english", "阅读定位");
  await clickDiagnosisContinueTracking(page);

  await loginAdmin(page);
  const snapshot = await runHeartbeat(page);
  const studentIds = snapshot.followupItems.map((item) => item.studentId);
  expect(studentIds).toContain(2);
  expect(studentIds).not.toContain(1);
  await page.screenshot({ path: testInfo.outputPath("04-heartbeat-isolation.png"), fullPage: true });
});

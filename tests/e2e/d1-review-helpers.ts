import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("demo123");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

export async function setActiveStudent(page: Page, studentId: number | string, landing = "/dashboard") {
  const nextStudentId = Number(studentId);
  const result = await page.evaluate(async (payload) => {
    const response = await fetch("/api/students/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return {
      ok: response.ok,
      text: await response.text()
    };
  }, { studentId: nextStudentId });

  expect(result.ok, `setActiveStudent(${nextStudentId}) failed: ${result.text}`).toBeTruthy();
  await page.goto(landing);
}

export async function restoreParentContext(page: Page, studentId: number | string, landing = "/dashboard") {
  await loginAs(page, "parent@example.com");
  await setActiveStudent(page, studentId, landing);
}

function reviewCard(page: Page, draftId: number) {
  return page.locator("article").filter({ has: page.locator(`a[href="/review-draft/${draftId}"]`) }).first();
}

export async function finalizeDraftByAdmin(page: Page, draftId: number, action: "approve" | "reject" = "approve") {
  await loginAs(page, "admin@example.com");
  await page.goto("/review-queue");
  const card = reviewCard(page, draftId);
  await expect(card).toBeVisible({ timeout: 30_000 });

  const responsePromise = page.waitForResponse((response) => response.url().includes(`/api/review/${draftId}`) && response.request().method() === "PATCH");
  await card.getByRole("button", { name: action === "approve" ? "通过并正式入库" : "驳回" }).click();
  const response = await responsePromise;
  const payload = await response.json() as { ok?: boolean; officialDiagnosisId?: number | null; officialWeeklyReportId?: number | null; recheckTaskId?: number | null };
  expect(response.ok()).toBeTruthy();
  expect(payload.ok).toBeTruthy();

  if (action === "reject") {
    return { officialDiagnosisId: null, officialWeeklyReportId: null, recheckTaskId: null };
  }

  await expect(card.locator('a[href^="/diagnosis/"]').first()).toBeVisible({ timeout: 30_000 });
  const diagnosisHref = await card.locator('a[href^="/diagnosis/"]').first().getAttribute("href");
  const officialDiagnosisId = Number(diagnosisHref?.match(/\/diagnosis\/(\d+)$/)?.[1] ?? payload.officialDiagnosisId ?? 0);
  expect(officialDiagnosisId).toBeGreaterThan(0);
  return { officialDiagnosisId, officialWeeklyReportId: payload.officialWeeklyReportId ?? null, recheckTaskId: payload.recheckTaskId ?? null };
}


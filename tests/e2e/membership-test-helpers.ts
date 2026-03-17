import { expect, type Page } from "@playwright/test";

type MembershipTier = "trial" | "self_service" | "coaching";
type MembershipAction = "open" | "extend" | "downgrade" | "pause";

function nextMembershipExpiry(days = 28) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString();
}

async function patchInPage(page: Page, url: string, data: unknown) {
  return await page.evaluate(async ({ requestUrl, payload }) => {
    const response = await fetch(requestUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text()
    };
  }, {
    requestUrl: url,
    payload: data
  });
}

export async function resetStudentTrialAccess(page: Page, studentIds: number[] = [1, 2]) {
  for (const id of studentIds) {
    const result = await patchInPage(page, `/api/admin/trial-access/${id}`, {
      whitelistEnabled: true,
      freeTrialTotal: 200,
      freeTrialUsed: 0,
      maxImagesPerUpload: 1,
      enabledGrades: [],
      enabledSubjects: ["math", "english"],
      trackingStatus: "trial",
      paidTrackingEnabled: false
    });
    expect(result.ok, `resetStudentTrialAccess(${id}) failed: ${result.status} ${result.text}`).toBeTruthy();
  }
}

export async function setStudentMembership(
  page: Page,
  studentId: number,
  membershipTier: MembershipTier,
  options?: {
    action?: MembershipAction;
    effectiveTo?: string | null;
    reason?: string;
  }
) {
  const action = options?.action ?? (membershipTier === "trial" ? "downgrade" : "open");
  const effectiveTo = membershipTier === "trial"
    ? null
    : options?.effectiveTo ?? nextMembershipExpiry();
  const result = await patchInPage(page, `/api/admin/memberships/${studentId}`, {
    action,
    membershipTier,
    effectiveTo,
    reason: options?.reason ?? `e2e set ${membershipTier}`
  });
  expect(result.ok, `setStudentMembership(${studentId}, ${membershipTier}) failed: ${result.status} ${result.text}`).toBeTruthy();
  return JSON.parse(result.text) as unknown;
}

export async function resetStudentMembership(page: Page, studentIds: number[] = [1, 2]) {
  for (const id of studentIds) {
    await setStudentMembership(page, id, "trial", { action: "downgrade", reason: "e2e reset to trial" });
  }
}
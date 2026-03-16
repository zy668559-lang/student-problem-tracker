import { expect, type Page } from "@playwright/test";

type MembershipTier = "trial" | "self_service" | "coaching";
type MembershipAction = "open" | "extend" | "downgrade" | "pause";

function nextMembershipExpiry(days = 28) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString();
}

export async function resetStudentTrialAccess(page: Page, studentIds: number[] = [1, 2]) {
  for (const id of studentIds) {
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
  const response = await page.request.patch(`/api/admin/memberships/${studentId}`, {
    data: {
      action,
      membershipTier,
      effectiveTo,
      reason: options?.reason ?? `e2e set ${membershipTier}`
    }
  });
  expect(response.ok()).toBeTruthy();
  return await response.json();
}

export async function resetStudentMembership(page: Page, studentIds: number[] = [1, 2]) {
  for (const id of studentIds) {
    await setStudentMembership(page, id, "trial", { action: "downgrade", reason: "e2e reset to trial" });
  }
}

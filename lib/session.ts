import { cookies } from "next/headers";
import { getPrimaryStudentId } from "@/lib/db";
import type { AppSession } from "@/lib/types";

function normalizeStudentIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as number[];
  }
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function normalizeSessionCandidate(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

export function parseSessionValue(value?: string | null): AppSession | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value);
    const parsed = normalizeSessionCandidate(JSON.parse(decoded)) as Partial<AppSession> | null;
    if (!parsed) {
      return null;
    }
    const studentIds = normalizeStudentIds(parsed.studentIds);
    const activeStudentId = typeof parsed.activeStudentId === "number"
      ? parsed.activeStudentId
      : studentIds[0] ?? null;

    if (typeof parsed.userId !== "number" || typeof parsed.role !== "string") {
      return null;
    }

    return {
      userId: parsed.userId,
      role: parsed.role,
      activeStudentId,
      studentIds
    };
  } catch {
    return null;
  }
}

export function serializeSessionValue(session: AppSession) {
  return JSON.stringify(session);
}

export async function getServerSession() {
  const store = await cookies();
  return parseSessionValue(store.get("spt_session")?.value);
}

export function isAdminSession(session: AppSession | null) {
  return session?.role === "admin";
}

export function getActiveStudentId(session: AppSession | null) {
  if (session?.activeStudentId && session.studentIds.includes(session.activeStudentId)) {
    return session.activeStudentId;
  }
  if (session?.studentIds[0]) {
    return session.studentIds[0];
  }
  return getPrimaryStudentId();
}

export function parseSessionFromCookieHeader(cookieHeader?: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const sessionPair = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("spt_session="));

  if (!sessionPair) {
    return null;
  }

  return parseSessionValue(sessionPair.slice("spt_session=".length));
}

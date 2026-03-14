import clsx from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function subjectLabel(subject: "math" | "english") {
  return subject === "math" ? "数学" : "英语";
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function reviewStatusLabel(status: string) {
  switch (status) {
    case "approved":
      return "已通过";
    case "edited":
      return "已修改";
    case "rejected":
      return "已驳回";
    default:
      return "待审核";
  }
}

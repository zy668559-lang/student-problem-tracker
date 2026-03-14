import type { DiagnosisPayload, Subject, WeeklyReportPayload } from "@/lib/types";

export const SUBJECT_MODULES: Record<Subject, string[]> = {
  math: ["函数", "几何"],
  english: ["阅读定位", "完形逻辑", "作文输出"]
};

export const ENGLISH_BACKEND_TAGS = [
  "题干关键词识别",
  "回原文定位",
  "同义替换识别",
  "逻辑连接判断",
  "固定搭配与句型稳定",
  "作文结构与低级错误控制"
];

export const SUBJECT_STAGE_COPY: Record<Subject, string> = {
  math: "基础理解已建立，正在从单点修补过渡到题型稳定。",
  english: "阅读定位开始成型，输出类任务仍需持续控错。"
};

export const MOCK_DIAGNOSIS_TEMPLATES: Record<Subject, DiagnosisPayload[]> = {
  math: [
    {
      current_stage: "函数图像识别不稳，已能复盘但独立迁移不足",
      subject: "math",
      module: "函数",
      problem_tags: ["审题遗漏条件", "函数图像与解析式联动弱", "步骤跳跃"],
      repair_actions: [
        "每天 1 组函数图像判读卡片",
        "每次订正必须写出已知条件到图像变化",
        "错题二次复做时先口述思路再下笔"
      ],
      parent_summary:
        "孩子已经能看懂老师讲解，但自己做题时容易漏条件，建议把函数图像变化和条件对应关系固定下来。",
      confidence: 0.84,
      review_status: "pending"
    },
    {
      current_stage: "几何辅助线意识出现，但选择时机不稳定",
      subject: "math",
      module: "几何",
      problem_tags: ["图形关系提取慢", "辅助线策略不固定", "证明链条断裂"],
      repair_actions: [
        "整理 3 类高频辅助线模板",
        "先标注已知角边关系再决定是否作线",
        "每次订正补一版完整证明链"
      ],
      parent_summary:
        "几何不是不会做，而是不知道什么时候该启用哪种辅助线，需要把套路沉淀成固定动作。",
      confidence: 0.82,
      review_status: "pending"
    }
  ],
  english: [
    {
      current_stage: "阅读定位开始提升，但同义替换识别仍然失分",
      subject: "english",
      module: "阅读定位",
      problem_tags: ["题干关键词识别", "回原文定位", "同义替换识别"],
      repair_actions: [
        "先圈题干核心名词和限定词",
        "每篇阅读记录 3 组同义替换",
        "做错题时复盘错误定位句"
      ],
      parent_summary:
        "阅读理解的问题主要不是单词量，而是题干和原文之间的替换关系识别不够稳定。",
      confidence: 0.87,
      review_status: "pending"
    },
    {
      current_stage: "作文表达有内容，但结构组织和低级错误控制不足",
      subject: "english",
      module: "作文输出",
      problem_tags: ["固定搭配与句型稳定", "作文结构与低级错误控制"],
      repair_actions: [
        "固定使用三段式提纲",
        "每篇作文单独检查时态和单复数",
        "积累 5 组高频连接句"
      ],
      parent_summary:
        "孩子写作愿意输出，但还没形成稳定模板，先把结构和低级错误控制住更重要。",
      confidence: 0.8,
      review_status: "pending"
    }
  ]
};

export const DEFAULT_WEEKLY_REPORT: WeeklyReportPayload = {
  this_week_problem: ["上传后自动汇总本周主要问题"],
  this_week_actions: ["根据诊断生成修复动作"],
  improved_points: ["定位能力开始改善"],
  unstable_points: ["重复错因仍会回弹"],
  repeated_error_tags: ["审题遗漏条件"],
  next_week_plan: ["围绕一个模块做重复巩固"]
};

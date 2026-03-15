import type { DiagnosisPayload, SkillAsset, Subject, WeeklyReportPayload } from "@/lib/types";

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

export const STUCK_POINT_OPTIONS = [
  "不知道怎么开始",
  "画不出辅助线",
  "条件太多，关系理不清",
  "知道要证什么，但过程写不出",
  "公式和定理总想不起来",
  "做到最后一步总掉链子",
  "我也说不清 / 不知道卡哪"
] as const;

export const SUBJECT_STAGE_COPY: Record<Subject, string> = {
  math: "基础理解有了，但一到迁移题还不够稳。",
  english: "阅读定位在慢慢成型，输出类任务还得继续控错。"
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
        "孩子不是完全不会，而是一换条件就容易掉链子，先把函数图像和条件变化这一步盯稳。",
      confidence: 0.84,
      review_status: "pending"
    },
    {
      current_stage: "几何辅助线意识有了，但什么时候该出手还不稳定",
      subject: "math",
      module: "几何",
      problem_tags: ["图形关系提取慢", "辅助线策略不固定", "证明链条断裂"],
      repair_actions: [
        "整理 3 类高频辅助线触发场景",
        "先把已知角边关系圈出来再决定作线",
        "每次订正补一版完整证明骨架"
      ],
      parent_summary:
        "几何现在更像是套路没有装进脑子里，不是不会听，而是不知道什么时候用哪一类辅助线。",
      confidence: 0.82,
      review_status: "pending"
    }
  ],
  english: [
    {
      current_stage: "阅读定位开始提升，但同义替换一变形还是容易丢分",
      subject: "english",
      module: "阅读定位",
      problem_tags: ["题干关键词识别", "回原文定位", "同义替换识别"],
      repair_actions: [
        "先圈题干核心名词和限定词",
        "每篇阅读记录 3 组同义替换",
        "做错题时回看错误定位句"
      ],
      parent_summary:
        "现在主要不是单词量不够，而是题干和原文之间的替换关系还不够稳。",
      confidence: 0.87,
      review_status: "pending"
    },
    {
      current_stage: "作文愿意写，但结构组织和低级错误控制还没站稳",
      subject: "english",
      module: "作文输出",
      problem_tags: ["固定搭配与句型稳定", "作文结构与低级错误控制"],
      repair_actions: [
        "固定使用三段式提纲",
        "每篇作文单独检查时态和单复数",
        "积累 5 组高频连接句"
      ],
      parent_summary:
        "先别急着追求高级表达，先把结构和低级错误压下来更划算。",
      confidence: 0.8,
      review_status: "pending"
    }
  ]
};

export const DEFAULT_WEEKLY_REPORT: WeeklyReportPayload = {
  this_week_problem: ["上传后自动汇总本周主要问题"],
  this_week_actions: ["根据诊断生成修复动作"],
  improved_points: ["开始出现可复用的进步动作"],
  unstable_points: ["重复错因仍会回弹"],
  repeated_error_tags: ["审题遗漏条件"],
  next_week_plan: ["围绕一个模块做重复巩固"]
};

export const SKILL_ASSET_SEEDS: Array<Omit<SkillAsset, "id">> = [
  {
    subject: "math",
    module: "几何",
    tag: "geometry_auxiliary_line_trigger",
    difficulty: "基础",
    assetType: "worksheet",
    title: "辅助线什么时候该出手",
    summary: "把常见等腰、平行、角平分线场景拆成触发清单，先帮孩子知道什么时候该画。",
    fileUrl: "/assets/geometry-auxiliary-line-trigger.pdf",
    previewUrl: "/previews/geometry-auxiliary-line-trigger.png",
    useStage: "review",
    paidOnly: false
  },
  {
    subject: "math",
    module: "几何",
    tag: "geometry_relation_translation",
    difficulty: "进阶",
    assetType: "card",
    title: "图形关系翻译卡",
    summary: "把题目条件翻成角、边、平行、垂直关系，适合关系理不清的孩子。",
    fileUrl: "/assets/geometry-relation-translation.pdf",
    previewUrl: "/previews/geometry-relation-translation.png",
    useStage: "diagnosis",
    paidOnly: false
  },
  {
    subject: "math",
    module: "几何",
    tag: "geometry_proof_skeleton",
    difficulty: "进阶",
    assetType: "template",
    title: "几何证明骨架模板",
    summary: "先给孩子证明骨架，再往里填关系，适合知道结论但写不出过程的情况。",
    fileUrl: "/assets/geometry-proof-skeleton.pdf",
    previewUrl: "/previews/geometry-proof-skeleton.png",
    useStage: "repair",
    paidOnly: true
  },
  {
    subject: "math",
    module: "函数",
    tag: "function_graph_condition_link",
    difficulty: "基础",
    assetType: "worksheet",
    title: "条件一变，图像哪变",
    summary: "把函数条件变化和图像变化放在一张表里，孩子一眼能对上。",
    fileUrl: "/assets/function-graph-condition-link.pdf",
    previewUrl: "/previews/function-graph-condition-link.png",
    useStage: "diagnosis",
    paidOnly: false
  },
  {
    subject: "math",
    module: "函数",
    tag: "function_entry_step",
    difficulty: "基础",
    assetType: "checklist",
    title: "函数题先从哪一步下手",
    summary: "把起手顺序拆成小清单，适合不知道怎么开始的孩子。",
    fileUrl: "/assets/function-entry-step.pdf",
    previewUrl: "/previews/function-entry-step.png",
    useStage: "repair",
    paidOnly: false
  },
  {
    subject: "math",
    module: "函数",
    tag: "function_vertex_axis_opening",
    difficulty: "进阶",
    assetType: "card",
    title: "顶点、对称轴、开口速判卡",
    summary: "专门帮孩子把二次函数几个最容易混的点拆开。",
    fileUrl: "/assets/function-vertex-axis-opening.pdf",
    previewUrl: "/previews/function-vertex-axis-opening.png",
    useStage: "review",
    paidOnly: true
  }
];

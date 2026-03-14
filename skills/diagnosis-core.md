# diagnosis-core

目标：把上传图片、学生自述、分数备注收敛成结构化 diagnosis JSON。

硬约束：
- 只输出 `current_stage` `subject` `module` `problem_tags` `repair_actions` `parent_summary` `confidence` `review_status`
- `problem_tags` 和 `repair_actions` 必须是字符串数组
- `review_status` 固定为 `pending`
- `confidence` 保持 0 到 1

判断优先级：
1. 先看重复错因
2. 再看当前阶段
3. 最后给少量可执行修复动作

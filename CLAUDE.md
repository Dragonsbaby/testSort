# PMS Frontend
## 技能输出路径

- **设计文档 (specs):** 保存到 `.claude/specs/YYYY-MM-DD-<topic>-design.md`
- **实施计划 (plans):** 保存到 `.claude/plans/YYYY-MM-DD-<feature-name>.md`
- 使用 Write/Edit 等文件工具创建 specs 或 plans 时，路径必须使用项目相对路径或项目内绝对路径；禁止使用 `~/.claude/...`，避免 `~` 被当作项目目录下的普通文件夹。

## 排序动画调试经验

### 1. Canvas 实体透明度双重控制陷阱

`drawBarEntity` 用 `entity.style.alpha ?? entity.opacity` 决定绘制透明度。`interpolateStyle` 在插值时无条件注入 `alpha`（默认 1），覆盖 `opacity: 0`，导致本应隐藏的实体依然可见。

修复：`interpolateStyle` 仅在 from/to 至少一方有 alpha 时才注入。隐藏实体同时设 `width: 0` 作为防御（桶排序 scatteredIndices 已有此实践）。

**Why:** Canvas `globalAlpha` 由 `style.alpha` 优先决定，opacity 只是 fallback。插值引擎默认注入 alpha=1 导致 opacity=0 被架空。
**How to apply:** 任何排序算法中需要隐藏的实体，opacity=0 之外必须同时设 width=0 作为防御层。修改 `interpolateStyle` 后需回归所有排序算法的动画。

### 2. Ghost 动画的 from/to 帧隐藏集合一致性

实现"元素飞走"动画时，源实体必须在 from 和 to 两帧中都被隐藏，否则插值 lerp 让 opacity 从 0→1 导致实体在动画中重现。被 ghost 接管的目标实体同理。

**Why:** 插值引擎对 from→to 每个属性做 lerp。只隐藏 from 不隐藏 to，opacity 就会线性增长。
**How to apply:** 任何排序算法的 ghost 动画——"真身"必须在 from 和 to 两帧中都不可见。需维护 hiddenIndices 集合，在创建 from 和 to 帧时均传递。

### 3. Ghost 不能 spread 被隐藏的源实体

当源实体因 hiddenIndices 被设为 width=0 时，ghost 若 spread 该实体会继承 width=0，导致"通道关闭"视觉 bug。ghost 必须显式从 layout 读取原始尺寸。

**Why:** JavaScript spread 展开的是当前值，hidden 实体的 width=0 会被 ghost 继承。
**How to apply:** 任何 ghost 创建处禁止 spread 源实体的几何属性，改为从 layout slots 显式读取 x/y/width/height。

### 4. 飞行路径类型选择

`arc` 在垂直距离大时弧度过高（`Math.max(80, ...)` 叠加），视觉夸张。垂直大距场景用 `linear` 更自然，水平短距可用 arc 增加趣味。

**Why:** arc 高度公式不区分水平/垂直跨度，垂直跨度大时叠加过大弧度。
**How to apply:** 新增排序算法的飞行动画时，根据起止点距离方向选择 transition type，不要一律用 arc。

### 5. 元素标识符应绑定值而非位置

当元素在区域间移动时（如主数组↔缓冲区、主数组↔桶），底部序号应跟随元素本身，不是显示位置编号。数据结构需同时记录 value 和 displayIndex。

**Why:** 用户期望元素带着"身份证"变换位置，位置编号变化会造成认知混乱。
**How to apply:** 任何涉及元素跨区域移动的排序算法，存储结构需为 `{ value, displayIndex }` 而非裸 number。区域实体的 displayIndex 从条目读取，不由位置决定。

### 6. 双向飞行动画的实体可见性矩阵

实现双向飞行动画前，先列出 from/to 两帧中每个实体的可见性状态（opacity + width），确认插值过程中不会出现意外显现。常见遗漏：
- to 帧未传递 hiddenMainIndices → 非动画步骤的 to 帧让隐藏柱子闪现
- to 帧未传递 hiddenBufferIndices → 目标区域实体在插值中 opacity 0→1 重现
- ghost to 帧 opacity=0 → ghost 在动画结束时消失导致与真实实体切换闪烁

**Why:** 对称设计保证两种飞行方向的视觉一致性，任何一帧的遗漏都会导致插值过程中实体意外显现。
**How to apply:** 新增或修改排序算法的飞行动画时，先画出可见性矩阵再编码，避免逐帧调试。

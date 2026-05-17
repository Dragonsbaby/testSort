/**
 * 中文翻译文件
 * 用于排序算法可视化的国际化支持
 */

/** 算法名称 */
export const algorithmNames: Record<string, string> = {
  bubble: '冒泡排序',
  insertion: '插入排序',
  merge: '归并排序',
  quick: '快速排序',
  heap: '堆排序',
  shell: '希尔排序',
  bucket: '桶排序'
};

/** 操作类型名称 */
export const operationNames: Record<string, string> = {
  compare: '比较',
  swap: '交换',
  merge: '合并',
  set: '设置',
  sorted: '已排序',
  pivot: '基准',
  'merge-set': '合并设置',
  'merge-back': '合并归位',
  'bucket-scatter': '分桶',
  'bucket-compare': '桶内比较',
  'bucket-swap': '桶内交换',
  'bucket-gather': '收集',
  latest: '最新'
};

/** 算法阶段名称 */
export const phaseNames: Record<string, string> = {
  '分区阶段': '分区阶段',
  '合并阶段': '合并阶段',
  '建堆阶段': '建堆阶段',
  '扫描阶段': '扫描阶段',
  '插入阶段': '插入阶段',
  '希尔排序阶段': '希尔排序阶段',
  '桶排序阶段': '桶排序阶段',
  '分桶阶段': '分桶阶段',
  '收集阶段': '收集阶段'
};

/** 重要程度 */
export const importanceLevels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高'
};

/** 通用提示信息 */
export const commonHints: Record<string, string> = {
  swap: '交换操作让较大的元素逐步移动到正确位置',
  pivot: '基准选择是快速排序的关键，影响分区效率',
  merge: '归并排序的核心操作，时间复杂度 O(n)',
  siftDown: 'sift-down 是堆排序的核心操作，确保堆顶元素是最大/最小值',
  insert: '插入排序通过构建有序序列，对未排序数据逐个插入',
  bucket: '桶排序通过将数据分到有限数量的桶里，每个桶单独排序'
};

/** UI 文本 */
export const uiText = {
  step: '步骤',
  of: '/',
  totalSteps: '总步骤',
  progress: '进度',
  comparisons: '比较',
  swaps: '交换',
  elapsedTime: '耗时',
  completed: '完成',
  play: '播放',
  pause: '暂停',
  reset: '重置',
  stepForward: '前进',
  stepBackward: '后退',
  jumpToStart: '跳到开始',
  jumpToEnd: '跳到结尾'
};

/** 错误信息 */
export const errorMessages = {
  invalidIndex: '无效的索引位置',
  invalidValue: '无效的值',
  arrayEmpty: '数组为空',
  sortError: '排序错误'
};

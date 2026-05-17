/**
 * 排序算法术语规范
 * 统一所有算法的用户界面描述，提升专业性和一致性
 */

// === 位置和索引描述 ===
export const POSITION_TERMS = {
  // 标准位置描述
  standard: (index: number, value?: number) =>
    value ? `位置 ${index} 的值 ${value}` : `位置 ${index}`,

  // 简洁位置描述
  concise: (index: number) => `位置 ${index}`,

  // 数值描述
  valueOnly: (value: number) => `值 ${value}`,

  // 禁止使用的格式
  avoid: [
    'arr[i]',        // 变量名泄露
    'leftArr[i]',    // 内部数组名泄露
    'rightArr[i]',   // 内部数组名泄露
    '[i]',           // 数组访问语法
    'temp[i]',       // 临时变量名泄露
  ]
} as const;

// === 区域描述 ===
export const REGION_TERMS = {
  // 归并排序专用
  merge: {
    leftHalf: '左半区',
    rightHalf: '右半区',
    leftSection: '左区间',
    rightSection: '右区间',
    leftSubsequence: '左子序列',
    rightSubsequence: '右子序列',
    mergeArea: '合并区',
    auxiliaryArea: '辅助区',    // 替代"下排"
    mainArray: '主数组',          // 替代"上排"
  },

  // 桶排序专用
  bucket: {
    bucket: '桶',
    mainArray: '主数组',
    scatter: '分配',
    gather: '收集',
    bucketArea: '桶区域',
  },

  // 堆排序专用
  heap: {
    heap: '堆',
    parentNode: '父节点',
    leftChild: '左子节点',
    rightChild: '右子节点',
    heapTop: '堆顶',
    heapRange: '堆范围',
  }
} as const;

// === 操作描述 ===
export const OPERATION_TERMS = {
  // 比较操作
  compare: {
    standard: (a: number, b: number, result?: string) =>
      `比较值 ${a} 和值 ${b}${result ? '，' + result : ''}`,

    withPosition: (posA: number, valA: number, posB: number, valB: number) =>
      `比较位置 ${posA} 的值 ${valA} 和位置 ${posB} 的值 ${valB}`,

    smaller: '较小值被选中',
    larger: '较大值被选中',
    noChangeNeeded: '无需交换',
  },

  // 交换操作
  swap: {
    standard: (posA: number, posB: number, valA?: number, valB?: number) =>
      valA !== undefined && valB !== undefined
        ? `交换位置 ${posA} 的值 ${valA} 和位置 ${posB} 的值 ${valB}`
        : `交换位置 ${posA} 和位置 ${posB}`,

    moveToPosition: (fromPos: number, toPos: number, value: number) =>
      `值 ${value} 从位置 ${fromPos} 移动到位置 ${toPos}`,
  },

  // 移动操作
  move: {
    to: (target: string) => `移动到${target}`,
    toPosition: (position: number) => `移动到位置 ${position}`,
    shiftRight: '向右移动',
    shiftLeft: '向左移动',
    insertTo: '插入到',
  },

  // 复制操作
  copy: {
    to: (target: string) => `复制到${target}`,
    toPosition: (position: number) => `复制到位置 ${position}`,
  }
} as const;

// === 专业术语对照表 ===
export const TERMINOLOGY_MAPPING = {
  // 中英文对照
  'pivot': '基准元素',
  '基准值': '基准元素',
  'sift-down': '向下调整（sift-down）',
  'sift-up': '向上调整（sift-up）',
  'heap property': '堆性质',
  'partition': '分区',

  // 口语化替换
  '胜出': '较小值被选中',
  '飞入': '移动到',
  '飞回': '返回',
  '飞到': '移动到',
  '归位': '返回正确位置',

  // 技术术语替换
  '左子': '左子节点',
  '右子': '右子节点',
  '下排': '辅助区',
  '上排': '主数组',
  '槽': '位置',

  // 变量名替换
  'leftArr': '左半区',
  'rightArr': '右半区',
  'arr[i]': '位置 i 的值',
  'temp': '辅助数组',
} as const;

// === 阶段描述 ===
export const PHASE_TERMS = {
  bubbleSort: {
    main: '冒泡排序',
    scanning: '扫描阶段',
    swapping: '交换阶段',
  },

  quickSort: {
    main: '快速排序',
    partition: '分区阶段',
    recursive: '递归排序',
    selectPivot: '选择基准',
  },

  mergeSort: {
    main: '归并排序',
    divide: '分割阶段',
    merge: '合并阶段',
    conquer: '递归处理',
  },

  heapSort: {
    main: '堆排序',
    buildHeap: '建堆阶段',
    extract: '提取阶段',
    maintainHeap: '维护堆性质',
  },

  insertionSort: {
    main: '插入排序',
    findPosition: '查找位置',
    insertElement: '插入元素',
    expandSorted: '扩展有序区',
  },

  shellSort: {
    main: '希尔排序',
    gapPhase: '间隔排序阶段',
    gapReduction: '间隔递减',
    groupSort: '分组排序',
  },

  bucketSort: {
    main: '桶排序',
    scatter: '分桶阶段',
    bucketSort: '桶内排序',
    gather: '收集阶段',
  }
} as const;

// === 描述模板 ===
export const DESCRIPTION_TEMPLATES = {
  // 比较操作模板
  compare: '比较位置 {posA} 的值 {valA} 和位置 {posB} 的值 {valB}',
  compareResult: '，{result}', // 结果说明

  // 交换操作模板
  swap: '交换位置 {posA} 和位置 {posB} 的值',
  swapWithValues: '交换位置 {posA} 的值 {valA} 和位置 {posB} 的值 {valB}',

  // 移动操作模板
  move: '值 {value} 从位置 {from} 移动到位置 {to}',
  moveRight: '值 {value} 向右移动',

  // 阶段说明模板
  phaseStart: '开始{phase}，当前{condition}',
  phaseComplete: '{phase}完成，{result}',

  // 算法说明模板
  algorithmHint: '{algorithm}的核心思想是{explanation}',
  operationHint: '{operation}的目的是{explanation}',
} as const;

// === 禁用词汇列表 ===
export const FORBIDDEN_TERMS = [
  // 变量名泄露
  'leftArr',
  'rightArr',
  'arr[',
  'temp[',

  // 口语化表达
  '胜出',
  '飞入',
  '飞回',
  '飞到',

  // 不完整术语
  '左子',
  '右子',

  // 编程语法泄露
  '[i]',
  '[j]',
  '=',

  // 不够专业的表达
  '槽', // 除非明确指代内存槽
] as const;

// === 工具函数 ===
/**
 * 检查描述是否包含禁用词汇
 */
export function containsForbiddenTerms(description: string): boolean {
  return FORBIDDEN_TERMS.some(term => description.includes(term));
}

/**
 * 规范化位置描述
 */
export function normalizePosition(index: number, value?: number): string {
  return value ? `位置 ${index} 的值 ${value}` : `位置 ${index}`;
}

/**
 * 规范化比较描述
 */
export function normalizeCompare(posA: number, valA: number, posB: number, valB: number): string {
  return `比较位置 ${posA} 的值 ${valA} 和位置 ${posB} 的值 ${valB}`;
}

/**
 * 规范化交换描述
 */
export function normalizeSwap(posA: number, posB: number, valA?: number, valB?: number): string {
  if (valA !== undefined && valB !== undefined) {
    return `交换位置 ${posA} 的值 ${valA} 和位置 ${posB} 的值 ${valB}`;
  }
  return `交换位置 ${posA} 和位置 ${posB}`;
}
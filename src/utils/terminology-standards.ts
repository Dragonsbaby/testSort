/**
 * 排序算法术语规范
 * 统一所有算法的用户界面描述，提升专业性和一致性
 */

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

// === 工具函数 ===
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

import type { StepContext } from './timeline';

/** 增强的步骤描述：包含简洁、详细、上下文三层信息 */
export interface EnhancedDescription {
  /** 简洁层：一句话说明操作 */
  brief: string;
  /** 详细层：操作原因和预期结果 */
  detail: string;
  /** 上下文：算法阶段和进度信息 */
  context?: StepContext;
}

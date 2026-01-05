/**
 * 库存标签中英文对应表
 * 用于将标签数字转换为中文显示
 */
export const LABEL_MAPPING: Record<number, string> = {
  1: '无库存',
  2: '无销量',
  3: '爆款',
  4: '在售天数预警',
  5: '库存待冲平',
}

/**
 * 获取标签的中文显示名称
 * @param label 标签数字
 * @returns 中文标签名称，如果找不到映射则返回原值
 */
export function getLabelName(label: number): string {
  return LABEL_MAPPING[label] || String(label)
}

/**
 * 获取多个标签的中文显示名称数组
 * @param labels 标签数字数组
 * @returns 中文标签名称数组
 */
export function getLabelNames(labels: number[]): string[] {
  return labels.map((label) => getLabelName(label))
}


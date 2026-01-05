/**
 * 物流状态中英文对应表
 * 用于将数据库中的状态值转换为中文显示
 */
export const STATUS_MAPPING: Record<string, string> = {
  // 已完成/已送达
  "Final delivery": "成功签收",
  "A request for re-delivery was received.": "收到重新投递请求",
  

  // 退回/异常相关
  "Returned to sender": "退回发件人",
  "Returned to Sender": "退回发件人",
  "Office closed": "办公室关闭",
  
  // 未上网相关
  "Not registered": "未上网",
  
  // 运输中相关（常见状态）
  "Posting/Collection": "发布/揽收",  
  "Allocated to delivery staff": "分配给配送员",
  "Processing at delivery Post Office": "在配送办公室处理",
  "Office closed. Retention.": "办公室关闭/滞留",
  "Retention": "滞留",
  "Absence. Attempted delivery.": "缺席/尝试投递",
  // 如果状态不在映射表中，返回原值
}

/**
 * 获取状态的中文显示名称
 * @param status 原始状态值（可能是英文或中文）
 * @returns 中文状态名称，如果找不到映射则返回原值
 */
export function getStatusLabel(status: string): string {
  // 如果状态已经在映射表中，直接返回
  if (STATUS_MAPPING[status]) {
    return STATUS_MAPPING[status]
  }
  
  // 如果状态已经是中文，直接返回
  // 简单判断：如果包含中文字符，认为是中文
  if (/[\u4e00-\u9fa5]/.test(status)) {
    return status
  }
  
  // 如果找不到映射且不是中文，返回原值（可能需要后续添加映射）
  return status
}


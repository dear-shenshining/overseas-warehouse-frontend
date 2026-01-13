/**
 * 运营映射工具
 * 根据店铺名称匹配对应的运营人员
 * 数据来源：运营对照.py
 */

// 运营对照表（店铺名称 -> 运营人员）
const OPERATOR_MAPPING: Record<string, string> = {
  "temu半托13店": "王子航",
  "temu半托1店": "宁一南",
  "temu半托2店": "宁一南",
  "temu半托3店": "张旭宇",
  "temu半托4店": "金张倩",
  "temu半托5店": "姚吕敏",
  "temu半托6店": "姚吕敏",
  "temu半托7店": "孟福泉",
  "temu半托8店": "徐新宇",
  "temu半托9店": "陈家喜",
  "temu半托10店": "郭俊嵘",
  "temu半托11店": "王子航",
  "temu半托12店": "李主富",
  "希音半托一店": "金张倩",
  "日本半托管14店（5/2）": "姚吕敏",
  "半托19店（12店3）": "李主富",
  "半托18店（10店3）": "郭俊嵘",
  "半托17店（12店2）": "李主富",
  "半托16店（10店2）": "郭俊嵘",
  "日本半托管21店（6-2）": "张旭宇",
  "日本半托管22店（8-2）": "徐新宇",
  "日本半托管23店（9-2）": "陈家喜",
  "日本半托管24店（11-2）": "吴宇哲",
  "日本半托管26店（13-2）": "王子航",
  "希音2店": "王子航",
  "半托28店（4店2）": "金张倩",
  "半托15（3店2）（Temu）": "吴宇哲",
  "日本半托管29店（8-3）": "徐新宇",
  "日本半托管30店（9-3）": "陈家喜",
  "半托25店": "张旭宇",
  "半托27店": "张旭宇",
  "半托32店": "吴介",
  "半托33店（25店3）": "张旭宇",
  "TK one1": "周登泰",
  "半托31店": "陈家喜",
  "日本半托管5/3店": "吴宇哲",
  "日本半托管13/3店": "王子航",
  "日本半托管35店（6-3）": "陈家喜",
  "半托20店（7店2）": "孟福泉",
  "31/2": "吴宇哲",
  "31店3": "陈家喜",
  "周登泰香港1": "周登泰",
  "周登泰香港2": "周登泰",
  "吴安格香港3店": "吴宇哲",
  "日本半托管32店（32-2）": "张旭宇",
  "日本半托管32店（32-3）": "张旭宇",
  "半托66店（1店2）": "宁一南",
  "33-3": "张旭宇",
  "日本半托34店": "姚吕敏",
  "35-1店": "徐新宇",
  "34-2": "姚吕敏",
  "34-6店": "陈家喜",
}

/**
 * 根据店铺名称获取运营人员
 * @param storeName 店铺名称
 * @returns 运营人员姓名，如果未找到则返回null
 */
export function getOperatorByStoreName(storeName: string | null | undefined): string | null {
  if (!storeName) {
    return null
  }
  
  // 精确匹配
  if (OPERATOR_MAPPING[storeName]) {
    return OPERATOR_MAPPING[storeName]
  }
  
  // 模糊匹配（包含关系）
  for (const [key, value] of Object.entries(OPERATOR_MAPPING)) {
    if (storeName.includes(key) || key.includes(storeName)) {
      return value
    }
  }
  
  return null
}

/**
 * 获取所有运营人员列表（去重）
 * @returns 运营人员姓名数组
 */
export function getAllOperators(): string[] {
  const operators = new Set<string>()
  for (const operator of Object.values(OPERATOR_MAPPING)) {
    operators.add(operator)
  }
  return Array.from(operators).sort()
}

/**
 * 获取运营人员对应的店铺列表
 * @param operator 运营人员姓名
 * @returns 店铺名称数组
 */
export function getStoresByOperator(operator: string): string[] {
  const stores: string[] = []
  for (const [storeName, op] of Object.entries(OPERATOR_MAPPING)) {
    if (op === operator) {
      stores.push(storeName)
    }
  }
  return stores.sort()
}



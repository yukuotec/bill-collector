export const CATEGORIES = {
  餐饮: ['饿了么', '美团', '肯德基', '麦当劳', '火锅', '烧烤', '海底捞', '快餐', '小吃', '外卖', '餐厅', '饭店'],
  交通: ['滴滴', '地铁', '公交', '出租车', '高铁', '火车', '飞机', '网约车', '共享单车', '打车'],
  购物: ['淘宝', '京东', '拼多多', '天猫', '苏宁', '唯品会', '网易严选', '亚马逊'],
  住房: ['房租', '物业', '水电', '燃气', '暖气', '租房', '中介'],
  医疗: ['药店', '医院', '门诊', '药房', '医保', '买药'],
  娱乐: ['电影', 'KTV', '游戏', '演出', '演唱会', '话剧', '音乐', '健身', '游泳', '羽毛球'],
  通讯: ['话费', '流量', '电信', '移动', '联通', '通信'],
  其他: [],
} as const;

export type Category = keyof typeof CATEGORIES;

export function categorize(description: string): Category {
  const text = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (category === '其他') continue;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return category as Category;
      }
    }
  }
  
  return '其他';
}

// ============== Smart Assignment Triage Rules (Phase 1) ==============

export interface TriageRule {
  memberName: string;
  keywords: string[];
}

/**
 * Default triage rules for smart assignment
 * Maps keywords to family members
 */
export const TRIAGE_RULES: TriageRule[] = [
  {
    memberName: '老公',
    keywords: ['游戏', '数码', '电子', '汽车', '烟', '酒'],
  },
  {
    memberName: '老婆',
    keywords: ['化妆品', '护肤', '包包', '服饰', '美甲'],
  },
  {
    memberName: '孩子',
    keywords: ['学校', '培训', '玩具', '奶粉', '童装'],
  },
  {
    memberName: '家庭',
    keywords: ['水电煤', '物业', '买菜', '日用品'],
  },
];

/**
 * Check if a transaction description or counterparty matches any triage rule
 * @param text - The text to check (description or counterparty)
 * @returns The member name that matches, or null if no match
 */
export function matchTriageRule(text: string): string | null {
  if (!text) return null;
  
  const lowerText = text.toLowerCase();
  
  for (const rule of TRIAGE_RULES) {
    for (const keyword of rule.keywords) {
      if (lowerText.includes(keyword)) {
        return rule.memberName;
      }
    }
  }
  
  return null;
}

// ============== Web/Environment Detection ==============

/**
 * Check if running in web version (without Electron context)
 * Uses a global flag set by the main process
 */
declare global {
  interface Window {
    __IS_ELECTRON?: boolean;
  }
}

// Check if we're running in Electron (either process.versions.electron is set or window.__IS_ELECTRON is true)
const isElectron = typeof process !== 'undefined' && process.versions?.electron !== undefined;
export const isWebVersion = !isElectron;

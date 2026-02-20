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

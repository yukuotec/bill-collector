import { getDatabase } from './database';

export interface CategoryPrediction {
  category: string;
  confidence: number;
  reason: string;
}

export interface CategoryModel {
  id: string;
  category: string;
  featureWeights: Record<string, number>;
  sampleCount: number;
  accuracy: number;
  lastUpdated: string;
}

export interface TrainingRecord {
  id: string;
  merchant: string;
  description: string;
  amount: number;
  category: string;
  features: string;
  createdAt: string;
}

// Category keywords for initial classification
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '餐饮': ['餐厅', '饭店', '火锅', '烧烤', '肯德基', '麦当劳', '星巴克', '奶茶', '面包', 'cafe', 'restaurant', 'food', 'dining', 'coffee'],
  '交通': ['地铁', '公交', '打车', '滴滴', '出租车', '加油', '停车', '地铁', 'transport', 'taxi', 'uber', 'fuel', 'parking'],
  '购物': ['超市', '便利店', '京东', '淘宝', '天猫', '拼多多', '亚马逊', 'shopping', 'mart', 'store'],
  '住房': ['房租', '物业', '水电', '燃气', '宽带', '维修', 'rent', 'utilities', 'maintenance'],
  '医疗': ['医院', '药店', '诊所', '体检', '医保', 'hospital', 'pharmacy', 'medical'],
  '娱乐': ['电影', '游戏', 'KTV', '酒吧', '门票', 'subscription', 'movie', 'game', 'entertainment'],
  '通讯': ['话费', '流量', '手机', '移动', '联通', '电信', 'phone', 'mobile', 'internet'],
  '教育': ['学费', '培训', '课程', '书籍', 'tuition', 'course', 'book', 'education'],
  '其他': [],
};

/**
 * Extract features from transaction data
 */
function extractFeatures(merchant: string, description: string, amount: number, date?: string): Record<string, number> {
  const features: Record<string, number> = {};
  const combinedText = `${merchant} ${description}`.toLowerCase();

  // Text features - check for category keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        features[`keyword_${category}_${keyword}`] = 1;
      }
    }
  }

  // Amount features - bin by range
  if (amount < 50) features['amount_small'] = 1;
  else if (amount < 200) features['amount_medium'] = 1;
  else if (amount < 500) features['amount_large'] = 1;
  else features['amount_xlarge'] = 1;

  // Time features
  if (date) {
    const d = new Date(date);
    const hour = d.getHours();
    const dayOfWeek = d.getDay();

    if (hour >= 6 && hour < 12) features['time_morning'] = 1;
    else if (hour >= 12 && hour < 18) features['time_afternoon'] = 1;
    else if (hour >= 18 && hour < 22) features['time_evening'] = 1;
    else features['time_night'] = 1;

    if (dayOfWeek === 0 || dayOfWeek === 6) features['day_weekend'] = 1;
    else features['day_weekday'] = 1;
  }

  // Merchant name features
  const merchantWords = merchant.toLowerCase().split(/\s+/);
  for (const word of merchantWords) {
    if (word.length > 2) {
      features[`merchant_${word}`] = 1;
    }
  }

  return features;
}

/**
 * Predict category for a transaction
 */
export function predictCategory(
  merchant: string,
  description: string,
  amount: number,
  date?: string
): CategoryPrediction {
  const features = extractFeatures(merchant, description, amount, date);
  const scores: Record<string, number> = {};

  // Calculate score for each category
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    let matchedFeatures = 0;

    for (const keyword of keywords) {
      const featureKey = `keyword_${category}_${keyword}`;
      if (features[featureKey]) {
        score += 1;
        matchedFeatures++;
      }
    }

    // Boost score based on amount patterns for certain categories
    if (category === '餐饮' && features['amount_small']) score += 0.5;
    if (category === '购物' && features['amount_medium']) score += 0.3;
    if (category === '交通' && features['amount_small']) score += 0.5;

    scores[category] = score;
  }

  // Find best category
  let bestCategory = '其他';
  let bestScore = 0;

  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // Calculate confidence based on score margin
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const confidence = sortedScores.length > 1 && sortedScores[0][1] > 0
    ? Math.min(0.95, sortedScores[0][1] / (sortedScores[0][1] + sortedScores[1][1] + 0.1))
    : sortedScores[0][1] > 0 ? 0.7 : 0.3;

  // Generate reason
  let reason = 'Based on ';
  if (bestScore > 0) {
    reason += `keyword matching (${Math.round(bestScore)} matches)`;
  } else {
    reason += 'default categorization';
  }

  return {
    category: bestCategory,
    confidence,
    reason,
  };
}

/**
 * Learn from user correction
 */
export async function learnFromCorrection(
  merchant: string,
  description: string,
  amount: number,
  correctCategory: string,
  date?: string
): Promise<void> {
  const db = getDatabase();
  const id = `train_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const features = extractFeatures(merchant, description, amount, date);

  const stmt = db.prepare(`
    INSERT INTO category_training_data (id, merchant, description, amount, category, features, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    id,
    merchant,
    description,
    amount,
    correctCategory,
    JSON.stringify(features),
    new Date().toISOString(),
  ]);
  stmt.free();
}

/**
 * Get training data statistics
 */
export async function getTrainingStats(): Promise<{
  totalSamples: number;
  samplesPerCategory: Record<string, number>;
  lastTrainingDate: string | null;
}> {
  const db = getDatabase();

  const countStmt = db.prepare('SELECT COUNT(*) as total FROM category_training_data');
  countStmt.step();
  const countRow = countStmt.getAsObject() as { total: number };
  countStmt.free();

  const categoryStmt = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM category_training_data
    GROUP BY category
  `);

  const samplesPerCategory: Record<string, number> = {};
  while (categoryStmt.step()) {
    const row = categoryStmt.getAsObject() as { category: string; count: number };
    samplesPerCategory[row.category] = row.count;
  }
  categoryStmt.free();

  const dateStmt = db.prepare('SELECT MAX(created_at) as last_date FROM category_training_data');
  dateStmt.step();
  const dateRow = dateStmt.getAsObject() as { last_date: string | null };
  dateStmt.free();

  return {
    totalSamples: countRow.total,
    samplesPerCategory,
    lastTrainingDate: dateRow.last_date,
  };
}

/**
 * Batch categorize uncategorized transactions
 */
export async function batchCategorize(dryRun: boolean = true): Promise<{
  categorized: number;
  suggestions: Array<{
    transactionId: string;
    merchant: string;
    currentCategory: string;
    suggestedCategory: string;
    confidence: number;
  }>;
}> {
  const db = getDatabase();

  // Get uncategorized or "其他" transactions
  const stmt = db.prepare(`
    SELECT id, counterparty, description, amount, date, category
    FROM transactions
    WHERE category IS NULL OR category = '' OR category = '其他'
    ORDER BY date DESC
    LIMIT 100
  `);

  const suggestions: Array<{
    transactionId: string;
    merchant: string;
    currentCategory: string;
    suggestedCategory: string;
    confidence: number;
  }> = [];

  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      counterparty: string | null;
      description: string | null;
      amount: number;
      date: string;
      category: string | null;
    };

    const prediction = predictCategory(
      row.counterparty || '',
      row.description || '',
      row.amount,
      row.date
    );

    if (prediction.confidence > 0.6 && prediction.category !== '其他') {
      suggestions.push({
        transactionId: row.id,
        merchant: row.counterparty || row.description || 'Unknown',
        currentCategory: row.category || '其他',
        suggestedCategory: prediction.category,
        confidence: prediction.confidence,
      });

      if (!dryRun) {
        // Apply the category
        const updateStmt = db.prepare('UPDATE transactions SET category = ?, updated_at = ? WHERE id = ?');
        updateStmt.run([prediction.category, new Date().toISOString(), row.id]);
        updateStmt.free();
      }
    }
  }

  stmt.free();

  return {
    categorized: suggestions.length,
    suggestions,
  };
}

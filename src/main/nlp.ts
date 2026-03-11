export interface ParsedTransaction {
  amount?: number;
  description?: string;
  merchant?: string;
  category?: string;
  date?: string;
  type: 'expense' | 'income';
  confidence: number;
}

export interface ParsedCommand {
  action: 'add' | 'show' | 'query' | 'unknown';
  target?: string;
  filters?: Record<string, string>;
  transaction?: ParsedTransaction;
}

// Date parsing patterns
const DATE_PATTERNS = [
  { pattern: /today|今天/, daysOffset: 0 },
  { pattern: /yesterday|昨天/, daysOffset: -1 },
  { pattern: /tomorrow|明天/, daysOffset: 1 },
  { pattern: /last week|上周/, daysOffset: -7 },
  { pattern: /next week|下周/, daysOffset: 7 },
  { pattern: /(\d{1,2})\/(\d{1,2})/, isRegex: true }, // 3/15, 12/25
  { pattern: /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/, isRegex: true }, // 2024-03-15
];

// Amount patterns
const AMOUNT_PATTERNS = [
  /([¥$€])\s*(\d+(?:\.\d{1,2})?)/, // ¥45, $50
  /(\d+(?:\.\d{1,2})?)\s*(?:yuan|元|dollars?|bucks?)/i, // 45 yuan, 50 dollars
  /(\d+(?:\.\d{1,2})?)\s*(?:块|毛|分)/, // Chinese amounts
  /(?:for|cost|spent|paid)\s+(\d+(?:\.\d{1,2})?)/i, // spent 45
  /(\d+(?:\.\d{1,2})?)\s*(?:at|for|to)/i, // 45 at McDonalds
];

// Merchant patterns
const MERCHANT_PATTERNS = [
  /(?:at|@)\s+([A-Za-z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5]*)/i, // at McDonalds, @星巴克
  /(?:from|with)\s+([A-Za-z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5]*)/i, // from Amazon
  /(?:bought|purchased|got)\s+(?:.*?)\s+(?:from|at)\s+([A-Za-z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5]*)/i, // bought coffee at Starbucks
];

// Category patterns
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '餐饮': ['lunch', 'dinner', 'breakfast', 'coffee', 'meal', 'food', '餐厅', '饭', '吃'],
  '交通': ['gas', 'fuel', 'taxi', 'uber', 'subway', 'bus', 'transport', '地铁', '打车'],
  '购物': ['shopping', 'bought', 'purchased', 'bought', '买', '购物'],
  '娱乐': ['movie', 'game', 'entertainment', 'fun', '电影', '玩'],
};

// Command patterns
const COMMAND_PATTERNS = {
  add: /^(?:add|create|new|record|记|添加|新增)\s+/i,
  show: /^(?:show|display|view|see|看|显示|查看)\s+/i,
  query: /^(?:what|how much|查询|多少|查询)\s+/i,
};

/**
 * Parse natural language input into structured data
 */
export function parseNaturalLanguage(input: string): ParsedCommand {
  const normalized = input.trim();

  // Detect command type
  let action: 'add' | 'show' | 'query' | 'unknown' = 'unknown';
  for (const [cmd, pattern] of Object.entries(COMMAND_PATTERNS)) {
    if (pattern.test(normalized)) {
      action = cmd as 'add' | 'show' | 'query';
      break;
    }
  }

  // Try to parse as transaction
  const transaction = parseTransaction(normalized);

  if (transaction.amount || transaction.merchant || transaction.description) {
    return {
      action: action === 'unknown' ? 'add' : action,
      transaction,
    };
  }

  // Try to parse as query
  const query = parseQuery(normalized);
  if (query.target) {
    return {
      action: 'query',
      ...query,
    };
  }

  return { action: 'unknown' };
}

/**
 * Parse transaction details from text
 */
function parseTransaction(text: string): ParsedTransaction {
  const result: ParsedTransaction = {
    type: 'expense',
    confidence: 0,
  };

  // Parse amount
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1] || match[2];
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        result.amount = amount;
        result.confidence += 0.3;
        break;
      }
    }
  }

  // Parse date
  const date = parseDate(text);
  if (date) {
    result.date = date;
    result.confidence += 0.2;
  }

  // Parse merchant
  for (const pattern of MERCHANT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      result.merchant = match[1].trim();
      result.confidence += 0.2;
      break;
    }
  }

  // Parse category from keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        result.category = category;
        result.confidence += 0.15;
        break;
      }
    }
    if (result.category) break;
  }

  // Extract description (everything else)
  result.description = extractDescription(text, result);

  return result;
}

/**
 * Parse date from text
 */
function parseDate(text: string): string | undefined {
  const today = new Date();

  for (const dp of DATE_PATTERNS) {
    if (dp.isRegex) {
      const match = text.match(dp.pattern as RegExp);
      if (match) {
        try {
          const date = new Date();
          if (match[3]) {
            // Full date: 2024-03-15
            date.setFullYear(parseInt(match[1]));
            date.setMonth(parseInt(match[2]) - 1);
            date.setDate(parseInt(match[3]));
          } else {
            // Short date: 3/15 (assume current year)
            date.setMonth(parseInt(match[1]) - 1);
            date.setDate(parseInt(match[2]));
          }
          return date.toISOString().split('T')[0];
        } catch {
          continue;
        }
      }
    } else {
      if ((dp.pattern as RegExp).test(text)) {
        const date = new Date(today);
        date.setDate(date.getDate() + (dp.daysOffset || 0));
        return date.toISOString().split('T')[0];
      }
    }
  }

  return undefined;
}

/**
 * Extract description from text
 */
function extractDescription(text: string, parsed: ParsedTransaction): string | undefined {
  // Remove amount, date markers, and merchant markers
  let description = text;

  // Remove amount patterns
  for (const pattern of AMOUNT_PATTERNS) {
    description = description.replace(pattern, '');
  }

  // Remove merchant patterns
  for (const pattern of MERCHANT_PATTERNS) {
    description = description.replace(pattern, '');
  }

  // Remove date keywords
  for (const dp of DATE_PATTERNS) {
    description = description.replace(dp.pattern as RegExp, '');
  }

  // Clean up
  description = description
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/^(?:for|at|from|to|paid|spent|bought)\s+/i, '')
    .replace(/\s+(?:for|at|from|to)$/i, '');

  return description || undefined;
}

/**
 * Parse query commands
 */
function parseQuery(text: string): { target?: string; filters?: Record<string, string> } {
  const patterns = [
    { pattern: /(?:balance|balance)\s+(?:of|for)?\s+(?:my\s+)?(.+)/i, target: 'balance' },
    { pattern: /(?:spending|expenses?)\s+(?:for|on)?\s+(.+)/i, target: 'spending' },
    { pattern: /(?:budget|budget)\s+(?:for)?\s+(.+)/i, target: 'budget' },
    { pattern: /(?:transactions?|records?)\s+(?:for|from)?\s+(.+)/i, target: 'transactions' },
    { pattern: /how much did I spend on (.+)/i, target: 'spending' },
  ];

  for (const { pattern, target } of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        target,
        filters: { category: match[1] },
      };
    }
  }

  return {};
}

/**
 * Format transaction for display
 */
export function formatParsedTransaction(parsed: ParsedTransaction): string {
  const parts: string[] = [];

  if (parsed.amount) {
    parts.push(`¥${parsed.amount.toFixed(2)}`);
  }

  if (parsed.merchant) {
    parts.push(`at ${parsed.merchant}`);
  }

  if (parsed.description) {
    parts.push(`for ${parsed.description}`);
  }

  if (parsed.category) {
    parts.push(`[${parsed.category}]`);
  }

  if (parsed.date) {
    parts.push(`on ${parsed.date}`);
  }

  return parts.join(' ') || 'Unknown transaction';
}

/**
 * Generate examples for voice commands
 */
export const VOICE_EXAMPLES = [
  'Lunch at McDonalds for 45 yuan',
  'Coffee at Starbucks 35',
  'Gas station 200 yesterday',
  'Movie ticket 60 last week',
  'Grocery shopping 150 at Walmart',
  'Taxi ride 25 from airport',
  'Phone bill 89 this month',
];

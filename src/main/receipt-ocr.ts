import { createWorker, PSM } from 'tesseract.js';
import type { ReceiptExtractedData, ReceiptItem } from '../shared/types';

// Receipt OCR patterns for different receipt formats
const AMOUNT_PATTERNS = [
  /(?:总计|合计|总金额|Total|Amount|Grand Total)[:\s]*[¥$]?\s*([\d,]+\.?\d*)/i,
  /[¥$]\s*([\d,]+\.\d{2})/,
  /(\d+\.\d{2})\s*(?:元|CNY|USD)?\s*$/m,
];

const DATE_PATTERNS = [
  /(\d{4}[\-/年]\d{1,2}[\-/月]\d{1,2}[日]?)/,
  /(\d{4}-\d{2}-\d{2})/,
  /(\d{2}\/\d{2}\/\d{4})/,
  /(\d{2}-\d{2}-\d{4})/,
  /(?:日期|Date)[:\s]*(\d{4}[\-/年]\d{1,2}[\-/月]\d{1,2})/i,
];

const MERCHANT_PATTERNS = [
  /(?:商户|商家|店名|Store|Merchant)[:\s]*(.+)/i,
  /^(.+?)\s*(?:便利店|超市|餐厅|咖啡店|药房|百货)/m,
];

const ITEM_PATTERNS = [
  /(.+?)\s+(\d+)\s*[xX×]\s*([\d.]+)/,  // Name Qty x Price
  /(.+?)\s+([\d.]+)\s*元/,             // Name Price元
];

export interface OCRProgress {
  status: string;
  progress: number;
}

export type OCRProgressCallback = (progress: OCRProgress) => void;

export async function processReceiptImage(
  imagePath: string,
  onProgress?: OCRProgressCallback
): Promise<ReceiptExtractedData> {
  const worker = await createWorker('chi_sim+eng');

  try {
    onProgress?.({ status: 'Initializing OCR engine...', progress: 0.1 });

    // Set page segmentation mode for receipts
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    });

    onProgress?.({ status: 'Processing image...', progress: 0.3 });

    const result = await worker.recognize(imagePath);
    const text = result.data.text;
    const confidence = result.data.confidence / 100;

    onProgress?.({ status: 'Extracting receipt data...', progress: 0.7 });

    const extracted = extractReceiptData(text);
    extracted.confidence = confidence;

    onProgress?.({ status: 'Complete', progress: 1.0 });

    return extracted;
  } finally {
    await worker.terminate();
  }
}

export function extractReceiptData(text: string): ReceiptExtractedData {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const amount = extractAmount(text);
  const date = extractDate(text);
  const merchant = extractMerchant(text, lines);
  const items = extractItems(lines);

  return {
    amount,
    date,
    merchant,
    items,
    confidence: 0,
  };
}

function extractAmount(text: string): number | undefined {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
    }
  }
  return undefined;
}

function extractDate(text: string): string | undefined {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const dateStr = match[1]
        .replace(/[年月]/g, '-')
        .replace(/日$/, '');
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  return undefined;
}

function extractMerchant(text: string, lines: string[]): string | undefined {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // Fallback: use first non-empty line that looks like a store name
  for (const line of lines.slice(0, 5)) {
    if (line.length > 2 && line.length < 50 && !/\d{4}/.test(line)) {
      return line;
    }
  }

  return undefined;
}

function extractItems(lines: string[]): ReceiptItem[] | undefined {
  const items: ReceiptItem[] = [];

  for (const line of lines) {
    for (const pattern of ITEM_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        items.push({
          name: match[1].trim(),
          quantity: parseInt(match[2]) || 1,
          price: parseFloat(match[3]),
        });
        break;
      }
    }
  }

  return items.length > 0 ? items : undefined;
}

export function matchReceiptToTransaction(
  receipt: ReceiptExtractedData,
  transactions: { id: string; amount: number; date: string; counterparty?: string }[]
): { transactionId: string | null; confidence: number } {
  let bestMatch: { transactionId: string | null; confidence: number } = {
    transactionId: null,
    confidence: 0,
  };

  for (const txn of transactions) {
    let score = 0;
    let factors = 0;

    // Amount matching (highest weight)
    if (receipt.amount !== undefined) {
      const amountDiff = Math.abs(receipt.amount - Math.abs(txn.amount));
      if (amountDiff < 0.01) {
        score += 1.0;
      } else if (amountDiff < 1) {
        score += 0.8;
      } else if (amountDiff < 5) {
        score += 0.5;
      }
      factors++;
    }

    // Date matching
    if (receipt.date && txn.date) {
      const receiptDate = new Date(receipt.date);
      const txnDate = new Date(txn.date);
      const daysDiff = Math.abs((receiptDate.getTime() - txnDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === 0) {
        score += 1.0;
      } else if (daysDiff <= 1) {
        score += 0.8;
      } else if (daysDiff <= 3) {
        score += 0.5;
      }
      factors++;
    }

    // Merchant matching
    if (receipt.merchant && txn.counterparty) {
      const merchant = receipt.merchant.toLowerCase();
      const counterparty = txn.counterparty.toLowerCase();
      if (merchant === counterparty) {
        score += 1.0;
      } else if (counterparty.includes(merchant) || merchant.includes(counterparty)) {
        score += 0.7;
      } else if (levenshteinDistance(merchant, counterparty) < 3) {
        score += 0.5;
      }
      factors++;
    }

    const confidence = factors > 0 ? score / factors : 0;
    if (confidence > bestMatch.confidence) {
      bestMatch = { transactionId: txn.id, confidence };
    }
  }

  return bestMatch;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

import { Transaction } from '../shared/types';
import { parseBillText } from './billText';

type Source = 'alipay' | 'wechat' | 'yunshanfu' | 'bank';

type TesseractApi = {
  recognize: (
    image: string,
    lang?: string,
    options?: { logger?: (info: { status?: string; progress?: number }) => void }
  ) => Promise<{ data?: { text?: string } }>;
};

export async function parseImageBillWithOcr(filePath: string, source: Source): Promise<Transaction[]> {
  let tesseract: TesseractApi | undefined;
  try {
    tesseract = require('tesseract.js') as TesseractApi;
  } catch {
    throw new Error('未安装 tesseract.js，无法识别图片账单。请执行: npm install tesseract.js');
  }

  const result = await tesseract.recognize(filePath, 'chi_sim+eng');
  return parseBillText(result.data?.text || '', source);
}

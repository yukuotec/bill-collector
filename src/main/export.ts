import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: 'expense' | 'income' | 'transfer';
  category?: string;
  counterparty?: string;
  description?: string;
  source: string;
}

interface CategorySummary {
  category: string;
  total: number;
  count: number;
}

interface MonthlySummary {
  month: string;
  income: number;
  expense: number;
  net: number;
}

interface ExportData {
  transactions: Transaction[];
  categorySummary: CategorySummary[];
  monthlySummary: MonthlySummary[];
  startDate: string;
  endDate: string;
  generatedAt: string;
}

export function generatePDFReport(
  filePath: string,
  data: ExportData
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    stream.on('error', reject);
    doc.pipe(stream);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('财务报告', 50, 50);
    doc.moveDown(0.5);

    // Report period
    doc.fontSize(12).font('Helvetica').text(
      `报告期间: ${data.startDate} 至 ${data.endDate}`,
      { align: 'left' }
    );
    doc.text(`生成时间: ${data.generatedAt}`);
    doc.moveDown(1);

    // Summary section
    doc.fontSize(16).font('Helvetica-Bold').text('收支概览');
    doc.moveDown(0.5);

    const totalIncome = data.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = data.transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const netAmount = totalIncome - totalExpense;

    doc.fontSize(12).font('Helvetica');
    doc.text(`总收入: ¥${totalIncome.toFixed(2)}`);
    doc.text(`总支出: ¥${totalExpense.toFixed(2)}`);
    doc.text(`净收支: ¥${netAmount.toFixed(2)}`, { underline: netAmount < 0 });
    doc.moveDown(1);

    // Category summary
    if (data.categorySummary.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('分类统计');
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('分类', 50, doc.y, { width: 150 });
      doc.text('金额', 200, doc.y, { width: 100, align: 'right' });
      doc.text('笔数', 300, doc.y, { width: 80, align: 'right' });
      doc.moveDown(0.3);

      doc.fontSize(10).font('Helvetica');
      data.categorySummary.forEach((cat) => {
        if (doc.y > 700) {
          doc.addPage();
        }
        doc.text(cat.category || '未分类', 50, doc.y, { width: 150 });
        doc.text(`¥${cat.total.toFixed(2)}`, 200, doc.y, { width: 100, align: 'right' });
        doc.text(cat.count.toString(), 300, doc.y, { width: 80, align: 'right' });
        doc.moveDown(0.3);
      });
      doc.moveDown(1);
    }

    // Monthly trend
    if (data.monthlySummary.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('月度趋势');
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('月份', 50, doc.y, { width: 100 });
      doc.text('收入', 150, doc.y, { width: 100, align: 'right' });
      doc.text('支出', 250, doc.y, { width: 100, align: 'right' });
      doc.text('净收支', 350, doc.y, { width: 100, align: 'right' });
      doc.moveDown(0.3);

      doc.fontSize(10).font('Helvetica');
      data.monthlySummary.forEach((month) => {
        if (doc.y > 700) {
          doc.addPage();
        }
        doc.text(month.month, 50, doc.y, { width: 100 });
        doc.text(`¥${month.income.toFixed(2)}`, 150, doc.y, { width: 100, align: 'right' });
        doc.text(`¥${month.expense.toFixed(2)}`, 250, doc.y, { width: 100, align: 'right' });
        doc.text(`¥${month.net.toFixed(2)}`, 350, doc.y, { width: 100, align: 'right' });
        doc.moveDown(0.3);
      });
      doc.moveDown(1);
    }

    // Transaction details
    if (data.transactions.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('交易明细');
      doc.moveDown(0.5);

      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('日期', 50, doc.y, { width: 70 });
      doc.text('类型', 120, doc.y, { width: 50 });
      doc.text('分类', 170, doc.y, { width: 80 });
      doc.text('交易方', 250, doc.y, { width: 100 });
      doc.text('金额', 350, doc.y, { width: 80, align: 'right' });
      doc.moveDown(0.3);

      doc.fontSize(8).font('Helvetica');
      data.transactions.slice(0, 100).forEach((t) => {
        if (doc.y > 720) {
          doc.addPage();
          // Re-add headers on new page
          doc.fontSize(8).font('Helvetica-Bold');
          doc.text('日期', 50, doc.y, { width: 70 });
          doc.text('类型', 120, doc.y, { width: 50 });
          doc.text('分类', 170, doc.y, { width: 80 });
          doc.text('交易方', 250, doc.y, { width: 100 });
          doc.text('金额', 350, doc.y, { width: 80, align: 'right' });
          doc.moveDown(0.3);
          doc.fontSize(8).font('Helvetica');
        }

        const typeLabel = t.type === 'income' ? '收入' : t.type === 'expense' ? '支出' : '转账';
        doc.text(t.date, 50, doc.y, { width: 70 });
        doc.text(typeLabel, 120, doc.y, { width: 50 });
        doc.text(t.category || '-', 170, doc.y, { width: 80 });
        doc.text(t.counterparty || '-', 250, doc.y, { width: 100 });
        const amountStr = t.type === 'income' ? `+¥${t.amount.toFixed(2)}` : `-¥${t.amount.toFixed(2)}`;
        doc.text(amountStr, 350, doc.y, { width: 80, align: 'right' });
        doc.moveDown(0.25);
      });

      if (data.transactions.length > 100) {
        doc.moveDown(0.5);
        doc.fontSize(10).text(`... 还有 ${data.transactions.length - 100} 条交易记录未显示`, { align: 'center' });
      }
    }

    doc.end();
    stream.on('finish', resolve);
  });
}

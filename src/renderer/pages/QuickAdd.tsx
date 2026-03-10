import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { getSupportedCurrencies, getCurrencyName, getCurrencySymbol } from '../../shared/currency';

interface QuickAddProps {
  onClose?: () => void;
}

// Default categories
const DEFAULT_CATEGORIES = [
  '餐饮',
  '交通',
  '购物',
  '娱乐',
  '居住',
  '医疗',
  '教育',
  '通讯',
  '服装',
  '日用',
  '旅行',
  '礼物',
  '投资',
  '其他',
];

// Transaction Template
interface TransactionTemplate {
  id: string;
  name: string;
  amount: number;
  category: string;
  counterparty: string;
  type: 'expense' | 'income';
  memberId: string;
  createdAt: string;
}

export default function QuickAdd({ onClose }: QuickAddProps) {
  // Form state
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [category, setCategory] = useState('其他');
  const [counterparty, setCounterparty] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [memberId, setMemberId] = useState<string>('');
  const [type, setType] = useState<'expense' | 'income'>('expense');

  // Data for dropdowns
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [merchants, setMerchants] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; color: string }[]>([]);
  const [supportedCurrencies] = useState<string[]>(getSupportedCurrencies());
  
  // Autocomplete state
  const [showMerchantSuggestions, setShowMerchantSuggestions] = useState(false);
  const [filteredMerchants, setFilteredMerchants] = useState<string[]>([]);
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  // Template state
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Smart suggestion state
  const [merchantCategoryMap, setMerchantCategoryMap] = useState<Record<string, string>>({});
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [showCategorySuggestion, setShowCategorySuggestion] = useState(false);

  // Refs
  const amountInputRef = useRef<HTMLInputElement>(null);
  const merchantInputRef = useRef<HTMLInputElement>(null);
  
  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load categories
        const loadedCategories = await window.electronAPI.getCategories();
        if (loadedCategories && loadedCategories.length > 0) {
          setCategories([...new Set([...DEFAULT_CATEGORIES, ...loadedCategories])]);
        }
        
        // Load merchant history
        const loadedMerchants = await window.electronAPI.getMerchantHistory(30);
        setMerchants(loadedMerchants);
        
        // Load members
        const loadedMembers = await window.electronAPI.getMembers();
        setMembers(loadedMembers);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };
    
    loadData();
    
    // Auto-focus amount input on mount
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 100);
  }, []);
  
  // Handle merchant autocomplete
  useEffect(() => {
    if (counterparty.trim()) {
      const filtered = merchants.filter(m =>
        m.toLowerCase().includes(counterparty.toLowerCase())
      ).slice(0, 5);
      setFilteredMerchants(filtered);
      setShowMerchantSuggestions(filtered.length > 0);

      // Smart category suggestion based on merchant
      const suggested = merchantCategoryMap[counterparty.trim()];
      if (suggested && suggested !== category) {
        setSuggestedCategory(suggested);
        setShowCategorySuggestion(true);
      }
    } else {
      setShowMerchantSuggestions(false);
      setShowCategorySuggestion(false);
    }
  }, [counterparty, merchants, merchantCategoryMap, category]);

  // Load templates from localStorage
  useEffect(() => {
    const savedTemplates = localStorage.getItem('expense-templates');
    if (savedTemplates) {
      try {
        setTemplates(JSON.parse(savedTemplates));
      } catch (e) {
        console.error('Failed to load templates:', e);
      }
    }
  }, []);

  // Build merchant-category mapping from transaction history
  useEffect(() => {
    const buildCategoryMap = async () => {
      try {
        // Get recent transactions to build merchant->category mapping
        const result = await window.electronAPI.getTransactions({
          page: 1,
          pageSize: 200,
          sortBy: 'date',
          sortOrder: 'desc',
        });

        const mapping: Record<string, string> = {};
        result.items.forEach((txn) => {
          if (txn.counterparty && txn.category) {
            // Keep the most recent category for each merchant
            if (!mapping[txn.counterparty]) {
              mapping[txn.counterparty] = txn.category;
            }
          }
        });
        setMerchantCategoryMap(mapping);
      } catch (error) {
        console.error('Failed to build category map:', error);
      }
    };

    buildCategoryMap();
  }, []);
  
  // Reset form
  const resetForm = () => {
    setAmount('');
    setCategory('其他');
    setCounterparty('');
    setDate(new Date().toISOString().split('T')[0]);
    setMemberId('');
    setType('expense');
    setMessage(null);
    setLastSavedId(null);
    setShowCategorySuggestion(false);
    amountInputRef.current?.focus();
  };

  // Template functions
  const saveTemplate = () => {
    const amountNum = parseFloat(amount);
    if (!templateName.trim() || isNaN(amountNum) || amountNum <= 0) {
      setMessage({ type: 'error', text: '请输入模板名称和有效金额' });
      return;
    }

    const newTemplate: TransactionTemplate = {
      id: `template-${Date.now()}`,
      name: templateName.trim(),
      amount: amountNum,
      category,
      counterparty,
      type,
      memberId,
      createdAt: new Date().toISOString(),
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem('expense-templates', JSON.stringify(updatedTemplates));
    setShowSaveTemplate(false);
    setTemplateName('');
    setMessage({ type: 'success', text: '模板已保存' });
  };

  const loadTemplate = (template: TransactionTemplate) => {
    setAmount(template.amount.toString());
    setCategory(template.category);
    setCounterparty(template.counterparty);
    setType(template.type);
    if (template.memberId) {
      setMemberId(template.memberId);
    }
    setShowTemplates(false);
    setMessage({ type: 'success', text: `已加载模板: ${template.name}` });
  };

  const deleteTemplate = (id: string) => {
    const updatedTemplates = templates.filter(t => t.id !== id);
    setTemplates(updatedTemplates);
    localStorage.setItem('expense-templates', JSON.stringify(updatedTemplates));
  };

  const applySuggestedCategory = () => {
    if (suggestedCategory) {
      setCategory(suggestedCategory);
      setShowCategorySuggestion(false);
    }
  };

  // Handle save
  const handleSave = async (continueAdding: boolean = false) => {
    // Validate
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setMessage({ type: 'error', text: '请输入有效金额' });
      return;
    }
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      const result = await window.electronAPI.createTransaction({
        source: 'manual',
        date,
        amount: amountNum,
        type,
        category,
        counterparty: counterparty || undefined,
        member_id: memberId || null,
        currency,
      });
      
      if (result.success && result.id) {
        setLastSavedId(result.id);
        setMessage({ type: 'success', text: continueAdding ? '已保存，继续添加...' : '保存成功' });
        
        if (continueAdding) {
          // Short delay then reset for next entry
          setTimeout(resetForm, 800);
        } else if (onClose) {
          setTimeout(() => onClose(), 1000);
        }
      } else {
        setMessage({ type: 'error', text: result.error || '保存失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+Enter or Cmd+Enter to save and continue
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave(true);
    }
    // Enter to save and close
    if (e.key === 'Enter' && e.target === amountInputRef.current) {
      // Move focus to next field instead of submitting
      const select = document.getElementById('category-select') as HTMLSelectElement;
      if (select) select.focus();
    }
  };
  
  // Handle merchant suggestion click
  const selectMerchant = (merchant: string) => {
    setCounterparty(merchant);
    setShowMerchantSuggestions(false);
  };

  return (
    <div className="quick-add">
      <div className="quick-add-header">
        <h2>⚡ 快速记账</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {templates.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() => setShowTemplates(!showTemplates)}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              📋 模板 ({templates.length})
            </button>
          )}
          {onClose && (
            <button className="close-btn" onClick={onClose}>✕</button>
          )}
        </div>
      </div>

      {/* Templates Panel */}
      {showTemplates && (
        <div className="templates-panel" style={{
          background: '#F8FAFC',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>📋 快速模板</span>
            <button
              onClick={() => setShowTemplates(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>
          {templates.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: '13px' }}>暂无模板，填写表单后点击"保存为模板"</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {templates.map(template => (
                <div
                  key={template.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'white',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB',
                    cursor: 'pointer'
                  }}
                  onClick={() => loadTemplate(template)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: 500, fontSize: '13px' }}>{template.name}</span>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>
                      {template.type === 'expense' ? '支出' : '收入'} · {template.category} · ¥{template.amount.toFixed(2)}
                      {template.counterparty && ` · ${template.counterparty}`}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteTemplate(template.id); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#EF4444',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '4px'
                    }}
                    title="删除模板"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="quick-add-form">
        {/* Type Toggle */}
        <div className="form-group type-toggle">
          <button
            type="button"
            className={`type-btn ${type === 'expense' ? 'active expense' : ''}`}
            onClick={() => setType('expense')}
          >
            支出
          </button>
          <button
            type="button"
            className={`type-btn ${type === 'income' ? 'active income' : ''}`}
            onClick={() => setType('income')}
          >
            收入
          </button>
        </div>
        
        {/* Amount Input */}
        <div className="form-group">
          <label htmlFor="amount-input">
            <span className="label-icon">💰</span>
            金额
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="amount-input-wrapper" style={{ flex: 1 }}>
              <span className="currency">{getCurrencySymbol(currency)}</span>
              <input
                ref={amountInputRef}
                id="amount-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{ width: '100px', padding: '8px' }}
            >
              {supportedCurrencies.map(curr => (
                <option key={curr} value={curr}>{curr}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Category Select */}
        <div className="form-group">
          <label htmlFor="category-select">
            <span className="label-icon">📂</span>
            分类
          </label>
          <select
            id="category-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {/* Smart Category Suggestion */}
          {showCategorySuggestion && suggestedCategory && (
            <div style={{
              marginTop: '6px',
              padding: '6px 10px',
              background: '#DBEAFE',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px'
            }}>
              <span>
                💡 推荐分类: <strong>{suggestedCategory}</strong>
              </span>
              <button
                onClick={applySuggestedCategory}
                style={{
                  padding: '2px 8px',
                  fontSize: '12px',
                  background: '#3B82F6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                应用
              </button>
            </div>
          )}
        </div>
        
        {/* Merchant Input with Autocomplete */}
        <div className="form-group">
          <label htmlFor="merchant-input">
            <span className="label-icon">🏪</span>
            商户
          </label>
          <div className="autocomplete-wrapper">
            <input
              ref={merchantInputRef}
              id="merchant-input"
              type="text"
              placeholder="输入商户名称（可选）"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              onFocus={() => counterparty && setShowMerchantSuggestions(filteredMerchants.length > 0)}
              onBlur={() => setTimeout(() => setShowMerchantSuggestions(false), 200)}
            />
            {showMerchantSuggestions && (
              <ul className="autocomplete-suggestions">
                {filteredMerchants.map((merchant, idx) => (
                  <li key={idx} onClick={() => selectMerchant(merchant)}>
                    {merchant}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        {/* Date Picker */}
        <div className="form-group">
          <label htmlFor="date-input">
            <span className="label-icon">📅</span>
            日期
          </label>
          <input
            id="date-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        
        {/* Member Select (only if members exist) */}
        {members.length > 0 && (
          <div className="form-group">
            <label htmlFor="member-select">
              <span className="label-icon">👤</span>
              成员
            </label>
            <select
              id="member-select"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              <option value="">未分配</option>
              {members.map(member => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {/* Message */}
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="form-actions">
          <button
            className="btn btn-secondary"
            onClick={() => handleSave(true)}
            disabled={isSubmitting}
          >
            保存并继续
            <span className="shortcut">Ctrl+Enter</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
          >
            {isSubmitting ? '保存中...' : '保存并关闭'}
          </button>
        </div>

        {/* Save as Template Button */}
        <div style={{ marginTop: '12px', textAlign: 'center' }}>
          {!showSaveTemplate ? (
            <button
              onClick={() => {
                const amountNum = parseFloat(amount);
                if (isNaN(amountNum) || amountNum <= 0) {
                  setMessage({ type: 'error', text: '请先输入有效金额' });
                  return;
                }
                setShowSaveTemplate(true);
                setTemplateName(counterparty || `${category} - ¥${amount}`);
              }}
              style={{
                background: 'none',
                border: '1px dashed #9CA3AF',
                color: '#6B7280',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              ➕ 保存为模板
            </button>
          ) : (
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              background: '#F3F4F6',
              borderRadius: '6px'
            }}>
              <input
                type="text"
                placeholder="模板名称"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveTemplate()}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '4px',
                  fontSize: '13px',
                  flex: 1
                }}
              />
              <button
                onClick={saveTemplate}
                style={{
                  padding: '6px 12px',
                  background: '#10B981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                保存
              </button>
              <button
                onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }}
                style={{
                  padding: '6px 12px',
                  background: '#9CA3AF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                取消
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
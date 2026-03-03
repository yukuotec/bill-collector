import { useState, useEffect, useRef, KeyboardEvent } from 'react';

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

export default function QuickAdd({ onClose }: QuickAddProps) {
  // Form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('其他');
  const [counterparty, setCounterparty] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [memberId, setMemberId] = useState<string>('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  
  // Data for dropdowns
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [merchants, setMerchants] = useState<string[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; color: string }[]>([]);
  
  // Autocomplete state
  const [showMerchantSuggestions, setShowMerchantSuggestions] = useState(false);
  const [filteredMerchants, setFilteredMerchants] = useState<string[]>([]);
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  
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
    } else {
      setShowMerchantSuggestions(false);
    }
  }, [counterparty, merchants]);
  
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
    amountInputRef.current?.focus();
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
        {onClose && (
          <button className="close-btn" onClick={onClose}>✕</button>
        )}
      </div>
      
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
          <div className="amount-input-wrapper">
            <span className="currency">¥</span>
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
      </div>
    </div>
  );
}
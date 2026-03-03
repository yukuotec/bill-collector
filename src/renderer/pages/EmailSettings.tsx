import { useEffect, useState } from 'react';
import { EmailAccount, EmailMessage } from '../../shared/types';

// Common email providers with IMAP settings
const EMAIL_PROVIDERS = {
  '163': {
    email: '@163.com',
    imap_host: 'imap.163.com',
    imap_port: 993,
    smtp_host: 'smtp.163.com',
    smtp_port: 465,
  },
  'qq': {
    email: '@qq.com',
    imap_host: 'imap.qq.com',
    imap_port: 993,
    smtp_host: 'smtp.qq.com',
    smtp_port: 465,
  },
  '126': {
    email: '@126.com',
    imap_host: 'imap.126.com',
    imap_port: 993,
    smtp_host: 'smtp.126.com',
    smtp_port: 465,
  },
  'gmail': {
    email: '@gmail.com',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 465,
  },
  'outlook': {
    email: '@outlook.com',
    imap_host: 'imap.outlook.com',
    imap_port: 993,
    smtp_host: 'smtp.outlook.com',
    smtp_port: 587,
  },
  'custom': {
    email: '',
    imap_host: '',
    imap_port: 993,
    smtp_host: '',
    smtp_port: 465,
  },
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function EmailSettings() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  
  // Form state
  const [email, setEmail] = useState('');
  const [provider, setProvider] = useState('163');
  const [imapHost, setImapHost] = useState('imap.163.com');
  const [imapPort, setImapPort] = useState(993);
  const [smtpHost, setSmtpHost] = useState('smtp.163.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  
  // View state
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await window.electronAPI.getEmailAccounts();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load email accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    if (newProvider !== 'custom' && EMAIL_PROVIDERS[newProvider as keyof typeof EMAIL_PROVIDERS]) {
      const p = EMAIL_PROVIDERS[newProvider as keyof typeof EMAIL_PROVIDERS];
      setImapHost(p.imap_host);
      setImapPort(p.imap_port);
      setSmtpHost(p.smtp_host);
      setSmtpPort(p.smtp_port);
      
      // Auto-fill username if email is set
      if (email) {
        const emailPrefix = email.split('@')[0];
        setUsername(emailPrefix);
      }
    }
  };

  const handleEmailChange = (newEmail: string) => {
    setEmail(newEmail);
    
    // Auto-detect provider from email
    if (newEmail.includes('@163.com')) {
      handleProviderChange('163');
    } else if (newEmail.includes('@qq.com')) {
      handleProviderChange('qq');
    } else if (newEmail.includes('@126.com')) {
      handleProviderChange('126');
    } else if (newEmail.includes('@gmail.com')) {
      handleProviderChange('gmail');
    } else if (newEmail.includes('@outlook.com')) {
      handleProviderChange('outlook');
    } else if (newEmail.includes('@')) {
      handleProviderChange('custom');
    }
    
    // Update username
    const emailPrefix = newEmail.split('@')[0];
    if (emailPrefix) {
      setUsername(emailPrefix);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !username || !password) {
      setMessage('请填写完整的邮箱信息');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const id = generateId();
      await window.electronAPI.addEmailAccount(
        id,
        email,
        imapHost,
        imapPort,
        smtpHost,
        smtpPort,
        username,
        password
      );
      
      // Reload accounts
      await loadAccounts();
      
      // Reset form
      setShowAddForm(false);
      setEmail('');
      setPassword('');
      setMessage('邮箱账户添加成功！');
    } catch (error) {
      setMessage(`添加失败: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个邮箱账户吗？')) return;
    
    try {
      await window.electronAPI.deleteEmailAccount(id);
      await loadAccounts();
      if (selectedAccount?.id === id) {
        setSelectedAccount(null);
        setMessages([]);
      }
      setMessage('邮箱账户已删除');
    } catch (error) {
      setMessage(`删除失败: ${String(error)}`);
    }
  };

  const handleSync = async (accountId: string) => {
    setSyncing(accountId);
    setMessage('');

    try {
      const result = await window.electronAPI.syncEmails(accountId);
      
      if (result.success) {
        setMessage(`同步完成：找到 ${result.emailsFound} 封邮件，下载 ${result.attachmentsDownloaded} 个附件`);
      } else {
        setMessage(`同步失败: ${result.errors.join(', ')}`);
      }
      
      // Reload messages if selected
      if (selectedAccount?.id === accountId) {
        loadMessages(accountId);
      }
    } catch (error) {
      setMessage(`同步失败: ${String(error)}`);
    } finally {
      setSyncing(null);
    }
  };

  const handleSelectAccount = async (account: EmailAccount) => {
    setSelectedAccount(account);
    await loadMessages(account.id);
  };

  const loadMessages = async (accountId: string) => {
    setLoadingMessages(true);
    try {
      const data = await window.electronAPI.getEmailMessages(accountId);
      setMessages(data);
    } catch (error) {
      console.error('Failed to load email messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  if (loading) {
    return <div className="page">加载中...</div>;
  }

  return (
    <div className="page email-settings">
      <div className="page-header">
        <h1>📧 邮箱设置</h1>
        <p className="subtitle">管理邮箱账户，自动同步账单和发票邮件</p>
      </div>

      {message && (
        <div className={`message ${message.includes('失败') || message.includes('错误') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {/* Account List */}
      <div className="section">
        <div className="section-header">
          <h2>已配置的邮箱账户</h2>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? '取消' : '+ 添加账户'}
          </button>
        </div>

        {accounts.length === 0 && !showAddForm ? (
          <div className="empty-state">
            <p>还没有配置邮箱账户</p>
            <p className="hint">点击上方按钮添加邮箱账户，自动同步账单和发票</p>
          </div>
        ) : (
          <div className="account-list">
            {accounts.map(account => (
              <div 
                key={account.id} 
                className={`account-card ${selectedAccount?.id === account.id ? 'selected' : ''}`}
                onClick={() => handleSelectAccount(account)}
              >
                <div className="account-info">
                  <div className="account-email">{account.email}</div>
                  <div className="account-meta">
                    <span>IMAP: {account.imap_host}:{account.imap_port}</span>
                    {account.last_sync && (
                      <span>上次同步: {new Date(account.last_sync).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="account-actions">
                  <button
                    className="btn btn-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSync(account.id);
                    }}
                    disabled={syncing === account.id}
                  >
                    {syncing === account.id ? '同步中...' : '🔄 同步'}
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(account.id);
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Account Form */}
      {showAddForm && (
        <div className="section">
          <h2>添加邮箱账户</h2>
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label>邮箱地址</label>
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="yourname@163.com"
                required
              />
            </div>

            <div className="form-group">
              <label>邮箱提供商</label>
              <select value={provider} onChange={(e) => handleProviderChange(e.target.value)}>
                <option value="163">163 邮箱</option>
                <option value="qq">QQ 邮箱</option>
                <option value="126">126 邮箱</option>
                <option value="gmail">Gmail</option>
                <option value="outlook">Outlook</option>
                <option value="custom">自定义</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>IMAP 服务器</label>
                <input
                  type="text"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>IMAP 端口</label>
                <input
                  type="number"
                  value={imapPort}
                  onChange={(e) => setImapPort(parseInt(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>SMTP 服务器</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>SMTP 端口</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(parseInt(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="通常与邮箱地址相同"
                required
              />
            </div>

            <div className="form-group">
              <label>密码 / 授权码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="邮箱密码或授权码"
                required
              />
              <p className="hint">注意：QQ、163 等邮箱需要使用授权码而非登录密码</p>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? '保存中...' : '保存账户'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Email Messages */}
      {selectedAccount && (
        <div className="section">
          <h2>邮件记录 - {selectedAccount.email}</h2>
          
          {loadingMessages ? (
            <div className="loading">加载中...</div>
          ) : messages.length === 0 ? (
            <div className="empty-state">
              <p>还没有同步过邮件</p>
              <p className="hint">点击上方的"同步"按钮搜索账单和发票邮件</p>
            </div>
          ) : (
            <div className="message-list">
              {messages.map(msg => (
                <div key={msg.id} className={`message-item ${msg.processed ? 'processed' : ''}`}>
                  <div className="message-subject">{msg.subject || '(无主题)'}</div>
                  <div className="message-meta">
                    <span>From: {msg.from_address || '未知'}</span>
                    {msg.date && <span>{new Date(msg.date).toLocaleString()}</span>}
                  </div>
                  <div className="message-status">
                    {msg.processed ? '✓ 已处理' : '未处理'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Help Section */}
      <div className="section">
        <h2>使用说明</h2>
        <div className="help-content">
          <h3>支持的邮箱</h3>
          <p>支持所有支持 IMAP 协议的邮箱，包括：163、QQ、126、Gmail、Outlook 等。</p>
          
          <h3>授权码说明</h3>
          <p>大多数现代邮箱需要使用授权码而非登录密码：</p>
          <ul>
            <li><strong>163/126 邮箱</strong>: 设置 → POP3/SMTP/IMAP → 开启 IMAP/SMTP → 获取授权码</li>
            <li><strong>QQ 邮箱</strong>: 设置 → 账户 → POP3/IMAP/SMTP/Exchange 服务 → 开启 IMAP/SMTP → 获取授权码</li>
            <li><strong>Gmail</strong>: 账户 → 安全性 → 应用密码或使用 OAuth</li>
          </ul>
          
          <h3>搜索关键词</h3>
          <p>系统会自动搜索包含以下关键词的邮件：账单、发票、bill、invoice、payment、消费</p>
        </div>
      </div>
    </div>
  );
}
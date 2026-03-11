import { useState, useEffect } from 'react';

interface ReminderSettings {
  budgetAlert: boolean;
  budgetThreshold: number;
  recurringReminder: boolean;
  importReminder: boolean;
  importReminderDay: number;
  dailySummary: boolean;
}

export default function Reminders() {
  const [settings, setSettings] = useState<ReminderSettings>({
    budgetAlert: true,
    budgetThreshold: 80,
    recurringReminder: true,
    importReminder: true,
    importReminderDay: 5,
    dailySummary: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load settings from backend
    const loadSettings = async () => {
      try {
        const config = await window.electronAPI.getReminderConfig();
        setSettings({
          budgetAlert: config.budgetAlerts,
          budgetThreshold: config.budgetThreshold,
          recurringReminder: config.recurringReminders,
          importReminder: config.importReminders,
          importReminderDay: config.importReminderDay,
          dailySummary: false, // Not yet implemented in backend
        });
      } catch (e) {
        console.error('Failed to load reminder settings:', e);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.electronAPI.setReminderConfig({
        budgetAlerts: settings.budgetAlert,
        budgetThreshold: settings.budgetThreshold,
        recurringReminders: settings.recurringReminder,
        importReminders: settings.importReminder,
        importReminderDay: settings.importReminderDay,
      });
      setMessage('✅ 设置已保存');
    } catch (error) {
      setMessage('❌ 保存失败');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const handleTestReminder = async (type: 'budget' | 'recurring' | 'import') => {
    try {
      await window.electronAPI.testReminder(type);
      setMessage(`✅ ${type === 'budget' ? '预算' : type === 'recurring' ? '周期记账' : '导入'}提醒测试已发送`);
    } catch (error) {
      setMessage('❌ 测试失败');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div className="reminders-page">
      <div className="page-header">
        <h2>🔔 智能提醒</h2>
        <p className="page-subtitle">设置各类提醒，不再错过重要财务事项</p>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <h3 className="card-title">提醒设置</h3>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Budget Alert */}
          <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0' }}>💰 预算超支提醒</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
                  当预算使用达到设定比例时提醒
                </p>
              </div>
              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '48px',
                height: '24px'
              }}>
                <input
                  type="checkbox"
                  checked={settings.budgetAlert}
                  onChange={(e) => setSettings({ ...settings, budgetAlert: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: settings.budgetAlert ? '#10B981' : '#9CA3AF',
                  borderRadius: '24px',
                  transition: '0.3s'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '',
                    height: '18px',
                    width: '18px',
                    left: settings.budgetAlert ? '26px' : '4px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: '0.3s'
                  }} />
                </span>
              </label>
            </div>

            {settings.budgetAlert && (
              <div style={{ marginLeft: '20px' }}>
                <label style={{ fontSize: '13px', color: '#6B7280', display: 'block', marginBottom: '8px' }}>
                  提醒阈值: {settings.budgetThreshold}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={settings.budgetThreshold}
                  onChange={(e) => setSettings({ ...settings, budgetThreshold: parseInt(e.target.value) })}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>

          {/* Recurring Reminder */}
          <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0' }}>📅 周期记账提醒</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
                  周期交易生成后发送通知
                </p>
              </div>
              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '48px',
                height: '24px'
              }}>
                <input
                  type="checkbox"
                  checked={settings.recurringReminder}
                  onChange={(e) => setSettings({ ...settings, recurringReminder: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: settings.recurringReminder ? '#10B981' : '#9CA3AF',
                  borderRadius: '24px',
                  transition: '0.3s'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '',
                    height: '18px',
                    width: '18px',
                    left: settings.recurringReminder ? '26px' : '4px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: '0.3s'
                  }} />
                </span>
              </label>
            </div>
          </div>

          {/* Import Reminder */}
          <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0' }}>📥 数据导入提醒</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
                  提醒导入最新账单数据
                </p>
              </div>
              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '48px',
                height: '24px'
              }}>
                <input
                  type="checkbox"
                  checked={settings.importReminder}
                  onChange={(e) => setSettings({ ...settings, importReminder: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: settings.importReminder ? '#10B981' : '#9CA3AF',
                  borderRadius: '24px',
                  transition: '0.3s'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '',
                    height: '18px',
                    width: '18px',
                    left: settings.importReminder ? '26px' : '4px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: '0.3s'
                  }} />
                </span>
              </label>
            </div>

            {settings.importReminder && (
              <div style={{ marginLeft: '20px', marginTop: '12px' }}>
                <label style={{ fontSize: '13px', color: '#6B7280', display: 'block', marginBottom: '8px' }}>
                  每月提醒日期: {settings.importReminderDay}号
                </label>
                <input
                  type="range"
                  min="1"
                  max="28"
                  value={settings.importReminderDay}
                  onChange={(e) => setSettings({ ...settings, importReminderDay: parseInt(e.target.value) })}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
                  <span>1号</span>
                  <span>28号</span>
                </div>
              </div>
            )}
          </div>

          {/* Daily Summary */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0' }}>📊 每日收支摘要</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
                  每天发送前日收支汇总
                </p>
              </div>
              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '48px',
                height: '24px'
              }}>
                <input
                  type="checkbox"
                  checked={settings.dailySummary}
                  onChange={(e) => setSettings({ ...settings, dailySummary: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: settings.dailySummary ? '#10B981' : '#9CA3AF',
                  borderRadius: '24px',
                  transition: '0.3s'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '',
                    height: '18px',
                    width: '18px',
                    left: settings.dailySummary ? '26px' : '4px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: '0.3s'
                  }} />
                </span>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', padding: '12px' }}
          >
            {saving ? '保存中...' : '💾 保存设置'}
          </button>

          {message && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: '#D1FAE5',
              color: '#059669',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              {message}
            </div>
          )}

          {/* Test Buttons */}
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #E5E7EB' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#374151' }}>测试提醒</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-secondary"
                onClick={() => handleTestReminder('budget')}
                style={{ flex: 1, padding: '8px', fontSize: '13px' }}
              >
                💰 预算提醒
              </button>
              <button
                className="btn-secondary"
                onClick={() => handleTestReminder('recurring')}
                style={{ flex: 1, padding: '8px', fontSize: '13px' }}
              >
                📅 周期记账
              </button>
              <button
                className="btn-secondary"
                onClick={() => handleTestReminder('import')}
                style={{ flex: 1, padding: '8px', fontSize: '13px' }}
              >
                📥 导入提醒
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="card" style={{ marginTop: '24px', maxWidth: '600px' }}>
        <div className="card-header">
          <h3 className="card-title">已实现功能</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#059669' }}>
            <li>✅ 预算超支桌面通知</li>
            <li>✅ 周期记账自动提醒</li>
            <li>✅ 数据导入定期提醒</li>
            <li>✅ 提醒设置云端同步</li>
          </ul>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="card" style={{ marginTop: '24px', maxWidth: '600px' }}>
        <div className="card-header">
          <h3 className="card-title">即将推出</h3>
        </div>
        <div style={{ padding: '20px' }}>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#6B7280' }}>
            <li>邮件通知</li>
            <li>微信/钉钉机器人集成</li>
            <li>自定义提醒规则</li>
            <li>提醒历史记录</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Member } from '../../shared/types';

interface MembersProps {
  locationSearch: string;
}

const MEMBER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#EF4444', // red
  '#8B5CF6', // purple
  '#F59E0B', // orange
  '#EC4899', // pink
  '#14B8A6', // teal
  '#6366F1', // indigo
];

export default function Members({ locationSearch }: MembersProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(MEMBER_COLORS[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadMembers = async () => {
    try {
      const data = await window.electronAPI.getMembers();
      setMembers(data);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleAddMember = async () => {
    if (!newName.trim()) return;
    
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    await window.electronAPI.addMember(id, newName.trim(), newColor);
    
    setNewName('');
    setNewColor(MEMBER_COLORS[0]);
    setShowAddForm(false);
    await loadMembers();
  };

  const handleUpdateMember = async () => {
    if (!editingMember || !newName.trim()) return;
    
    await window.electronAPI.updateMember(editingMember.id, newName.trim(), newColor);
    
    setEditingMember(null);
    setNewName('');
    setNewColor(MEMBER_COLORS[0]);
    await loadMembers();
  };

  const handleDeleteMember = async (id: string) => {
    await window.electronAPI.deleteMember(id);
    setDeleteConfirm(null);
    await loadMembers();
  };

  const startEdit = (member: Member) => {
    setEditingMember(member);
    setNewName(member.name);
    setNewColor(member.color);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingMember(null);
    setNewName('');
    setNewColor(MEMBER_COLORS[0]);
    setShowAddForm(false);
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div className="members-page">
      <div className="page-header">
        <h2>家庭成员</h2>
        <p className="page-subtitle">管理家庭成员，记录各自的支出</p>
      </div>

      <div className="members-toolbar">
        <button className="btn-primary" onClick={() => { setShowAddForm(true); cancelEdit(); }}>
          + 添加成员
        </button>
      </div>

      {(showAddForm || editingMember) && (
        <div className="member-form card">
          <h3>{editingMember ? '编辑成员' : '添加新成员'}</h3>
          <div className="form-group">
            <label htmlFor="member-name">姓名</label>
            <input
              id="member-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="请输入成员姓名"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>颜色</label>
            <div className="color-picker">
              {MEMBER_COLORS.map((color) => (
                <button
                  key={color}
                  className={`color-option ${newColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewColor(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={cancelEdit}>
              取消
            </button>
            <button className="btn-primary" onClick={editingMember ? handleUpdateMember : handleAddMember}>
              {editingMember ? '保存' : '添加'}
            </button>
          </div>
        </div>
      )}

      {members.length === 0 && !showAddForm ? (
        <div className="empty-state card">
          <p>暂无家庭成员</p>
          <p className="empty-hint">点击"添加成员"按钮来添加家庭成员</p>
        </div>
      ) : (
        <div className="members-list">
          <table className="table">
            <thead>
              <tr>
                <th>颜色</th>
                <th>姓名</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <span
                      className="member-color-badge"
                      style={{ backgroundColor: member.color }}
                    />
                  </td>
                  <td className="member-name">{member.name}</td>
                  <td>{member.created_at.split('T')[0]}</td>
                  <td className="actions">
                    <button
                      className="btn-secondary"
                      onClick={() => startEdit(member)}
                    >
                      编辑
                    </button>
                    {deleteConfirm === member.id ? (
                      <>
                        <button
                          className="btn-danger"
                          onClick={() => handleDeleteMember(member.id)}
                        >
                          确认删除
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-danger"
                        onClick={() => setDeleteConfirm(member.id)}
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">💡 使用说明</h3>
        </div>
        <ul className="help-list">
          <li>添加家庭成员后，可以在交易记录中为每笔交易分配成员</li>
          <li>仪表盘会显示各成员的支出占比</li>
          <li>删除成员不会删除相关交易记录，仅解除关联</li>
          <li>可以为每个成员选择不同的颜色以便区分</li>
        </ul>
      </div>
    </div>
  );
}
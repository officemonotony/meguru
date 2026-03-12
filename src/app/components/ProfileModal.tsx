import { useState, useEffect } from 'react';
import { X, User, MapPin, MessageSquare, Lock, Save, Eye, EyeOff, Check } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

type Section = 'basic' | 'delivery' | 'line' | 'security';

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user, profile, role, updateProfile } = useAuth();

  // フォーム状態
  const [shopName, setShopName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryMemo, setDeliveryMemo] = useState('');
  const [lineUserId, setLineUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('basic');
  const [saving, setSaving] = useState(false);

  // モーダルを開くたびにプロフィールから初期化
  useEffect(() => {
    if (open && profile) {
      setShopName(profile.shop_name || '');
      setAvatarUrl(profile.avatar_url || '');
      setDeliveryAddress(profile.delivery_address || '');
      setDeliveryMemo(profile.delivery_memo || '');
      setLineUserId(profile.line_user_id || '');
      setNewPassword('');
      setConfirmPassword('');
      setActiveSection('basic');
    }
  }, [open, profile]);

  if (!open) return null;

  // ========== 保存ハンドラー ==========
  const handleSaveBasic = async () => {
    setSaving(true);
    const { error } = await updateProfile({ shop_name: shopName, avatar_url: avatarUrl || null });
    setSaving(false);
    if (error) toast.error('保存に失敗しました');
    else toast.success('基本情報を保存しました');
  };

  const handleSaveDelivery = async () => {
    setSaving(true);
    const { error } = await updateProfile({
      delivery_address: deliveryAddress || null,
      delivery_memo: deliveryMemo || null,
    });
    setSaving(false);
    if (error) toast.error('保存に失敗しました');
    else toast.success('お届け先情報を保存しました');
  };

  const handleSaveLine = async () => {
    setSaving(true);
    const { error } = await updateProfile({ line_user_id: lineUserId || null });
    setSaving(false);
    if (error) toast.error('保存に失敗しました');
    else toast.success('LINE User IDを保存しました');
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error('パスワードは6文字以上で入力してください'); return; }
    if (newPassword !== confirmPassword) { toast.error('パスワードが一致しません'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) toast.error('パスワード変更に失敗しました');
    else {
      toast.success('パスワードを変更しました');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  // ========== タブ定義 ==========
  const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: '基本情報', icon: <User className="w-4 h-4" /> },
    ...(role === 'restaurant'
      ? [{ id: 'delivery' as Section, label: 'お届け先', icon: <MapPin className="w-4 h-4" /> }]
      : []),
    { id: 'line', label: 'LINE通知', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'security', label: 'セキュリティ', icon: <Lock className="w-4 h-4" /> },
  ];

  const inputClass = 'w-full h-11 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10';
  const saveButtonClass = 'w-full h-11 bg-black text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-black">プロフィール設定</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b border-gray-100 px-1 shrink-0 overflow-x-auto">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeSection === s.id
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* === 基本情報 === */}
          {activeSection === 'basic' && (
            <>
              {/* アバタープレビュー */}
              <div className="flex flex-col items-center gap-2 pb-1">
                <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" onError={() => setAvatarUrl('')} />
                  ) : (
                    <User className="w-10 h-10 text-gray-300" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">アイコン画像URL</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">店舗名・屋号</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">メールアドレス</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full h-11 px-3 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                />
                <p className="text-[11px] text-gray-400 mt-1">メールアドレスは変更できません</p>
              </div>

              <button onClick={handleSaveBasic} disabled={saving || !shopName.trim()} className={saveButtonClass}>
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存する'}
              </button>
            </>
          )}

          {/* === お届け先情報（飲食店のみ）=== */}
          {activeSection === 'delivery' && (
            <>
              <p className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                農家への配送依頼時に参照されます。正確な住所と受け取り方法を登録しておくとスムーズです。
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">お届け先住所</label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="東京都渋谷区〇〇 1-2-3"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">配達メモ</label>
                <textarea
                  value={deliveryMemo}
                  onChange={e => setDeliveryMemo(e.target.value)}
                  placeholder="裏口からお願いします。インターホンを押してください。"
                  rows={4}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
                />
              </div>

              <button onClick={handleSaveDelivery} disabled={saving} className={saveButtonClass}>
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存する'}
              </button>
            </>
          )}

          {/* === LINE通知 === */}
          {activeSection === 'line' && (
            <>
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-semibold text-green-800">LINE User IDの確認方法</p>
                <p className="text-xs text-green-700">メグルの公式LINEアカウントに「ID」と送信すると確認できます。</p>
                <p className="text-xs text-green-600 font-mono">形式: U + 32文字英数字</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">LINE User ID</label>
                <input
                  type="text"
                  value={lineUserId}
                  onChange={e => setLineUserId(e.target.value)}
                  placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className={`${inputClass} font-mono`}
                />
              </div>

              {profile?.line_user_id && (
                <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                  <Check className="w-4 h-4" />
                  LINE通知が有効です
                </div>
              )}

              <button onClick={handleSaveLine} disabled={saving} className={saveButtonClass}>
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存する'}
              </button>
            </>
          )}

          {/* === セキュリティ === */}
          {activeSection === 'security' && (
            <>
              <p className="text-xs text-gray-500">新しいパスワードを設定します（6文字以上）。</p>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">新しいパスワード</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="6文字以上"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">パスワード（確認）</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="もう一度入力"
                  className={inputClass}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-red-500 mt-1">パスワードが一致しません</p>
                )}
              </div>

              <button
                onClick={handleChangePassword}
                disabled={saving || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                className={saveButtonClass}
              >
                <Lock className="w-4 h-4" />
                {saving ? '変更中...' : 'パスワードを変更'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

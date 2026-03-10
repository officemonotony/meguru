import { useState } from 'react';
import { Plus, Calendar, Package, Edit2, Trash2, Check, Send } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { ProposalForm, SubscriptionProposal } from '@/app/components/ProposalForm';
import { toHalfWidth } from '@/app/utils/normalizeNumber';

export interface SubscriptionPlan {
  id: string;
  productId: string;
  productName: string;
  farmerName: string;
  farmerId: string;
  quantity: number;
  unit: string;
  frequency: 'twice_weekly' | 'weekly' | 'biweekly' | 'monthly';
  deliveryDay: string;
  pricePerDelivery: number;
  basePrice: number;
  startDate: string;
  endDate?: string;
  isActive: boolean;
}

interface SubscriptionPlansProps {
  userType: 'farmer' | 'restaurant';
}

const mockPlans: SubscriptionPlan[] = [
  {
    id: 'SUB001',
    productId: 'PROD001',
    productName: 'しいたけ',
    farmerName: '龍ノ傘',
    farmerId: 'FARM001',
    quantity: 3,
    unit: 'kg',
    frequency: 'weekly',
    deliveryDay: '月曜日',
    pricePerDelivery: 2400,
    basePrice: 2400,
    startDate: '2026-02-10',
    endDate: '2026-05-10',
    isActive: true,
  },
  {
    id: 'SUB002',
    productId: 'PROD002',
    productName: 'トマト',
    farmerName: '佐藤農園',
    farmerId: 'FARM002',
    quantity: 5,
    unit: 'kg',
    frequency: 'biweekly',
    deliveryDay: '水曜日',
    pricePerDelivery: 4000,
    basePrice: 4000,
    startDate: '2026-02-05',
    isActive: true,
  },
  {
    id: 'SUB003',
    productId: 'PROD003',
    productName: 'レタス',
    farmerName: '鈴木農園',
    farmerId: 'FARM003',
    quantity: 4,
    unit: 'kg',
    frequency: 'monthly',
    deliveryDay: '毎月1日',
    pricePerDelivery: 2800,
    basePrice: 2800,
    startDate: '2026-03-01',
    endDate: '2026-12-01',
    isActive: true,
  },
];

const frequencyLabels = {
  twice_weekly: '週2回',
  weekly: '週1回',
  biweekly: '隔週',
  monthly: '月1回',
};

export function SubscriptionPlans({ userType }: SubscriptionPlansProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(mockPlans);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);

  const handleToggleActive = (planId: string) => {
    setPlans((prev) =>
      prev.map((plan) =>
        plan.id === planId ? { ...plan, isActive: !plan.isActive } : plan
      )
    );
  };

  const handleDelete = (planId: string) => {
    if (confirm('この定期便プランを削除してもよろしいですか？')) {
      setPlans((prev) => prev.filter((plan) => plan.id !== planId));
    }
  };

  const handleSubscribe = (planId: string) => {
    // 飲食店側での定期便申し込み処理
    alert(`プラン ${planId} に申し込みました`);
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 -mx-4 -mt-4 mb-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {userType === 'farmer'
              ? '定期配送プランを作成・管理します'
              : '定期的に新鮮な野菜をお届けします'}
          </p>
          {userType === 'farmer' && (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-black text-white hover:bg-gray-800 h-10 px-4 text-sm font-bold rounded-lg"
            >
              <Plus className="w-4 h-4 mr-1" />
              新規作成
            </Button>
          )}
        </div>
      </div>

      {/* プラン一覧 */}
      <div className="space-y-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white border-2 rounded-xl p-4 transition-all ${
              plan.isActive ? 'border-gray-300' : 'border-gray-200 opacity-60'
            }`}
          >
            {/* プランヘッダー */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-black">{plan.productName}</h3>
                  {!plan.isActive && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                      停止中
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2">{plan.farmerName}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {frequencyLabels[plan.frequency]}
                  </div>
                  <div>{plan.deliveryDay}</div>
                </div>
              </div>
              {userType === 'farmer' && (
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => setEditingPlan(plan)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              )}
            </div>

            {/* 内容 */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="text-sm font-bold text-black">
                {plan.quantity}{plan.unit} / 回
              </div>
            </div>

            {/* 期間と価格 */}
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">開始日</span>
                <span className="text-black font-bold">
                  {new Date(plan.startDate).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              {plan.endDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">終了日</span>
                  <span className="text-black font-bold">
                    {new Date(plan.endDate).toLocaleDateString('ja-JP', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm font-bold text-black">1回あたり</span>
                <span className="text-xl font-bold text-black">
                  ¥{plan.pricePerDelivery.toLocaleString()}
                </span>
              </div>
            </div>

            {/* アクションボタン */}
            {userType === 'farmer' ? (
              <Button
                onClick={() => handleToggleActive(plan.id)}
                className={`w-full mt-4 h-11 text-sm font-bold rounded-lg ${
                  plan.isActive
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                {plan.isActive ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    配送中
                  </>
                ) : (
                  '配送を再開する'
                )}
              </Button>
            ) : (
              <Button
                onClick={() => handleSubscribe(plan.id)}
                disabled={!plan.isActive}
                className="w-full mt-4 bg-black text-white hover:bg-gray-800 h-11 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                この定期便に申し込む
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* 単発注文へのリンク（飲食店側のみ） */}
      {userType === 'restaurant' && (
        <div className="mt-6 bg-gray-50 border border-gray-300 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-600 mb-3">
            今回だけ必要な野菜がある場合は、単発注文もご利用いただけます
          </p>
          <Button
            onClick={() => alert('単発注文画面に移動')}
            variant="outline"
            className="border-2 border-gray-300 h-10 px-4 text-sm font-bold rounded-lg"
          >
            単発注文はこちら
          </Button>
        </div>
      )}

      {/* プラン作成/編集フォーム（モーダル） */}
      {(showCreateForm || editingPlan) && (
        <PlanFormModal
          plan={editingPlan}
          onClose={() => {
            setShowCreateForm(false);
            setEditingPlan(null);
          }}
          onSave={(plan) => {
            if (editingPlan) {
              setPlans((prev) =>
                prev.map((p) => (p.id === plan.id ? plan : p))
              );
            } else {
              setPlans((prev) => [...prev, { ...plan, id: `SUB${Date.now()}` }]);
            }
            setShowCreateForm(false);
            setEditingPlan(null);
          }}
        />
      )}
    </div>
  );
}

interface PlanFormModalProps {
  plan: SubscriptionPlan | null;
  onClose: () => void;
  onSave: (plan: SubscriptionPlan) => void;
}

function PlanFormModal({ plan, onClose, onSave }: PlanFormModalProps) {
  const [formData, setFormData] = useState<SubscriptionPlan>(
    plan || {
      id: '',
      productId: '',
      productName: '',
      farmerName: '',
      farmerId: '',
      quantity: 1,
      unit: 'kg',
      frequency: 'weekly',
      deliveryDay: '月曜日',
      pricePerDelivery: 0,
      basePrice: 0,
      startDate: '',
      endDate: '',
      isActive: true,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-white border-b-2 border-gray-300 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-black">
            {plan ? 'プランを編集' : '新しいプランを作成'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            type="button"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本情報 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                商品名
              </label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) =>
                  setFormData({ ...formData, productName: e.target.value })
                }
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base"
                placeholder="例: しいたけ"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                農園名
              </label>
              <input
                type="text"
                value={formData.farmerName}
                onChange={(e) =>
                  setFormData({ ...formData, farmerName: e.target.value })
                }
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base"
                placeholder="例: 田中農園"
                required
              />
            </div>
          </div>

          {/* 配送設定 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                配送頻度
              </label>
              <select
                value={formData.frequency}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    frequency: e.target.value as any,
                  })
                }
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base"
              >
                <option value="twice_weekly">週2回</option>
                <option value="weekly">週1回</option>
                <option value="biweekly">隔週</option>
                <option value="monthly">月1回</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                配送曜日
              </label>
              <select
                value={formData.deliveryDay}
                onChange={(e) =>
                  setFormData({ ...formData, deliveryDay: e.target.value })
                }
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base"
              >
                <option value="月曜日">月曜日</option>
                <option value="火曜日">火曜日</option>
                <option value="水曜日">水曜日</option>
                <option value="木曜日">木曜日</option>
                <option value="金曜日">金曜日</option>
                <option value="土曜日">土曜日</option>
                <option value="日曜日">日曜日</option>
              </select>
            </div>
          </div>

          {/* 期間設定 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                配送開始日
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                配送終了日（任意）
              </label>
              <input
                type="date"
                value={formData.endDate || ''}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base"
              />
            </div>
          </div>

          {/* 価格 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              1回あたりの価格（税込）
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-600">
                ¥
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={formData.pricePerDelivery}
                onChange={(e) => {
                  const val = toHalfWidth(e.target.value);
                  if (val === '' || /^\d+$/.test(val)) {
                    setFormData({
                      ...formData,
                      pricePerDelivery: val === '' ? 0 : Number(val),
                    });
                  }
                }}
                className="w-full border-2 border-gray-300 rounded-xl pl-10 pr-4 py-3 text-base"
                required
              />
            </div>
          </div>

          {/* アクション */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 h-14 text-lg font-bold border-2 border-gray-300 rounded-xl"
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-black text-white hover:bg-gray-800 h-14 text-lg font-bold rounded-xl"
            >
              {plan ? '更新する' : '作成する'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
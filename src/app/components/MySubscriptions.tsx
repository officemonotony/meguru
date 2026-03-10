import { useState } from 'react';
import { Calendar, Package, Pause, Play, X, FileText, ChevronRight } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { SwipeButton } from '@/app/components/SwipeButton';

interface ActiveSubscription {
  id: string;
  planId: string;
  productName: string;
  farmerName: string;
  quantity: number;
  unit: string;
  frequency: 'twice_weekly' | 'weekly' | 'biweekly' | 'monthly';
  deliveryDay: string;
  pricePerDelivery: number;
  nextDeliveryDate: string;
  status: 'active' | 'paused' | 'cancelled';
  startDate: string;
  endDate?: string;
  totalDeliveries: number;
  completedDeliveries: number;
}

const mockSubscriptions: ActiveSubscription[] = [
  {
    id: 'MYSUB001',
    planId: 'SUB001',
    productName: 'しいたけ',
    farmerName: '龍ノ傘',
    quantity: 3,
    unit: 'kg',
    frequency: 'weekly',
    deliveryDay: '月曜日',
    pricePerDelivery: 2400,
    nextDeliveryDate: '2026-02-17',
    status: 'active',
    startDate: '2026-02-10',
    endDate: '2026-05-10',
    totalDeliveries: 13,
    completedDeliveries: 1,
  },
  {
    id: 'MYSUB002',
    planId: 'SUB002',
    productName: 'トマト',
    farmerName: '佐藤農園',
    quantity: 5,
    unit: 'kg',
    frequency: 'biweekly',
    deliveryDay: '水曜日',
    pricePerDelivery: 4000,
    nextDeliveryDate: '2026-02-19',
    status: 'active',
    startDate: '2026-02-05',
    totalDeliveries: 24,
    completedDeliveries: 1,
  },
  {
    id: 'MYSUB003',
    planId: 'SUB003',
    productName: 'レタス',
    farmerName: '鈴木農園',
    quantity: 4,
    unit: 'kg',
    frequency: 'monthly',
    deliveryDay: '毎月1日',
    pricePerDelivery: 2800,
    nextDeliveryDate: '2026-03-01',
    status: 'paused',
    startDate: '2026-01-01',
    endDate: '2026-12-01',
    totalDeliveries: 12,
    completedDeliveries: 1,
  },
];

const frequencyLabels = {
  twice_weekly: '週2回',
  weekly: '週1回',
  biweekly: '隔週',
  monthly: '月1回',
};

const statusConfig = {
  active: { label: '配送中', color: 'bg-green-500', icon: Play },
  paused: { label: '一時停止中', color: 'bg-yellow-500', icon: Pause },
  cancelled: { label: 'キャンセル済み', color: 'bg-gray-500', icon: X },
};

export function MySubscriptions() {
  const [subscriptions, setSubscriptions] = useState<ActiveSubscription[]>(mockSubscriptions);
  const [selectedSubscription, setSelectedSubscription] = useState<ActiveSubscription | null>(null);

  const handlePause = (subId: string) => {
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.id === subId ? { ...sub, status: 'paused' as const } : sub
      )
    );
  };

  const handleResume = (subId: string) => {
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.id === subId ? { ...sub, status: 'active' as const } : sub
      )
    );
  };

  const handleCancel = (subId: string) => {
    if (confirm('この定期便をキャンセルしてもよろしいですか？')) {
      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === subId ? { ...sub, status: 'cancelled' as const } : sub
        )
      );
    }
  };

  const activeSubscriptions = subscriptions.filter((s) => s.status === 'active');
  const pausedSubscriptions = subscriptions.filter((s) => s.status === 'paused');
  const cancelledSubscriptions = subscriptions.filter((s) => s.status === 'cancelled');

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 -mx-4 -mt-4 mb-4">
        <p className="text-sm text-gray-600">
          ご契約中の定期便を管理できます
        </p>
      </div>

      {/* 統計情報 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-gray-300 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {activeSubscriptions.length}
          </div>
          <div className="text-xs text-gray-600">配送中</div>
        </div>
        <div className="bg-white border border-gray-300 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600 mb-1">
            {pausedSubscriptions.length}
          </div>
          <div className="text-xs text-gray-600">一時停止中</div>
        </div>
        <div className="bg-white border border-gray-300 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-black mb-1">
            ¥
            {activeSubscriptions
              .reduce((sum, sub) => sum + sub.pricePerDelivery, 0)
              .toLocaleString()}
          </div>
          <div className="text-xs text-gray-600">次回配送</div>
        </div>
      </div>

      {/* 配送中の定期便 */}
      {activeSubscriptions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-black mb-3 px-2">配送中</h2>
          <div className="space-y-3">
            {activeSubscriptions.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                onPause={() => handlePause(sub.id)}
                onResume={() => handleResume(sub.id)}
                onCancel={() => handleCancel(sub.id)}
                onViewDetails={() => setSelectedSubscription(sub)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 一時停止中の定期便 */}
      {pausedSubscriptions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-black mb-3 px-2">一時停止中</h2>
          <div className="space-y-3">
            {pausedSubscriptions.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                onPause={() => handlePause(sub.id)}
                onResume={() => handleResume(sub.id)}
                onCancel={() => handleCancel(sub.id)}
                onViewDetails={() => setSelectedSubscription(sub)}
              />
            ))}
          </div>
        </div>
      )}

      {/* キャンセル済みの定期便 */}
      {cancelledSubscriptions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-black mb-3 px-2">キャンセル済み</h2>
          <div className="space-y-3">
            {cancelledSubscriptions.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                onPause={() => handlePause(sub.id)}
                onResume={() => handleResume(sub.id)}
                onCancel={() => handleCancel(sub.id)}
                onViewDetails={() => setSelectedSubscription(sub)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 詳細モーダル */}
      {selectedSubscription && (
        <SubscriptionDetailModal
          subscription={selectedSubscription}
          onClose={() => setSelectedSubscription(null)}
        />
      )}
    </div>
  );
}

interface SubscriptionCardProps {
  subscription: ActiveSubscription;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onViewDetails: () => void;
}

function SubscriptionCard({
  subscription,
  onPause,
  onResume,
  onCancel,
  onViewDetails,
}: SubscriptionCardProps) {
  const config = statusConfig[subscription.status];
  const Icon = config.icon;
  const progress = (subscription.completedDeliveries / subscription.totalDeliveries) * 100;

  return (
    <div className="bg-white border-2 border-gray-300 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-2xl font-bold text-black">{subscription.productName}</h3>
            <div className={`${config.color} text-white text-sm px-3 py-1 rounded-full flex items-center gap-1 font-bold`}>
              <Icon className="w-4 h-4" />
              {config.label}
            </div>
          </div>
          <div className="text-base text-gray-600 mb-3">
            {subscription.farmerName}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {frequencyLabels[subscription.frequency]}
            </div>
            <div>配送日: {subscription.deliveryDay}</div>
          </div>
        </div>
      </div>

      {/* 次回配送情報 */}
      {subscription.status === 'active' && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-600 font-bold mb-1">次回配送予定日</div>
              <div className="text-xl font-bold text-blue-800">
                {new Date(subscription.nextDeliveryDate).toLocaleDateString('ja-JP', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-600 font-bold mb-1">配送料金</div>
              <div className="text-2xl font-bold text-blue-800">
                ¥{subscription.pricePerDelivery.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 進捗バー */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>配送進捗</span>
          <span>
            {subscription.completedDeliveries} / {subscription.totalDeliveries} 回完了
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-green-500 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* セット内容（簡易表示） */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <div className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          <Package className="w-4 h-4" />
          セット内容
        </div>
        <div className="space-y-1">
          <div className="text-sm text-gray-700">
            {subscription.productName} × {subscription.quantity}{subscription.unit}
          </div>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="grid grid-cols-3 gap-3">
        <Button
          onClick={onViewDetails}
          variant="outline"
          className="border-2 border-gray-300 rounded-xl h-12 text-base font-bold"
        >
          <FileText className="w-4 h-4 mr-1" />
          詳細
        </Button>
        {subscription.status === 'active' ? (
          <Button
            onClick={onPause}
            variant="outline"
            className="border-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50 rounded-xl h-12 text-base font-bold"
          >
            <Pause className="w-4 h-4 mr-1" />
            一時停止
          </Button>
        ) : subscription.status === 'paused' ? (
          <Button
            onClick={onResume}
            variant="outline"
            className="border-2 border-green-300 text-green-700 hover:bg-green-50 rounded-xl h-12 text-base font-bold"
          >
            <Play className="w-4 h-4 mr-1" />
            再開
          </Button>
        ) : (
          <div />
        )}
        {subscription.status !== 'cancelled' && (
          <Button
            onClick={onCancel}
            variant="outline"
            className="border-2 border-red-300 text-red-700 hover:bg-red-50 rounded-xl h-12 text-base font-bold"
          >
            <X className="w-4 h-4 mr-1" />
            キャンセル
          </Button>
        )}
      </div>
    </div>
  );
}

interface SubscriptionDetailModalProps {
  subscription: ActiveSubscription;
  onClose: () => void;
}

function SubscriptionDetailModal({ subscription, onClose }: SubscriptionDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-white border-b-2 border-gray-300 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-black">定期便詳細</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 基本情報 */}
          <div>
            <h3 className="text-xl font-bold text-black mb-4">{subscription.productName}</h3>
            <div className="grid grid-cols-2 gap-4 text-base">
              <div>
                <span className="text-gray-600">農家:</span>
                <span className="ml-2 font-bold text-black">{subscription.farmerName}</span>
              </div>
              <div>
                <span className="text-gray-600">配送頻度:</span>
                <span className="ml-2 font-bold text-black">
                  {frequencyLabels[subscription.frequency]}
                </span>
              </div>
              <div>
                <span className="text-gray-600">配送曜日:</span>
                <span className="ml-2 font-bold text-black">{subscription.deliveryDay}</span>
              </div>
              <div>
                <span className="text-gray-600">1回あたりの料金:</span>
                <span className="ml-2 font-bold text-black">
                  ¥{subscription.pricePerDelivery.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 期間 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-base font-bold text-gray-700 mb-3">配送期間</h4>
            <div className="space-y-2 text-base">
              <div className="flex justify-between">
                <span className="text-gray-600">開始日:</span>
                <span className="font-bold text-black">
                  {new Date(subscription.startDate).toLocaleDateString('ja-JP')}
                </span>
              </div>
              {subscription.endDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">終了日:</span>
                  <span className="font-bold text-black">
                    {new Date(subscription.endDate).toLocaleDateString('ja-JP')}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-300">
                <span className="text-gray-600">配送回数:</span>
                <span className="font-bold text-black">
                  {subscription.completedDeliveries} / {subscription.totalDeliveries} 回
                </span>
              </div>
            </div>
          </div>

          {/* セット内容 */}
          <div>
            <h4 className="text-base font-bold text-gray-700 mb-3">セット内容</h4>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-base">
                <span className="text-gray-700">{subscription.productName}</span>
                <span className="font-bold text-black">
                  {subscription.quantity}{subscription.unit}
                </span>
              </div>
            </div>
          </div>

          {/* 料金計算 */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
            <h4 className="text-base font-bold text-blue-700 mb-3">料金計算</h4>
            <div className="space-y-2 text-base">
              <div className="flex justify-between">
                <span className="text-blue-600">1回あたり:</span>
                <span className="font-bold text-blue-800">
                  ¥{subscription.pricePerDelivery.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-600">配送回数:</span>
                <span className="font-bold text-blue-800">
                  {subscription.totalDeliveries} 回
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t-2 border-blue-300">
                <span className="text-blue-700 font-bold">総額（税込）:</span>
                <span className="font-bold text-blue-900 text-xl">
                  ¥{(subscription.pricePerDelivery * subscription.totalDeliveries).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <Button
            onClick={onClose}
            className="w-full bg-black text-white hover:bg-gray-800 h-14 text-lg font-bold rounded-xl"
          >
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
}
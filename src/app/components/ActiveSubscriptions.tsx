import { useState } from 'react';
import { Calendar, Package, User, MapPin, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useData } from '@/app/context/DataContext';

export interface ActiveSubscription {
  id: string;
  partnerId: string;
  partnerName: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  frequency: string;
  deliveryDay: string;
  pricePerDelivery: number;
  startDate: string;
  totalDeliveries: number;
  completedDeliveries: number;
  nextDeliveryDate: string;
  status: 'active' | 'paused' | 'completed';
}

interface ActiveSubscriptionsProps {
  userType: 'farmer' | 'restaurant';
}

export function ActiveSubscriptions({ userType }: ActiveSubscriptionsProps) {
  const { activeSubscriptions: contextSubscriptions } = useData();
  const [filter, setFilter] = useState<'active' | 'completed'>('active');
  
  // DataContextの契約をこのコンポーネントの形式に変換
  const subscriptions: ActiveSubscription[] = contextSubscriptions.map(sub => ({
    id: sub.id,
    partnerId: userType === 'restaurant' ? sub.farmerId : sub.restaurantId,
    partnerName: userType === 'restaurant' ? sub.farmerName : sub.restaurantName,
    productId: sub.id,
    productName: sub.productName,
    quantity: sub.quantity,
    unit: sub.unit,
    frequency: sub.frequency === 'twice_weekly' ? '週2回' : sub.frequency === 'weekly' ? '週1回' : sub.frequency === 'biweekly' ? '隔週' : '月1回',
    deliveryDay: sub.deliveryDay,
    pricePerDelivery: sub.pricePerDelivery,
    startDate: sub.startDate,
    totalDeliveries: sub.totalDeliveries,
    completedDeliveries: 0, // TODO: 実際の配送完了数を追跡
    nextDeliveryDate: '2026-02-17', // TODO: 実際の次回配送日を計算
    status: sub.status as 'active' | 'paused' | 'completed',
  }));

  const filteredSubscriptions = subscriptions.filter(
    (sub) => sub.status === filter
  );

  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const completedCount = subscriptions.filter((s) => s.status === 'completed').length;

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh]">
        <div className="bg-gray-100 rounded-full p-8 mb-6">
          <Package className="w-16 h-16 text-gray-400" />
        </div>
        <p className="text-xl text-gray-600 font-bold mb-2">契約中の継続お届けがありません</p>
        <p className="text-base text-gray-600 mb-6">
          {userType === 'restaurant' 
            ? '継続の提案を送信して、農家と契約を開始しましょう'
            : '飲食店からの提案を承認すると、ここに表示されます'}
        </p>
        <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-5 w-full max-w-sm">
          <p className="text-xs font-bold text-gray-700 mb-3">
            {userType === 'restaurant' ? '継続お届けの始め方' : '契約が始まるまで'}
          </p>
          <div className="space-y-3">
            {userType === 'restaurant' ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-gray-600 text-left">「注文」タブから農家の商品を選ぶ</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-gray-600 text-left">「継続で提案」を選んで配送内容を設定</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-gray-600 text-left">農家が承認すると契約が開始されます</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-gray-600 text-left">飲食店が継続お届けの提案を送信</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-gray-600 text-left">「継続提案」タブで内容を確認して承認</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-gray-600 text-left">自動でスケジュールが作成され、ここに表示されます</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 -mx-4 -mt-4 mb-4">
        <h2 className="text-lg font-bold text-black mb-1">契約中の継続お届け</h2>
        <p className="text-xs text-gray-500">
          {userType === 'farmer' 
            ? '承認済みの継続お届け契約を管理できます' 
            : '契約中の継続お届けを確認できます'}
        </p>
      </div>

      {/* フィルター */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-all ${
            filter === 'active'
              ? 'bg-black text-white'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400'
          }`}
        >
          進行中 ({activeCount})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-all ${
            filter === 'completed'
              ? 'bg-black text-white'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400'
          }`}
        >
          完了 ({completedCount})
        </button>
      </div>

      {/* 定期便一覧 */}
      <div className="space-y-4">
        {filteredSubscriptions.map((subscription) => (
          <SubscriptionCard
            key={subscription.id}
            subscription={subscription}
            userType={userType}
          />
        ))}
      </div>

      {/* 空状態 */}
      {filteredSubscriptions.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {filter === 'active'
              ? '進行中の継続お届けはありません'
              : '完了した継続お届けはありません'}
          </p>
        </div>
      )}
    </div>
  );
}

interface SubscriptionCardProps {
  subscription: ActiveSubscription;
  userType: 'farmer' | 'restaurant';
}

function SubscriptionCard({ subscription, userType }: SubscriptionCardProps) {
  const statusConfig = {
    active: { 
      bg: 'bg-green-50', 
      border: 'border-green-300', 
      text: '進行中', 
      textColor: 'text-green-700',
    },
    paused: { 
      bg: 'bg-yellow-50', 
      border: 'border-yellow-300', 
      text: '一時停止', 
      textColor: 'text-yellow-700',
    },
    completed: { 
      bg: 'bg-gray-50', 
      border: 'border-gray-300', 
      text: '完了', 
      textColor: 'text-gray-700',
    },
  };

  const config = statusConfig[subscription.status];
  const progress = (subscription.completedDeliveries / subscription.totalDeliveries) * 100;

  return (
    <div className={`bg-white border-2 ${config.border} rounded-2xl overflow-hidden hover:shadow-lg transition-shadow`}>
      {/* ステータスバー */}
      <div className={`${config.bg} px-4 py-2.5 border-b-2 ${config.border} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`font-bold text-sm ${config.textColor}`}>{config.text}</span>
        </div>
        <span className="text-xs text-gray-600">ID: {subscription.id}</span>
      </div>

      {/* 内容 */}
      <div className="p-4">
        {/* パートナー情報 */}
        <div className="flex items-center gap-3 mb-3 pb-3 border-b-2 border-gray-200">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-black">{subscription.partnerName}</h3>
            <p className="text-xs text-gray-500">
              {userType === 'farmer' ? 'お届け先' : '仕入れ先'}
            </p>
          </div>
        </div>

        {/* 商品情報 */}
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-gray-600" />
            <h4 className="text-base font-bold text-black">{subscription.productName}</h4>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">配送量:</span>
              <span className="font-bold text-black ml-2">
                {subscription.quantity}{subscription.unit} / 回
              </span>
            </div>
            <div>
              <span className="text-gray-600">配送頻度:</span>
              <span className="font-bold text-black ml-2">{subscription.frequency}</span>
            </div>
            <div>
              <span className="text-gray-600">配送曜日:</span>
              <span className="font-bold text-black ml-2">{subscription.deliveryDay}</span>
            </div>
            <div>
              <span className="text-gray-600">1回あたり:</span>
              <span className="font-bold text-black ml-2">
                {subscription.pricePerDelivery.toLocaleString()}円
              </span>
            </div>
          </div>
        </div>

        {/* 進捗情報 */}
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3 mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-blue-700">配送進捗</span>
            <span className="text-sm font-bold text-blue-900">
              {subscription.completedDeliveries} / {subscription.totalDeliveries}回
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden mb-2">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-blue-700">開始日:</span>
              <span className="font-bold text-blue-900 ml-2">{subscription.startDate}</span>
            </div>
            <div>
              <span className="text-blue-700">次回配送:</span>
              <span className="font-bold text-blue-900 ml-2">
                {subscription.nextDeliveryDate}
              </span>
            </div>
          </div>
        </div>

        {/* アクションボタン（進行中のみ） */}
        {subscription.status === 'active' && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-2 border-gray-300 rounded-xl h-11 text-sm font-bold hover:bg-gray-50"
            >
              <Calendar className="w-4 h-4 mr-1" />
              スケジュール
            </Button>
            <Button
              className="flex-1 bg-black text-white hover:bg-gray-800 rounded-xl h-11 text-sm font-bold"
            >
              詳細を見る
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
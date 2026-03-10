import { useState } from 'react';
import { History, Package } from 'lucide-react';
import { OrderHistory } from '@/app/components/OrderHistory';
import { ActiveSubscriptions } from '@/app/components/ActiveSubscriptions';

export function HistoryTab() {
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'subscriptions'>('orders');

  return (
    <div className="flex flex-col h-full">
      {/* サブタブナビゲーション */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-14 z-10">
        <div className="flex">
          <button
            onClick={() => setActiveSubTab('orders')}
            className={`flex-1 flex items-center justify-center gap-1.5 font-bold transition-all text-sm ${ activeSubTab === 'orders' ? 'text-black border-b-4 border-black' : 'text-gray-400 border-b-4 border-transparent' } px-[8px] py-[16px]`}
          >
            <History className="w-4 h-4" />
            <span>注文履歴</span>
          </button>
          <button
            onClick={() => setActiveSubTab('subscriptions')}
            className={`flex-1 pt-2 pb-2 px-2 flex items-center justify-center gap-1.5 font-bold transition-all text-sm ${
              activeSubTab === 'subscriptions'
                ? 'text-black border-b-4 border-black'
                : 'text-gray-400 border-b-4 border-transparent'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>契約中</span>
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {activeSubTab === 'orders' && <OrderHistory />}
        {activeSubTab === 'subscriptions' && <ActiveSubscriptions userType="restaurant" />}
      </div>
    </div>
  );
}
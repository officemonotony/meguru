import { useState } from 'react';
import { Package, ShoppingCart, Inbox } from 'lucide-react';
import { ProposalList } from '@/app/components/ProposalList';
import { ActiveSubscriptions } from '@/app/components/ActiveSubscriptions';
import { OneTimeOrderRequests } from '@/app/components/OneTimeOrderRequests';
import { useData } from '@/app/context/DataContext';

interface FarmerSubscriptionTabProps {
  onOpenChat?: (restaurantId: string, restaurantName: string) => void;
  onNavigateToDelivery?: (tab?: 'ordered' | 'approved' | 'delivered' | 'paid') => void;
}

type SubTab = 'oneTime' | 'subscription';
type SubscriptionInnerTab = 'proposals' | 'active';

export function FarmerSubscriptionTab({ onOpenChat, onNavigateToDelivery }: FarmerSubscriptionTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('oneTime');
  const [subscriptionInnerTab, setSubscriptionInnerTab] = useState<SubscriptionInnerTab>('proposals');
  const { messages, deliverySchedules, proposals } = useData();

  // 未対応の継続提案数をカウント
  const pendingProposalCount = proposals.filter(p => p.status === 'pending').length;

  // 未確認の単発注文数をカウント
  const pendingOneTimeCount = (() => {
    let count = 0;
    Object.entries(messages).forEach(([, chatMessages]) => {
      chatMessages.forEach((message, idx) => {
        if (message.text?.includes('【配送依頼】') && message.sender === 'restaurant') {
          const isApproved = deliverySchedules.some(d => d.id === `onetime-${message.id}`);
          if (isApproved) return;
          const after = chatMessages.slice(idx + 1);
          const hasResponse = after.some(m =>
            m.text?.includes('【注文承認】') ||
            m.text?.includes('【お断り】') ||
            (m.type === 'counterProposal' && m.counterProposalData?.originalMessageId === message.id)
          );
          if (!hasResponse) count++;
        }
      });
    });
    return count;
  })();

  return (
    <div className="flex flex-col h-full">
      {/* サブタブナビゲーション */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-14 z-10">
        <div className="flex">
          <button
            onClick={() => setActiveSubTab('oneTime')}
            className={`flex-1 flex items-center justify-center gap-1.5 font-bold transition-all text-sm ${ activeSubTab === 'oneTime' ? 'text-black border-b-4 border-black' : 'text-gray-400 border-b-4 border-transparent' } px-[8px] py-[16px]`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>単発注文</span>
            {pendingOneTimeCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">
                {pendingOneTimeCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('subscription')}
            className={`flex-1 pt-2 pb-2 px-2 flex items-center justify-center gap-1.5 font-bold transition-all text-sm ${
              activeSubTab === 'subscription'
                ? 'text-black border-b-4 border-black'
                : 'text-gray-400 border-b-4 border-transparent'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>継続注文</span>
            {pendingProposalCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">
                {pendingProposalCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {activeSubTab === 'oneTime' && (
          <OneTimeOrderRequests onOpenChat={onOpenChat} onNavigateToOrders={onNavigateToDelivery} />
        )}
        {activeSubTab === 'subscription' && (
          <div className="flex flex-col h-full">
            {/* 継続注文内サブタブ */}
            <div className="flex bg-gray-50 border-b border-gray-200">
              <button
                onClick={() => setSubscriptionInnerTab('proposals')}
                className={`flex-1 py-2.5 px-2 flex items-center justify-center gap-1.5 text-sm font-semibold transition-all ${
                  subscriptionInnerTab === 'proposals'
                    ? 'text-black border-b-2 border-black'
                    : 'text-gray-400 border-b-2 border-transparent'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>継続提案</span>
                {pendingProposalCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold min-w-[18px] h-4.5 px-1 rounded-full flex items-center justify-center">
                    {pendingProposalCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSubscriptionInnerTab('active')}
                className={`flex-1 py-2.5 px-2 flex items-center justify-center gap-1.5 text-sm font-semibold transition-all ${
                  subscriptionInnerTab === 'active'
                    ? 'text-black border-b-2 border-black'
                    : 'text-gray-400 border-b-2 border-transparent'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>契約中</span>
              </button>
            </div>
            {/* 継続注文内コンテンツ */}
            <div className="flex-1 overflow-y-auto">
              {subscriptionInnerTab === 'proposals' && <ProposalList onOpenChat={onOpenChat} />}
              {subscriptionInnerTab === 'active' && <ActiveSubscriptions userType="farmer" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
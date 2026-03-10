import { useState } from 'react';
import { LogOut, Package, MessageCircle, Calendar, Receipt, Truck } from 'lucide-react';
import { ChatList } from '@/app/components/ChatList';
import { ChatRoom } from '@/app/components/ChatRoom';
import { FarmerSubscriptionTab } from '@/app/components/FarmerSubscriptionTab';
import { FarmerProductTab } from '@/app/components/FarmerProductTab';
import { MonthlyInvoice } from '@/app/components/MonthlyInvoice';
import { FarmerOrders } from '@/app/components/FarmerOrders';
import { RESTAURANT_INFO, useData } from '@/app/context/DataContext';

interface FarmerDashboardProps {
  onLogout: () => void;
}

type Tab = 'products' | 'orders' | 'delivery' | 'chat' | 'billing';

export function FarmerDashboard({ onLogout }: FarmerDashboardProps) {
  const { messages, proposals, markChatAsRead, getTotalUnread, deliverySchedules } = useData();
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatName, setSelectedChatName] = useState<string>('');
  const [selectedChatAvatar, setSelectedChatAvatar] = useState<string>('');
  const [ordersInitialTab, setOrdersInitialTab] = useState<'ordered' | 'approved' | 'delivered' | 'paid' | undefined>(undefined);
  const [deliveryInitialTab, setDeliveryInitialTab] = useState<'ordered' | 'approved' | 'delivered' | 'paid' | undefined>(undefined);

  // 注文管理バッジ用：未対応の単発注文数 + 未応の継続提案数をカウント
  const orderBadgeCount = (() => {
    // 未承認の単発注文数（配送依頼メッセージカウント）
    let oneTimeCount = 0;
    Object.entries(messages).forEach(([, chatMessages]) => {
      chatMessages.forEach((message, idx) => {
        if (message.text?.includes('【配送依頼】') && message.sender === 'restaurant') {
          // 承認済み・変更提案済み・お断り済みは除外
          const schedule = deliverySchedules.find(d => d.id === `onetime-${message.id}`);
          // スケジュールが存在し、かつステータスがordered以外（=承認済み以降）なら除外
          if (schedule && schedule.status !== 'ordered') return;
          const after = chatMessages.slice(idx + 1);
          const hasCounterOrDecline = after.some(m =>
            m.text?.includes('【注文承認】') ||
            m.text?.includes('【お断り】') ||
            (m.type === 'counterProposal' && m.counterProposalData?.originalMessageId === message.id)
          );
          if (!hasCounterOrDecline) oneTimeCount++;
        }
      });
    });
    // 未対応の継続提案数
    const pendingProposalCount = proposals.filter(p => p.status === 'pending').length;
    return oneTimeCount + pendingProposalCount;
  })();

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    // チャットを開いたら既読にする
    markChatAsRead(chatId, 'farmer');
    // チャットIDに基づいて名前とアバターを取得
    const chatData: { [key: string]: { name: string; avatar: string } } = {
      '1': { name: RESTAURANT_INFO.name, avatar: RESTAURANT_INFO.avatarUrl },
      'chat-farmer1': { name: RESTAURANT_INFO.name, avatar: RESTAURANT_INFO.avatarUrl },
      '2': { name: '和食処さくら', avatar: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200' },
      '3': { name: 'カ��ェ緑', avatar: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200' },
    };
    const data = chatData[chatId] || { name: RESTAURANT_INFO.name, avatar: RESTAURANT_INFO.avatarUrl };
    setSelectedChatName(data.name);
    setSelectedChatAvatar(data.avatar);
  };

  const handleBackToList = () => {
    setSelectedChatId(null);
    setSelectedChatName('');
    setSelectedChatAvatar('');
  };

  const handleOpenChatFromProposal = (restaurantId: string, restaurantName: string) => {
    // レストランIDに基づいてチャットIDを決定（両方のID形式に対応）
    const chatIdMap: { [key: string]: string } = {
      'REST001': 'chat-farmer1',
      'REST002': '2',
      'REST003': '3',
      'restaurant1': 'chat-farmer1',
      'restaurant2': '2',
      'restaurant3': '3',
    };
    const chatId = chatIdMap[restaurantId] || 'chat-farmer1';
    
    // アバターを取得
    let avatar = RESTAURANT_INFO.avatarUrl;
    if (restaurantId !== 'REST001' && restaurantId !== 'restaurant1') {
      const avatarMap: { [key: string]: string } = {
        'REST002': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200',
        'REST003': 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200',
        'restaurant2': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200',
        'restaurant3': 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=200',
      };
      avatar = avatarMap[restaurantId] || RESTAURANT_INFO.avatarUrl;
    }
    
    setSelectedChatId(chatId);
    setSelectedChatName(restaurantName);
    setSelectedChatAvatar(avatar);
    // チャットを開いたら既読にする
    markChatAsRead(chatId, 'farmer');
    setActiveTab('chat');
  };

  // handleOpenChatFromOrders は handleOpenChatFromProposal に統合済み

  // チャットバッジ用：農家側の未読メッセージ合計
  const chatBadgeCount = getTotalUnread('farmer');

  const handleNavigateToOrders = (tab?: 'ordered' | 'approved' | 'delivered' | 'paid') => {
    setOrdersInitialTab(tab);
    setActiveTab('orders');
  };

  // 未払い請求のバッジカウント（delivered状態の注文数）
  const billingBadgeCount = deliverySchedules.filter(d => d.status === 'delivered').length;

  // お届けバッジ（approved状態＝配達待ちの注文数）
  const deliveryBadgeCount = deliverySchedules.filter(d => d.status === 'approved').length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
        <h1 className="text-lg font-bold text-black">メグル</h1>
        <button
          onClick={onLogout}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 pb-16 pt-14">
        {activeTab === 'products' && <FarmerProductTab />}
        {activeTab === 'orders' && <FarmerSubscriptionTab onOpenChat={handleOpenChatFromProposal} onNavigateToDelivery={(tab) => { setDeliveryInitialTab(tab); setActiveTab('delivery'); }} />}
        {activeTab === 'delivery' && <FarmerOrders onOpenChat={handleOpenChatFromProposal} initialTab={deliveryInitialTab} />}
        {activeTab === 'billing' && <MonthlyInvoice userType="farmer" />}
        {activeTab === 'chat' && (
          <>
            {selectedChatId ? (
              <ChatRoom
                chatId={selectedChatId}
                chatName={selectedChatName}
                avatarUrl={selectedChatAvatar}
                onBack={handleBackToList}
                userType="farmer"
              />
            ) : (
              <ChatList userType="farmer" onSelectChat={handleSelectChat} />
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'products' ? 'text-black' : 'text-gray-400'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px]">うちの商品</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`relative flex flex-col items-center justify-center flex-1 py-3 ${
              activeTab === 'orders' ? 'text-black' : 'text-gray-400'
            }`}
          >
            <div className="relative">
              <Calendar className="w-5 h-5" />
              {orderBadgeCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                  {orderBadgeCount > 99 ? '99+' : orderBadgeCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">注文</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`relative flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'chat' ? 'text-black' : 'text-gray-400'
            }`}
          >
            <div className="relative">
              <MessageCircle className="w-5 h-5" />
              {chatBadgeCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                  {chatBadgeCount > 99 ? '99+' : chatBadgeCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">チャット</span>
          </button>
          <button
            onClick={() => setActiveTab('delivery')}
            className={`relative flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'delivery' ? 'text-black' : 'text-gray-400'
            }`}
          >
            <div className="relative">
              <Truck className="w-5 h-5" />
              {deliveryBadgeCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                  {deliveryBadgeCount > 99 ? '99+' : deliveryBadgeCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">お届け</span>
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`relative flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'billing' ? 'text-black' : 'text-gray-400'
            }`}
          >
            <div className="relative">
              <Receipt className="w-5 h-5" />
              {billingBadgeCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                  {billingBadgeCount > 99 ? '99+' : billingBadgeCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">売上</span>
          </button>
        </div>
      </div>
    </div>
  );
}
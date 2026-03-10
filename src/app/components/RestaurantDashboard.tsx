import { useState } from 'react';
import { LogOut, ShoppingBag, MessageCircle, Truck, Receipt, CheckCircle, MessageSquare } from 'lucide-react';
import { ChatList } from '@/app/components/ChatList';
import { ChatRoom } from '@/app/components/ChatRoom';
import { OrderTab } from '@/app/components/OrderTab';
import { HistoryTab } from '@/app/components/HistoryTab';
import { MonthlyInvoice } from '@/app/components/MonthlyInvoice';
import { SubscriptionProposal } from '@/app/components/ProposalForm';
import { useData, RESTAURANT_INFO } from '@/app/context/DataContext';
const ryuNoKasaAvatar = 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=200';

interface RestaurantDashboardProps {
  onLogout: () => void;
}

type Tab = 'chat' | 'order' | 'history' | 'payment';

export function RestaurantDashboard({ onLogout }: RestaurantDashboardProps) {
  const { addChat, addProposal, addMessage, addDeliverySchedule, markChatAsRead, getTotalUnread } = useData();
  const [activeTab, setActiveTab] = useState<Tab>('order');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatName, setSelectedChatName] = useState<string>('');
  const [selectedChatAvatar, setSelectedChatAvatar] = useState<string>('');
  const [orderConfirmation, setOrderConfirmation] = useState<{
    farmerId: string;
    farmerName: string;
    items: { product: { name: string; unit: string; price: number }; quantity: number }[];
    deliveryDate: string;
    totalAmount: number;
  } | null>(null);

  const farmerChatMapping: { [farmerId: string]: { chatId: string; name: string; avatar: string } } = {
    'farmer1': {
      chatId: 'chat-farmer1',
      name: '\u9F8D\u30CE\u5098',
      avatar: ryuNoKasaAvatar
    },
    'farmer2': {
      chatId: 'chat-farmer2',
      name: '\u4F50\u85E4\u8FB2\u5712',
      avatar: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=200'
    },
    'farmer3': {
      chatId: 'chat-farmer3',
      name: '\u9234\u6728\u8FB2\u5712',
      avatar: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=200'
    },
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    markChatAsRead(chatId, 'restaurant');
    
    const farmerInfo = Object.values(farmerChatMapping).find(f => f.chatId === chatId);
    setSelectedChatName(farmerInfo?.name || '');
    setSelectedChatAvatar(farmerInfo?.avatar || '');
    setActiveTab('chat');
  };

  const handleBackToList = () => {
    setSelectedChatId(null);
    setSelectedChatName('');
    setSelectedChatAvatar('');
  };

  const handleProposalSubmit = (proposal: Omit<SubscriptionProposal, 'id' | 'status' | 'createdAt'>) => {
    const farmerInfo = farmerChatMapping[proposal.farmerId];
    if (!farmerInfo) return;
    
    const chatId = farmerInfo.chatId;
    
    addChat({
      id: chatId,
      name: farmerInfo.name,
      lastMessage: '\u7D99\u7D9A\u306E\u63D0\u6848',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      unread: 0,
      avatarUrl: farmerInfo.avatar,
      farmerId: proposal.farmerId,
      restaurantId: RESTAURANT_INFO.id,
    });
    
    const proposalId = `proposal-${Date.now()}`;
    
    addProposal({
      ...proposal,
      id: proposalId,
      restaurantId: RESTAURANT_INFO.id,
      restaurantName: RESTAURANT_INFO.name,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    
    const frequencyLabel = { twice_weekly: '\u9031\uFF12\u56DE', weekly: '\u9031\uFF11\u56DE', biweekly: '\u9694\u9031', monthly: '\u6708\uFF11\u56DE' }[proposal.frequency] || proposal.frequency;
    addMessage(chatId, {
      id: proposalId,
      text: '',
      sender: 'restaurant',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      type: 'proposal',
      proposalData: {
        productName: proposal.productName,
        quantity: proposal.quantity,
        unit: proposal.unit,
        frequency: frequencyLabel as 'twice_weekly' | 'weekly' | 'biweekly' | 'monthly',
        totalDeliveries: proposal.totalDeliveries,
        period: proposal.period,
        startDate: proposal.startDate,
        endDate: proposal.endDate,
        deliveryDay: proposal.deliveryDay,
        pricePerDelivery: proposal.pricePerDelivery,
        totalAmount: proposal.pricePerDelivery * proposal.totalDeliveries,
        message: proposal.message,
      },
      proposalStatus: 'pending',
    });

    handleSelectChat(chatId);
    setActiveTab('chat');
  };

  const handleDeliveryRequest = (request: any) => {
    console.log('\u914D\u9001\u4F9D\u983C\u3092\u9001\u4FE1:', request);
    
    const farmerId = request.farmerId || 'farmer1';
    const farmerInfo = farmerChatMapping[farmerId];
    
    console.log('\u8FB2\u5BB6\u60C5\u5831:', farmerId, farmerInfo);
    
    if (!farmerInfo) {
      console.error('\u8FB2\u5BB6\u60C5\u5831\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093:', farmerId);
      return;
    }
    
    const chatId = farmerInfo.chatId;
    
    console.log('\u30C1\u30E3\u30C3\u30C8ID:', chatId);
    
    addChat({
      id: chatId,
      name: farmerInfo.name,
      lastMessage: '\u914D\u9001\u4F9D\u983C',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      unread: 0,
      avatarUrl: farmerInfo.avatar,
      farmerId: farmerId,
      restaurantId: RESTAURANT_INFO.id,
    });
    
    const itemsText = request.items
      .map((item: any) => `\u30FB${item.product.name} ${item.quantity}${item.product.unit}`)
      .join('\n');
    
    const messageText = `\u3010\u914D\u9001\u4F9D\u983C\u3011\n\n${itemsText}\n\n\u914D\u9001\u5E0C\u671B\u65E5: ${request.deliveryDate}\n\u5408\u8A08\u91D1\u984D: \xA5${request.totalAmount.toLocaleString()}\n\n\u3088\u308D\u3057\u304F\u304A\u9858\u3044\u3044\u305F\u3057\u307E\u3059\u3002`;
    
    console.log('\u30E1\u30C3\u30BB\u30FC\u30B8:', messageText);
    
    const messageId = `delivery-request-${Date.now()}`;
    
    addMessage(chatId, {
      id: messageId,
      text: messageText,
      sender: 'restaurant',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
    });
    
    console.log('\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F');
    
    const productNameCombined = request.items
      .map((item: any) => item.product.name)
      .join('\u3001');
    const quantityDesc = request.items
      .map((item: any) => `${item.quantity}${item.product.unit}`)
      .join(' / ');

    addDeliverySchedule({
      id: `onetime-${messageId}`,
      subscriptionId: '',
      restaurantName: RESTAURANT_INFO.name,
      restaurantId: RESTAURANT_INFO.id,
      productName: productNameCombined,
      quantity: request.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      unit: quantityDesc,
      price: request.totalAmount,
      deliveryDate: request.deliveryDate,
      status: 'ordered' as const,
      orderDate: new Date().toISOString().split('T')[0],
      farmerName: farmerInfo.name,
      farmerId: farmerId,
            items: [],
        totalAmount: 0,
        createdAt: new Date().toISOString(),
      });
    
    // チャットに自動遷移せず、注文完了サマリーを表示
    setOrderConfirmation({
      farmerId,
      farmerName: farmerInfo.name,
      items: request.items,
      deliveryDate: request.deliveryDate,
      totalAmount: request.totalAmount,
    });
  };

  const handleOpenChatFromConfirmation = () => {
    if (!orderConfirmation) return;
    const farmerInfo = farmerChatMapping[orderConfirmation.farmerId];
    if (farmerInfo) {
      setOrderConfirmation(null);
      handleSelectChat(farmerInfo.chatId);
    }
  };

  const chatBadgeCount = getTotalUnread('restaurant');

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
        {activeTab === 'order' && <OrderTab onProposalSubmit={handleProposalSubmit} onDeliveryRequest={handleDeliveryRequest} />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'chat' && (
          <>
            {selectedChatId ? (
              <ChatRoom
                chatId={selectedChatId}
                chatName={selectedChatName}
                avatarUrl={selectedChatAvatar}
                onBack={handleBackToList}
              />
            ) : (
              <ChatList userType="restaurant" onSelectChat={handleSelectChat} />
            )}
          </>
        )}
        {activeTab === 'payment' && <MonthlyInvoice userType="restaurant" />}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('order')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'order' ? 'text-black' : 'text-gray-400'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[10px]">注文する</span>
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
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'history' ? 'text-black' : 'text-gray-400'
            }`}
          >
            <Truck className="w-5 h-5" />
            <span className="text-[10px]">お届け</span>
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'payment' ? 'text-black' : 'text-gray-400'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[10px]">支払い</span>
          </button>
        </div>
      </div>

      {/* 注文完了サマリーモーダル */}
      {orderConfirmation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            {/* ヘッダー */}
            <div className="px-5 pt-6 pb-4 flex flex-col items-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-black mb-1">注文を送信しました</h2>
              <p className="text-sm text-gray-500">農家の承認をお待ちください</p>
            </div>

            {/* 注文内容 */}
            <div className="px-5 pb-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">お届け先農家</span>
                  <span className="font-bold text-black">{orderConfirmation.farmerName}</span>
                </div>
                <div className="border-t border-gray-200" />
                {orderConfirmation.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">{item.product.name}</span>
                    <span className="font-bold text-black">
                      {item.quantity}{item.product.unit} ・ ¥{(item.product.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-200" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">配送希望日</span>
                  <span className="font-bold text-black">
                    {new Date(orderConfirmation.deliveryDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">合計（税込）</span>
                  <span className="text-xl font-bold text-black">¥{orderConfirmation.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="px-5 pb-6 space-y-3">
              <button
                onClick={handleOpenChatFromConfirmation}
                className="w-full h-12 bg-white border-2 border-gray-300 text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                <MessageSquare className="w-5 h-5" />
                チャットで農家と相談する
              </button>
              <button
                onClick={() => setOrderConfirmation(null)}
                className="w-full h-12 bg-black text-white font-bold rounded-xl flex items-center justify-center hover:bg-gray-800 active:scale-[0.98] transition-all"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
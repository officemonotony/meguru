import { useState } from 'react';
import { LogOut, ShoppingBag, MessageCircle, Truck, Receipt, CheckCircle, MessageSquare, UserCircle } from 'lucide-react';
import { ProfileModal } from '@/app/components/ProfileModal';
import { ChatList } from '@/app/components/ChatList';
import { ChatRoom } from '@/app/components/ChatRoom';
import { OrderTab } from '@/app/components/OrderTab';
import { HistoryTab } from '@/app/components/HistoryTab';
import { MonthlyInvoice } from '@/app/components/MonthlyInvoice';
import { SubscriptionProposal } from '@/app/components/ProposalForm';
import { useData } from '@/app/context/DataContext';
import { useAuth } from '@/app/context/AuthContext';

interface RestaurantDashboardProps {
  onLogout: () => void;
}

type Tab = 'chat' | 'order' | 'history' | 'payment';

export function RestaurantDashboard({ onLogout }: RestaurantDashboardProps) {
  const { user, profile } = useAuth();
  const { addChat, addProposal, addMessage, addDeliverySchedule, markChatAsRead, getTotalUnread, chats } = useData();
  const [activeTab, setActiveTab] = useState<Tab>('order');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatName, setSelectedChatName] = useState<string>('');
  const [selectedChatAvatar, setSelectedChatAvatar] = useState<string>('');
  const [orderConfirmation, setOrderConfirmation] = useState<{
    chatId: string;
    farmerName: string;
    items: { product: { name: string; unit: string; price: number }; quantity: number }[];
    deliveryDate: string;
    totalAmount: number;
  } | null>(null);

  const myId = user?.id || '';
  const myName = profile?.shop_name || '';
  const [showProfile, setShowProfile] = useState(false);

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    markChatAsRead(chatId, 'restaurant');
    const chat = chats.find(c => c.id === chatId);
    setSelectedChatName(chat?.name || '');
    setSelectedChatAvatar(chat?.avatarUrl || '');
    setActiveTab('chat');
  };

  const handleBackToList = () => {
    setSelectedChatId(null);
    setSelectedChatName('');
    setSelectedChatAvatar('');
  };

  const handleProposalSubmit = async (proposal: Omit<SubscriptionProposal, 'id' | 'status' | 'createdAt'>) => {
    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const chatId = await addChat({
      id: '',
      name: proposal.farmerName,
      lastMessage: '継続の提案',
      timestamp: now,
      unread: 0,
      farmerId: proposal.farmerId,
      restaurantId: myId,
    });
    if (!chatId) return;

    const proposalId = `proposal-${Date.now()}`;
    addProposal({
      ...proposal,
      id: proposalId,
      restaurantId: myId,
      restaurantName: myName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    const frequencyLabel = { twice_weekly: '週２回', weekly: '週１回', biweekly: '隔週', monthly: '月１回' }[proposal.frequency] || proposal.frequency;
    addMessage(chatId, {
      id: proposalId,
      text: '',
      sender: 'restaurant',
      timestamp: now,
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

  const handleDeliveryRequest = async (request: any) => {
    const farmerId: string = request.farmerId;
    const farmerName: string = request.farmerName;
    if (!farmerId) return;

    const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const chatId = await addChat({
      id: '',
      name: farmerName,
      lastMessage: '配送依頼',
      timestamp: now,
      unread: 0,
      farmerId,
      restaurantId: myId,
    });
    if (!chatId) return;

    const itemsText = request.items
      .map((item: any) => `・${item.product.name} ${item.quantity}${item.product.unit}`)
      .join('\n');
    const messageText = `【配送依頼】\n\n${itemsText}\n\n配送希望日: ${request.deliveryDate}\n合計金額: ¥${request.totalAmount.toLocaleString()}\n\nよろしくお願いいたします。`;

    addMessage(chatId, {
      id: `delivery-request-${Date.now()}`,
      text: messageText,
      sender: 'restaurant',
      timestamp: now,
      type: 'text',
    });

    const productNameCombined = request.items.map((item: any) => item.product.name).join('、');
    const quantityDesc = request.items.map((item: any) => `${item.quantity}${item.product.unit}`).join(' / ');

    addDeliverySchedule({
      id: `onetime-${Date.now()}`,
      subscriptionId: '',
      restaurantName: myName,
      restaurantId: myId,
      productName: productNameCombined,
      quantity: request.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      unit: quantityDesc,
      price: request.totalAmount,
      deliveryDate: request.deliveryDate,
      status: 'ordered' as const,
      orderDate: new Date().toISOString().split('T')[0],
      farmerName,
      farmerId,
      items: request.items.map((item: any) => ({
        productName: item.product.name,
        quantity: item.quantity,
        unit: item.product.unit,
        price: item.product.price * item.quantity,
      })),
      totalAmount: request.totalAmount,
      createdAt: new Date().toISOString(),
    });

    setOrderConfirmation({
      chatId,
      farmerName,
      items: request.items,
      deliveryDate: request.deliveryDate,
      totalAmount: request.totalAmount,
    });
  };

  const handleOpenChatFromConfirmation = () => {
    if (!orderConfirmation) return;
    setOrderConfirmation(null);
    handleSelectChat(orderConfirmation.chatId);
  };

  const chatBadgeCount = getTotalUnread('restaurant');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
        <h1 className="text-lg font-bold text-black">メグル</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowProfile(true)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
              : <UserCircle className="w-5 h-5 text-gray-600" />}
          </button>
          <button onClick={onLogout} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <LogOut className="w-5 h-5 text-gray-600" />
          </button>
        </div>
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

      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} />

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
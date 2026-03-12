import { useState } from 'react';
import { LogOut, Package, MessageCircle, Calendar, Receipt, Truck, Sprout, UserCircle } from 'lucide-react';
import { ChatList } from '@/app/components/ChatList';
import { ChatRoom } from '@/app/components/ChatRoom';
import { FarmerSubscriptionTab } from '@/app/components/FarmerSubscriptionTab';
import { FarmerProductTab } from '@/app/components/FarmerProductTab';
import { MonthlyInvoice } from '@/app/components/MonthlyInvoice';
import { FarmerOrders } from '@/app/components/FarmerOrders';
import { ProfileModal } from '@/app/components/ProfileModal';
import { useData } from '@/app/context/DataContext';
import { useAuth } from '@/app/context/AuthContext';

interface FarmerDashboardProps {
  onLogout: () => void;
}

type Tab = 'products' | 'orders' | 'delivery' | 'chat' | 'billing';

export function FarmerDashboard({ onLogout }: FarmerDashboardProps) {
  const { profile } = useAuth();
  const { messages, proposals, markChatAsRead, getTotalUnread, deliverySchedules, chats } = useData();
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedChatName, setSelectedChatName] = useState<string>('');
  const [selectedChatAvatar, setSelectedChatAvatar] = useState<string>('');
  const [ordersInitialTab, setOrdersInitialTab] = useState<'ordered' | 'approved' | 'delivered' | 'paid' | undefined>(undefined);
  const [deliveryInitialTab, setDeliveryInitialTab] = useState<'ordered' | 'approved' | 'delivered' | 'paid' | undefined>(undefined);
  const [showProfile, setShowProfile] = useState(false);

  const orderBadgeCount = (() => {
    let oneTimeCount = 0;
    Object.entries(messages).forEach(([, chatMessages]) => {
      chatMessages.forEach((message, idx) => {
        if (message.text?.includes('【配送依頼】') && message.sender === 'restaurant') {
          const schedule = deliverySchedules.find(d => d.id === `onetime-${message.id}`);
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
    const pendingProposalCount = proposals.filter(p => p.status === 'pending').length;
    return oneTimeCount + pendingProposalCount;
  })();

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    markChatAsRead(chatId, 'farmer');
    const chat = chats.find(c => c.id === chatId);
    setSelectedChatName(chat?.name || '');
    setSelectedChatAvatar(chat?.avatarUrl || '');
  };

  const handleBackToList = () => {
    setSelectedChatId(null);
    setSelectedChatName('');
    setSelectedChatAvatar('');
  };

  const handleOpenChatFromProposal = (restaurantId: string, restaurantName: string) => {
    const chat = chats.find(c => c.restaurantId === restaurantId);
    if (!chat) return;
    setSelectedChatId(chat.id);
    setSelectedChatName(restaurantName);
    setSelectedChatAvatar(chat.avatarUrl || '');
    markChatAsRead(chat.id, 'farmer');
    setActiveTab('chat');
  };

  const chatBadgeCount = getTotalUnread('farmer');
  const billingBadgeCount = deliverySchedules.filter(d => d.status === 'delivered').length;
  const deliveryBadgeCount = deliverySchedules.filter(d => d.status === 'approved').length;

  const navItems: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'products', label: 'うちの商品', icon: <Package className="w-5 h-5" /> },
    { id: 'orders', label: '注文管理', icon: <Calendar className="w-5 h-5" />, badge: orderBadgeCount },
    { id: 'chat', label: 'チャット', icon: <MessageCircle className="w-5 h-5" />, badge: chatBadgeCount },
    { id: 'delivery', label: 'お届け', icon: <Truck className="w-5 h-5" />, badge: deliveryBadgeCount },
    { id: 'billing', label: '売上', icon: <Receipt className="w-5 h-5" />, badge: billingBadgeCount },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 fixed top-0 left-0 bottom-0 z-30">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
              <Sprout className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-black">メグル</span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                activeTab === item.id
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className={`ml-auto text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 ${
                  activeTab === item.id ? 'bg-white text-black' : 'bg-red-500 text-white'
                }`}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Profile & Logout */}
        <div className="p-3 border-t border-gray-200 space-y-1">
          <button
            onClick={() => setShowProfile(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center shrink-0">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : <UserCircle className="w-5 h-5" />}
            </div>
            <span className="truncate">{profile?.shop_name || 'プロフィール'}</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>ログアウト</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
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

        {/* Content */}
        <div className="flex-1 md:pt-0 pt-14 pb-16 md:pb-0">
          {activeTab === 'products' && <FarmerProductTab />}
          {activeTab === 'orders' && (
            <FarmerSubscriptionTab
              onOpenChat={handleOpenChatFromProposal}
              onNavigateToDelivery={(tab) => { setDeliveryInitialTab(tab); setActiveTab('delivery'); }}
            />
          )}
          {activeTab === 'delivery' && (
            <FarmerOrders onOpenChat={handleOpenChatFromProposal} initialTab={deliveryInitialTab} />
          )}
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
      </div>

      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} />

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
        <div className="flex">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
                activeTab === item.id ? 'text-black' : 'text-gray-400'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px]">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

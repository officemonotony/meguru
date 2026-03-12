import { useState } from 'react';
import { MessageCircle, Search } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { useData } from '@/app/context/DataContext';

export interface ChatRoom {
  id: string;
  name: string;
  type: 'farmer' | 'restaurant';
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatarUrl?: string;
  restaurantId?: string;
  farmerId?: string;
}

interface ChatListProps {
  userType: 'farmer' | 'restaurant';
  onSelectChat: (chatId: string) => void;
}

export function ChatList({ userType, onSelectChat }: ChatListProps) {
  const { chats, unreadCounts } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  
  // userTypeに基づいてチャットをフィルタリング
  // 農家の場合は飲食店とのチャット（restaurantIdがあるもの）を表示
  // 飲食店の場合は農家とのチャット（farmerIdがあるもの）を表示
  const relevantChats = chats.filter(chat => {
    if (userType === 'farmer') {
      return chat.restaurantId !== undefined;
    } else {
      return chat.farmerId !== undefined;
    }
  });
  
  const filteredChats = relevantChats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = relevantChats.reduce((sum, chat) => sum + (unreadCounts[chat.id]?.[userType] || 0), 0);

  if (filteredChats.length === 0 && searchQuery === '') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh]">
        <div className="bg-gray-100 rounded-full p-8 mb-6">
          <MessageCircle className="w-16 h-16 text-gray-400" />
        </div>
        <p className="text-xl text-gray-600 font-bold mb-2">チャットがありません</p>
        <p className="text-base text-gray-600 mb-6">
          {userType === 'restaurant'
            ? '商品を注文すると、農家とのチャットが自動で開始されます'
            : '飲食店から注文や提案があると、チャットが始まります'}
        </p>
        <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-5 w-full max-w-sm">
          <p className="text-xs font-bold text-gray-700 mb-3">チャットでできること</p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <span className="text-sm">💬</span>
              <p className="text-xs text-gray-600 text-left">注文内容の相談・変更の依頼</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-sm">📦</span>
              <p className="text-xs text-gray-600 text-left">配送日時の調整</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-sm">📋</span>
              <p className="text-xs text-gray-600 text-left">注文の承認・お断り・変更提案の通知</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-black mb-4">
          メッセージ
          {totalUnread > 0 && (
            <span className="ml-3 bg-black text-white text-lg px-3 py-1 rounded-full">
              {totalUnread}
            </span>
          )}
        </h2>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 h-14 text-lg rounded-xl border-2 border-gray-300 focus:border-black"
          />
        </div>
      </div>

      <div className="space-y-0">
        {filteredChats.map((chat) => {
          const displayName = chat.name;
          const displayAvatar = chat.avatarUrl;

          return (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className="w-full bg-white border-b border-gray-200 px-5 py-4 hover:bg-gray-50 transition-colors active:bg-gray-100 text-left"
            >
              <div className="flex gap-4 items-center">
                <div className="relative flex-shrink-0">
                  <ImageWithFallback
                    src={displayAvatar || ''}
                    alt={displayName}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  {(unreadCounts[chat.id]?.[userType] || 0) > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1">
                      {unreadCounts[chat.id][userType] > 99 ? '99+' : unreadCounts[chat.id][userType]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-black">{displayName}</h3>
                    <span className="text-base text-gray-500">{chat.timestamp}</span>
                  </div>
                  <p className="text-base text-gray-600 truncate">{chat.lastMessage}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {filteredChats.length === 0 && searchQuery !== '' && (
        <div className="text-center py-12">
          <p className="text-lg text-gray-600">「{searchQuery}」の検索結果がありません</p>
        </div>
      )}
    </div>
  );
}
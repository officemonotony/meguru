import { useData, DeliverySchedule } from '@/app/context/DataContext';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { toast } from 'sonner';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, Clock, Package, CircleDollarSign, MessageSquare, AlertTriangle, X, Undo2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { SwipeButton } from '@/app/components/SwipeButton';

const statusConfig = {
  ordered: { label: '承認依頼', icon: Clock, color: 'bg-red-500', lightBg: 'bg-red-50' },
  approved: { label: 'お届け予定', icon: CheckCircle, color: 'bg-blue-500', lightBg: 'bg-blue-50' },
  delivered: { label: '配達完了', icon: Package, color: 'bg-green-500', lightBg: 'bg-green-50' },
  paid: { label: '受取済', icon: CircleDollarSign, color: 'bg-gray-800', lightBg: 'bg-gray-50' },
};

interface FarmerOrdersCalendarProps {
  onOpenChat?: (restaurantId: string, restaurantName: string) => void;
  initialTab?: 'ordered' | 'approved' | 'delivered' | 'paid';
}

export function FarmerOrdersCalendar({ onOpenChat, initialTab }: FarmerOrdersCalendarProps) {
  const { deliverySchedules, updateDeliverySchedule, messages, chats, addMessage, products } = useData();
  const [currentDate, setCurrentDate] = useState(new Date()); // 現在の月を表示
  const [activeTab, setActiveTab] = useState<'ordered' | 'approved' | 'delivered' | 'paid'>(initialTab || 'ordered');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // A: 承認取消確認ダイアログ
  const [cancelApprovalTarget, setCancelApprovalTarget] = useState<DeliverySchedule | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // B: 配達完了取消確認ダイアログ
  const [cancelDeliveryTarget, setCancelDeliveryTarget] = useState<DeliverySchedule | null>(null);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // メッセージから未承認の配送依頼を抽出し、仮のDeliveryScheduleとして返す
  const getPendingRequestSchedules = (): DeliverySchedule[] => {
    const pending: DeliverySchedule[] = [];

    Object.entries(messages).forEach(([chatId, chatMessages]) => {
      const chat = chats.find(c => c.id === chatId);
      const restaurantId = chat?.restaurantId || '';
      const restaurantName = chat?.name || '';

      chatMessages.forEach(message => {
        if (message.text?.includes('【配送依頼】') && message.sender === 'restaurant') {
          // 既に承認済み（deliverySchedulesに登録済み）ならスキップ
          const isApproved = deliverySchedules.some(d => d.id === `onetime-${message.id}`);
          if (isApproved) return;

          // お断り済み or 変更提案中ならスキップ
          const msgIndex = chatMessages.indexOf(message);
          const afterMessages = chatMessages.slice(msgIndex + 1);
          const isDeclined = afterMessages.some(m => m.text?.includes('【お断り】'));
          const hasCounterProposal = afterMessages.some(m => m.type === 'counterProposal' && m.counterProposalData?.originalMessageId === message.id);
          if (isDeclined || hasCounterProposal) return;

          const lines = message.text.split('\n');
          let deliveryDate = '';
          let totalAmount = 0;
          const items: { productName: string; quantity: number; unit: string }[] = [];

          lines.forEach(line => {
            if (line.startsWith('・')) {
              const match = line.match(/・(.+?)\s+(\d+)(\w+)/);
              if (match) {
                items.push({
                  productName: match[1],
                  quantity: parseInt(match[2]),
                  unit: match[3],
                });
              }
            } else if (line.includes('配送希望日:')) {
              deliveryDate = line.split('配送希望日:')[1].trim();
            } else if (line.includes('合計金額:')) {
              const amountMatch = line.match(/¥([\d,]+)/);
              if (amountMatch) {
                totalAmount = parseInt(amountMatch[1].replace(/,/g, ''));
              }
            }
          });

          if (items.length > 0 && deliveryDate) {
            // 日本語日付をISO形式に変換
            let isoDate = '';
            const dateMatch = deliveryDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
            if (dateMatch) {
              isoDate = `${dateMatch[1]}-${String(parseInt(dateMatch[2])).padStart(2, '0')}-${String(parseInt(dateMatch[3])).padStart(2, '0')}`;
            } else {
              isoDate = deliveryDate;
            }

            const productNameCombined = items.map(item => item.productName).join('、');

            pending.push({
              id: `pending-${message.id}`,
              subscriptionId: '',
              restaurantName,
              restaurantId,
              productName: productNameCombined,
              quantity: items.reduce((sum, item) => sum + item.quantity, 0),
              unit: items.map(item => `${item.quantity}${item.unit}`).join(' / '),
              price: totalAmount,
              deliveryDate: isoDate,
              status: 'ordered' as const,
              orderDate: new Date().toISOString().split('T')[0],
              farmerName: '',
              farmerId: '',
              items: [],
              totalAmount: totalAmount,
              createdAt: new Date().toISOString(),
            });
          }
        }
      });
    });

    return pending;
  };

  const pendingSchedules = getPendingRequestSchedules();

  const getOrdersForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = deliverySchedules.filter(order => order.deliveryDate === dateStr);
    const pending = pendingSchedules.filter(order => order.deliveryDate === dateStr);
    return [...existing, ...pending];
  };

  const handleUnconfirm = (orderId: string) => {
    updateDeliverySchedule(orderId, { status: 'ordered' as const });
  };

  const handleDeliver = (orderId: string) => {
    updateDeliverySchedule(orderId, { status: 'delivered' as const });

    // A: 配達完了時にチャットへ自動通知
    const delivery = deliverySchedules.find(d => d.id === orderId);
    if (delivery) {
      const chatId = getChatIdForRestaurant(delivery.restaurantId);
      if (chatId) {
        const dateFmt = new Date(delivery.deliveryDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
        addMessage(chatId, {
          id: `delivery-complete-${Date.now()}`,
          text: `【配達完了】\n${delivery.productName}（${dateFmt}お届け分）の配達が完了しました。\n\nご確認よろしくお願いいたします。`,
          sender: 'farmer',
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }
  };

  // E: 配達予定日の超過チェック
  const isOverdue = (delivery: DeliverySchedule) => {
    if (delivery.status !== 'approved') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveryDate = new Date(delivery.deliveryDate);
    deliveryDate.setHours(0, 0, 0, 0);
    return deliveryDate < today;
  };

  // A: チャットIDを飲食店IDから取得するヘルパー
  const getChatIdForRestaurant = (restaurantId: string): string | undefined => {
    const chat = chats.find(c => c.restaurantId === restaurantId);
    return chat?.id;
  };

  // A: 承認取消の確認処理
  const handleCancelApprovalConfirm = () => {
    if (!cancelApprovalTarget) return;

    handleUnconfirm(cancelApprovalTarget.id);

    // チャットに取消通知を送信
    const chatId = getChatIdForRestaurant(cancelApprovalTarget.restaurantId);
    if (chatId) {
      const reasonText = cancelReason.trim() ? `\n理由: ${cancelReason.trim()}` : '';
      addMessage(chatId, {
        id: `cancel-approval-${Date.now()}`,
        text: `【承認取消】\n${cancelApprovalTarget.productName}（${new Date(cancelApprovalTarget.deliveryDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}お届け分）の承認を取り消しました。${reasonText}`,
        sender: 'farmer',
        timestamp: new Date().toISOString(),
      });
    }

    toast.success('承認を取り消しました');
    setCancelApprovalTarget(null);
    setCancelReason('');
  };

  // B: 配達完了取消の確認処理
  const handleCancelDeliveryConfirm = () => {
    if (!cancelDeliveryTarget) return;

    updateDeliverySchedule(cancelDeliveryTarget.id, { status: 'approved' as const });

    toast.success('配達完了を取り消しました');
    setCancelDeliveryTarget(null);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  const orderedOrders = deliverySchedules.filter((o) => o.status === 'ordered');
  const confirmedOrders = deliverySchedules.filter((o) => o.status === 'approved');
  const deliveredOrders = deliverySchedules.filter((o) => o.status === 'delivered');
  const paidOrders = deliverySchedules.filter((o) => o.status === 'paid');

  // フィルタリングされた注文リスト
  const filteredOrders = deliverySchedules.filter(o => o.status === activeTab);

  const DeliveryCard = ({ delivery }: { delivery: DeliverySchedule }) => {
    const config = statusConfig[delivery.status];
    const Icon = config.icon;
    const overdue = isOverdue(delivery);

    // 商品画像を取得
    const productImage = products.find(p => delivery.productName.includes(p.name))?.imageUrl;

    return (
      <div className={`bg-white border-2 rounded-2xl p-4 mb-3 ${overdue ? 'border-amber-400' : 'border-gray-300'}`}>
        {/* E: 配達予定日超過警告 */}
        {overdue && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm font-bold text-amber-700">配達予定日を過ぎています</span>
          </div>
        )}

        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1">
            {productImage && (
              <ImageWithFallback src={productImage} alt={delivery.productName} className="w-12 h-12 rounded-xl object-cover shrink-0" />
            )}
            <div className="flex-1">
              <div className="text-lg font-bold text-black mb-1">{delivery.restaurantName}</div>
              <div className="text-sm text-gray-600 mb-0.5">注文番号: {delivery.id}</div>
              <div className="text-sm text-gray-500">
                注文日: {new Date(delivery.orderDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>
          <div className={`${config.color} text-white text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold`}>
            <Icon className="w-4 h-4" />
            {config.label}
          </div>
        </div>

        <div className="border-t-2 border-gray-200 pt-3 space-y-2 mb-3">
          <div className="flex justify-between text-base">
            <span className="text-gray-700 font-medium">
              {delivery.productName} × {delivery.quantity}{delivery.unit}
            </span>
            <span className="text-black font-bold">¥{delivery.price.toLocaleString()}</span>
          </div>
        </div>

        <div className="border-t-2 border-gray-200 pt-3 space-y-2">
          <div className="flex justify-between text-base">
            <span className={`font-bold ${overdue ? 'text-amber-600' : 'text-gray-600'}`}>納品予定日</span>
            <span className={`font-bold ${overdue ? 'text-amber-600' : 'text-black'}`}>
              {new Date(delivery.deliveryDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-base font-bold text-black">合計金額</span>
            <span className="text-xl font-bold text-black">¥{delivery.price.toLocaleString()}</span>
          </div>
        </div>

        {/* C: ordered → チャットで確認に変更 */}
        {delivery.status === 'ordered' && (
          <Button
            onClick={() => {
              if (onOpenChat) {
                onOpenChat(delivery.restaurantId, delivery.restaurantName);
              }
            }}
            className="w-full mt-4 bg-black text-white hover:bg-gray-800 h-12 text-base font-bold rounded-xl active:scale-[0.98]"
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            チャットで確認する
          </Button>
        )}

        {delivery.status === 'approved' && (
          <div className="space-y-2 mt-4">
            <SwipeButton
              onComplete={() => handleDeliver(delivery.id)}
              text="配達完了"
              completedText="配達完了しました"
              confirmMessage={(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const scheduled = new Date(delivery.deliveryDate);
                scheduled.setHours(0, 0, 0, 0);
                const diffDays = Math.round((today.getTime() - scheduled.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays === 0) return undefined;
                const scheduledStr = `${scheduled.getMonth() + 1}/${scheduled.getDate()}`;
                if (diffDays > 0) {
                  return `納品予定日（${scheduledStr}）から${diffDays}日過ぎています。\nこのまま配達完了にしますか？`;
                }
                return `納品予定日（${scheduledStr}）より${Math.abs(diffDays)}日早いです。\nこのまま配達完了にしますか？`;
              })()}
            />
            {/* A: 承認取消に確認ダイアログを追加 */}
            <Button
              onClick={() => setCancelApprovalTarget(delivery)}
              variant="ghost"
              className="w-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 h-10 text-sm font-normal rounded-lg"
            >
              承認を取り消す
            </Button>
          </div>
        )}

        {/* B: 配達完了の取消手段を追加 */}
        {delivery.status === 'delivered' && (
          <div className="mt-4 space-y-2">
            <div className="p-3 bg-green-50 border-2 border-green-500 rounded-2xl text-center">
              <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-1" />
              <p className="text-base font-bold text-green-700">配達完了</p>
              <p className="text-xs text-green-600">お届けが完了しました</p>
            </div>
            <Button
              onClick={() => setCancelDeliveryTarget(delivery)}
              variant="ghost"
              className="w-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 h-10 text-sm font-normal rounded-lg"
            >
              <Undo2 className="w-4 h-4 mr-1" />
              配達完了を取り消す
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
        <div className="p-4 md:p-6">
          <div className="md:grid md:grid-cols-[340px_1fr] md:gap-6">
          {/* 左カラム: カレンダー */}
          <div className="md:sticky md:top-6 md:self-start">
          {/* カレンダー */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={previousMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-lg font-bold text-black">
                {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
              </h2>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* 凡例 */}
            <div className="flex items-center justify-center gap-3 mb-3 text-xs flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span className="text-gray-600">承認依頼</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span className="text-gray-600">お届け予定</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-gray-600">配達完了</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gray-800" />
                <span className="text-gray-600">受取済</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                <div key={day} className="text-center text-xs font-bold text-gray-600 py-2">
                  {day}
                </div>
              ))}
              
              {emptyDays.map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}
              
              {days.map((day) => {
                const dayOrders = getOrdersForDate(day);
                const hasOrders = dayOrders.length > 0;
                const today = new Date();
                const isToday = day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    className={`aspect-square border rounded-lg p-1 transition-colors ${
                      isSelected ? 'border-black bg-gray-100 border-2' :
                      isToday ? 'border-black bg-white' :
                      hasOrders ? 'border-gray-200 bg-gray-50' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                  >
                    <div className={`text-xs text-center mb-1 ${isToday ? 'font-bold text-black' : 'text-gray-700'}`}>{day}</div>
                    {hasOrders && (
                      <div className="flex items-center justify-center gap-0.5 flex-wrap">
                        {dayOrders.slice(0, 3).map((order) => {
                          const config = statusConfig[order.status];
                          return (
                            <div
                              key={order.id}
                              className={`${config.color} rounded-full w-1.5 h-1.5`}
                            />
                          );
                        })}
                        {dayOrders.length > 3 && (
                          <div className="text-[8px] text-center text-gray-600">+{dayOrders.length - 3}</div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>{/* カレンダーcard終わり */}

          {/* 選択した日付の注文サマリー */}
          {selectedDay !== null && (() => {
            const dayOrders = getOrdersForDate(selectedDay);
            const dateStr = `${currentDate.getMonth() + 1}月${selectedDay}日`;
            return (
              <div className="bg-white rounded-xl border-2 border-gray-200 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-black">{dateStr}のお届け</h3>
                  <button onClick={() => setSelectedDay(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                {dayOrders.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">この日のお届けはありません</p>
                ) : (
                  <div className="space-y-2">
                    {dayOrders.map((order) => {
                      const config = statusConfig[order.status];
                      return (
                        <div key={order.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                          <div className={`${config.color} w-2.5 h-2.5 rounded-full shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-black truncate">{order.productName}</p>
                            <p className="text-xs text-gray-500">{order.restaurantName} ・ {order.quantity}{order.unit}</p>
                          </div>
                          <span className="text-sm font-bold text-black">¥{order.price.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          </div>{/* 左カラム終わり */}

          {/* 右カラム: ステータスとリスト */}
          <div>
          {/* D: ステータスタブ - 4列 */}
          <div className="bg-white rounded-2xl border-2 border-gray-300 mb-4 overflow-hidden">
            <div className="grid grid-cols-4 divide-x-2 divide-gray-300">
              <button
                onClick={() => setActiveTab('ordered')}
                className={`py-4 flex flex-col items-center gap-1.5 transition-colors ${
                  activeTab === 'ordered' ? statusConfig.ordered.lightBg : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className={`${statusConfig.ordered.color} w-9 h-9 rounded-full flex items-center justify-center`}>
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <div className="text-[11px] font-bold text-gray-700">{statusConfig.ordered.label}</div>
                <div className="text-xl font-bold text-black">{orderedOrders.length}</div>
              </button>
              <button
                onClick={() => setActiveTab('approved')}
                className={`py-4 flex flex-col items-center gap-1.5 transition-colors ${
                  activeTab === 'approved' ? statusConfig.approved.lightBg : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className={`${statusConfig.approved.color} w-9 h-9 rounded-full flex items-center justify-center`}>
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div className="text-[11px] font-bold text-gray-700">お届け予定</div>
                <div className="text-xl font-bold text-black">{confirmedOrders.length}</div>
              </button>
              <button
                onClick={() => setActiveTab('delivered')}
                className={`py-4 flex flex-col items-center gap-1.5 transition-colors ${
                  activeTab === 'delivered' ? statusConfig.delivered.lightBg : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className={`${statusConfig.delivered.color} w-9 h-9 rounded-full flex items-center justify-center`}>
                  <Package className="w-4 h-4 text-white" />
                </div>
                <div className="text-[11px] font-bold text-gray-700">{statusConfig.delivered.label}</div>
                <div className="text-xl font-bold text-black">{deliveredOrders.length}</div>
              </button>
              <button
                onClick={() => setActiveTab('paid')}
                className={`py-4 flex flex-col items-center gap-1.5 transition-colors ${
                  activeTab === 'paid' ? statusConfig.paid.lightBg : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className={`${statusConfig.paid.color} w-9 h-9 rounded-full flex items-center justify-center`}>
                  <CircleDollarSign className="w-4 h-4 text-white" />
                </div>
                <div className="text-[11px] font-bold text-gray-700">{statusConfig.paid.label}</div>
                <div className="text-xl font-bold text-black">{paidOrders.length}</div>
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh]">
                <div className="bg-gray-100 rounded-full p-6 mb-4">
                  {activeTab === 'ordered' && <Clock className="w-12 h-12 text-gray-400" />}
                  {activeTab === 'approved' && <CheckCircle className="w-12 h-12 text-gray-400" />}
                  {activeTab === 'delivered' && <Package className="w-12 h-12 text-gray-400" />}
                  {activeTab === 'paid' && <CircleDollarSign className="w-12 h-12 text-gray-400" />}
                </div>
                <p className="text-base font-bold text-gray-600 mb-1">
                  {activeTab === 'ordered' && '承認依頼中の注文はありません'}
                  {activeTab === 'approved' && 'お届け予定の注文はありません'}
                  {activeTab === 'delivered' && '配達完了の注文はありません'}
                  {activeTab === 'paid' && '受取済の注文はありません'}
                </p>
                <p className="text-sm text-gray-500">
                  {activeTab === 'ordered' && '飲食店から注文が届くとここに表示されます'}
                  {activeTab === 'approved' && '注文を承認するとお届け予定に追加されます'}
                  {activeTab === 'delivered' && 'お届け予定の注文を配達完了にするとここに移動します'}
                  {activeTab === 'paid' && '飲食店が受け取りを確認するとここに表示されます'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <DeliveryCard key={order.id} delivery={order} />
                ))}
              </div>
            )}
          </div>
          </div>{/* 右カラム終わり */}
          </div>{/* グリッド終わり */}
        </div>

      {/* A: 承認取消確認モーダル */}
      {cancelApprovalTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-black">承認を取り消しますか？</h3>
              <button
                onClick={() => { setCancelApprovalTarget(null); setCancelReason(''); }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-base font-bold text-black mb-1">{cancelApprovalTarget.productName}</p>
              <p className="text-sm text-gray-600">
                {cancelApprovalTarget.restaurantName} ・ {new Date(cancelApprovalTarget.deliveryDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}お届け分
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              飲食店に取消が通知されます。理由を入力すると、チャットに自動送信されます。
            </p>

            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="取消理由（任意）"
              className="w-full border-2 border-gray-200 rounded-xl p-3 text-base mb-4 resize-none h-20 focus:outline-none focus:border-gray-400"
            />

            <div className="flex gap-3">
              <Button
                onClick={() => { setCancelApprovalTarget(null); setCancelReason(''); }}
                variant="outline"
                className="flex-1 h-12 text-base font-bold rounded-xl border-2"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleCancelApprovalConfirm}
                className="flex-1 h-12 text-base font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white"
              >
                取り消す
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* B: 配達完了取消確認モーダル */}
      {cancelDeliveryTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-black">配達完了を取り消しますか？</h3>
              <button
                onClick={() => setCancelDeliveryTarget(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-base font-bold text-black mb-1">{cancelDeliveryTarget.productName}</p>
              <p className="text-sm text-gray-600">
                {cancelDeliveryTarget.restaurantName} ・ {new Date(cancelDeliveryTarget.deliveryDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}お届け分
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              ステータスが「お届け予定」に戻ります。
            </p>

            <div className="flex gap-3">
              <Button
                onClick={() => setCancelDeliveryTarget(null)}
                variant="outline"
                className="flex-1 h-12 text-base font-bold rounded-xl border-2"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleCancelDeliveryConfirm}
                className="flex-1 h-12 text-base font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white"
              >
                取り消す
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
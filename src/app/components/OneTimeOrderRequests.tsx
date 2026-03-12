import { useState } from 'react';
import { Calendar, Package, User, MessageCircle, Clock, CheckCircle, Repeat, XCircle, ChevronRight, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useData } from '@/app/context/DataContext';

interface OneTimeOrderRequestsProps {
  onOpenChat?: (restaurantId: string, restaurantName: string) => void;
  onNavigateToOrders?: (tab?: 'ordered' | 'approved' | 'delivered' | 'paid') => void;
}

interface OrderRequest {
  id: string;
  chatId: string;
  restaurantId: string;
  restaurantName: string;
  items: {
    productName: string;
    quantity: number;
    unit: string;
  }[];
  deliveryDate: string;
  totalAmount: number;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'counterProposed' | 'declined';
}

export function OneTimeOrderRequests({ onOpenChat, onNavigateToOrders }: OneTimeOrderRequestsProps) {
  const { messages, deliverySchedules, updateDeliverySchedule, addDeliverySchedule, addMessage, chats } = useData();
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'counterProposed' | 'declined'>('pending');
  const [approveTarget, setApproveTarget] = useState<OrderRequest | null>(null);

  // メッセージから配送依頼を抽出
  const extractOrderRequests = (): OrderRequest[] => {
    const requests: OrderRequest[] = [];
    
    Object.entries(messages).forEach(([chatId, chatMessages]) => {
      const chat = chats.find(c => c.id === chatId);
      const restaurantId = chat?.restaurantId || '';
      const restaurantName = chat?.name || '';

      chatMessages.forEach(message => {
        if (message.text?.includes('【配送依頼】') && message.sender === 'restaurant') {
          // メッセージから情報を抽出
          const lines = message.text.split('\n');
          const items: any[] = [];
          let deliveryDate = '';
          let totalAmount = 0;
          
          lines.forEach(line => {
            if (line.startsWith('・')) {
              // 商品行を解析
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
          
          if (items.length > 0) {
            // ステータス判定
            const schedule = deliverySchedules.find(d => d.id === `onetime-${message.id}`);
            const isApproved = schedule ? schedule.status !== 'ordered' : false;
            
            // お断り or 変更提案をチャットメッセージからチェック
            const msgIndex = chatMessages.indexOf(message);
            const afterMessages = chatMessages.slice(msgIndex + 1);
            const isDeclined = afterMessages.some(m => m.text?.includes('【お断り】'));
            const hasCounter = afterMessages.some(m => m.type === 'counterProposal' && m.counterProposalData?.originalMessageId === message.id);
            
            let status: OrderRequest['status'] = 'pending';
            if (isApproved) status = 'confirmed';
            else if (isDeclined) status = 'declined';
            else if (hasCounter) status = 'counterProposed';
            
            requests.push({
              id: message.id,
              chatId,
              restaurantId,
              restaurantName,
              items,
              deliveryDate,
              totalAmount,
              createdAt: message.timestamp,
              status,
            });
          }
        }
      });
    });
    
    return requests;
  };

  // 承認処理：既存のDeliveryScheduleを「承認済み」に更新
  const handleApprove = (request: OrderRequest) => {
    // 配送希望日をISO形式に変換
    let isoDate = '';
    if (request.deliveryDate) {
      // "2026年2月15日" → "2026-02-15" のような変換を試みる
      const dateMatch = request.deliveryDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (dateMatch) {
        isoDate = `${dateMatch[1]}-${String(parseInt(dateMatch[2])).padStart(2, '0')}-${String(parseInt(dateMatch[3])).padStart(2, '0')}`;
      } else {
        // そのまま使用（ISO形式の場合）
        isoDate = request.deliveryDate;
      }
    }
    if (!isoDate) {
      isoDate = new Date().toISOString().split('T')[0];
    }

    // 商品名をまとめる
    const productNameCombined = request.items.map(item => `${item.productName}`).join('、');
    const quantityDesc = request.items.map(item => `${item.quantity}${item.unit}`).join(' / ');

    // 既存のスケジュールがあれば更新、なければ新規作成
    const existingSchedule = deliverySchedules.find(d => d.id === `onetime-${request.id}`);
    if (existingSchedule) {
      updateDeliverySchedule(`onetime-${request.id}`, { status: 'approved' as const });
    } else {
      addDeliverySchedule({
        id: `onetime-${request.id}`,
        subscriptionId: '',
        restaurantName: request.restaurantName,
        restaurantId: request.restaurantId,
        productName: productNameCombined,
        quantity: request.items.reduce((sum, item) => sum + item.quantity, 0),
        unit: quantityDesc,
        price: request.totalAmount,
        deliveryDate: isoDate,
        status: 'approved' as const,
        orderDate: new Date().toISOString().split('T')[0],
              farmerName: '',
        farmerId: '',
        items: [],
        totalAmount: 0,
        createdAt: new Date().toISOString(),
      });
    }

    // チャットに承認メッセージを自動送信
    const itemsSummary = request.items
      .map(item => `${item.productName} ${item.quantity}${item.unit}`)
      .join('、');
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    addMessage(request.chatId, {
      id: `approve-${request.id}-${Date.now()}`,
      text: `【注文承認】\n単発注文を承認しました。\n\n${itemsSummary}\n配送予定日: ${request.deliveryDate}\n合計金額: ¥${request.totalAmount.toLocaleString()}\n\nお届け予定に追加されました。`,
      sender: 'farmer',
      timestamp: timeStr,
      type: 'text',
    });
  };

  const orderRequests = extractOrderRequests();
  
  const filteredRequests = orderRequests.filter(
    (req) => filter === 'all' || req.status === filter
  );

  const pendingCount = orderRequests.filter((r) => r.status === 'pending').length;
  const confirmedCount = orderRequests.filter((r) => r.status === 'confirmed').length;
  const counterProposedCount = orderRequests.filter((r) => r.status === 'counterProposed').length;
  const declinedCount = orderRequests.filter((r) => r.status === 'declined').length;

  if (orderRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh]">
        <div className="bg-gray-100 rounded-full p-8 mb-6">
          <Package className="w-16 h-16 text-gray-400" />
        </div>
        <p className="text-xl text-gray-600 font-bold mb-2">単発注文の依頼がありません</p>
        <p className="text-base text-gray-600 mb-6">
          飲食店から配送依頼が届くと<br />
          ここに表示されます
        </p>
        <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-5 w-full max-w-sm">
          <p className="text-xs font-bold text-gray-700 mb-3">注文が届くまでの流れ</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
              <p className="text-xs text-gray-600 text-left">「うちの商品」タブで商品を登録・公開する</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
              <p className="text-xs text-gray-600 text-left">飲食店が商品を見つけて注文を送信</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
              <p className="text-xs text-gray-600 text-left">ここに注文が届くので、承認して配達へ</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* フィルター */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex-shrink-0 ${
            filter === 'pending'
              ? 'bg-black text-white'
              : 'bg-white border border-gray-300 text-gray-700'
          }`}
        >
          未承認 ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('confirmed')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex-shrink-0 ${
            filter === 'confirmed'
              ? 'bg-black text-white'
              : 'bg-white border border-gray-300 text-gray-700'
          }`}
        >
          承認済 ({confirmedCount})
        </button>
      </div>

      {/* 注文リスト */}
      <div className="space-y-3">
        {filteredRequests.map((request) => (
          <div
            key={request.id}
            className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-black transition-colors"
          >
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gray-600" />
                <span className="font-bold text-black">{request.restaurantName}</span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  request.status === 'pending'
                    ? 'bg-red-100 text-red-700'
                    : request.status === 'confirmed'
                    ? 'bg-blue-100 text-blue-700'
                    : request.status === 'counterProposed'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {request.status === 'pending' ? '承認待ち' : request.status === 'confirmed' ? '承認済み' : request.status === 'counterProposed' ? '交渉中' : '拒否'}
              </span>
            </div>

            {/* 商品リスト */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="space-y-2">
                {request.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.productName}</span>
                    <span className="font-bold text-black">
                      {item.quantity}
                      {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 配送日と金額 */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-600" />
                <span className="text-gray-600">配送希望日:</span>
                <span className="font-bold text-black">{request.deliveryDate}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-gray-600" />
                <span className="text-gray-600">合計金額:</span>
                <span className="font-bold text-black text-lg">
                  ¥{request.totalAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-600" />
                <span className="text-gray-500">{request.createdAt}</span>
              </div>
            </div>

            {/* アクションボタン */}
            {request.status === 'pending' ? (
              <div className="space-y-2">
                <Button
                  onClick={() => setApproveTarget(request)}
                  className="w-full bg-black text-white hover:bg-gray-800 h-12 text-base font-bold rounded-xl"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  承認する
                </Button>
                <Button
                  onClick={() => onOpenChat?.(request.restaurantId, request.restaurantName)}
                  variant="outline"
                  className="w-full border-2 border-gray-300 text-gray-700 hover:bg-gray-50 h-12 text-base font-bold rounded-xl"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  チャットで返信
                </Button>
              </div>
            ) : request.status === 'confirmed' ? (
              <div className="space-y-2">
                <button
                  onClick={() => onNavigateToOrders?.('approved')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-700 font-bold">お届け予定に追加されました</span>
                  <ChevronRight className="w-4 h-4 text-blue-400" />
                </button>
              </div>
            ) : request.status === 'counterProposed' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-3 bg-amber-50 border-2 border-amber-200 rounded-xl">
                  <Repeat className="w-5 h-5 text-amber-600" />
                  <span className="text-amber-700 font-bold">変更を提案中 - 飲食店の回答待ち</span>
                </div>
                <Button
                  onClick={() => onOpenChat?.(request.restaurantId, request.restaurantName)}
                  variant="outline"
                  className="w-full border-2 border-gray-300 text-gray-700 hover:bg-gray-50 h-12 text-base font-bold rounded-xl"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  チャットを確認
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl">
                  <XCircle className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-600 font-bold">お断り済み</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 承認確認ボトムシート */}
      {approveTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={() => setApproveTarget(null)}>
          <div className="bg-white w-full rounded-t-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-black">注文を承認しますか？</h3>
                <button onClick={() => setApproveTarget(null)} className="p-2 hover:bg-gray-100 rounded-xl active:scale-95">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-gray-600" />
                  <span className="font-bold text-black">{approveTarget.restaurantName}</span>
                </div>
                <div className="space-y-2">
                  {approveTarget.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.productName}</span>
                      <span className="font-bold text-black">{item.quantity}{item.unit}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 mt-3 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">配送希望日</span>
                    <span className="font-bold text-black">{approveTarget.deliveryDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">合計金額</span>
                    <span className="font-bold text-black text-lg">¥{approveTarget.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                承認すると「お届け予定」に追加され、飲食店のチャットに通知されます。
              </p>

              <div className="flex gap-3 pb-4">
                <Button
                  onClick={() => setApproveTarget(null)}
                  variant="outline"
                  className="flex-1 border-2 border-gray-300 rounded-xl h-14 text-base font-bold"
                >
                  キャンセル
                </Button>
                <Button
                  onClick={() => {
                    handleApprove(approveTarget);
                    setApproveTarget(null);
                  }}
                  className="flex-1 bg-black text-white hover:bg-gray-800 rounded-xl h-14 text-base font-bold active:scale-[0.98]"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  承認する
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
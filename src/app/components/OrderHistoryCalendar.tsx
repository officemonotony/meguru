import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, Clock, Package, FileText, Truck, CircleDollarSign, AlertTriangle, X } from 'lucide-react';
import { DocumentViewer, DocumentData } from '@/app/components/DocumentViewer';
import { Button } from '@/app/components/ui/button';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { useData } from '@/app/context/DataContext';
import { useAuth } from '@/app/context/AuthContext';
import { toast } from 'sonner';

interface Order {
  id: string;
  date: string;
  items: number;
  total: number;
  status: 'ordered' | 'approved' | 'delivered' | 'paid';
  deliveryDate: string;
  farmerName?: string;
  farmerId?: string;
  paymentMethod?: 'on_delivery' | 'monthly';
  productName?: string;
  quantity?: number;
  unit?: string;
}

const statusConfig = {
  ordered: { label: '注文済み', icon: Clock, color: 'bg-red-500' },
  approved: { label: 'お届け予定', icon: CheckCircle, color: 'bg-blue-500' },
  delivered: { label: '配達完了', icon: Truck, color: 'bg-green-500' },
  paid: { label: '支払済み', icon: CircleDollarSign, color: 'bg-gray-800' },
};

// D: 問題報告のカテゴリ
const issueCategories = [
  { id: 'quantity', label: '数量不足' },
  { id: 'quality', label: '品質不良' },
  { id: 'damage', label: '破損あり' },
  { id: 'wrong', label: '商品違い' },
  { id: 'other', label: 'その他' },
];

export function OrderHistoryCalendar() {
  const { profile } = useAuth();
  const { deliverySchedules, updateDeliverySchedule, chats, addMessage, products } = useData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // B: 受取確認済みフラグ（ステータスは変えないのでローカルで管理）
  const [confirmedReceipts, setConfirmedReceipts] = useState<Set<string>>(new Set());

  // D: 問題報告モーダル
  const [reportTarget, setReportTarget] = useState<Order | null>(null);
  const [reportCategory, setReportCategory] = useState('');
  const [reportDetail, setReportDetail] = useState('');

  // DeliveryScheduleからOrderに変換
  const orders = useMemo<Order[]>(() => {
    return deliverySchedules.map((schedule) => ({
      id: schedule.id,
      date: schedule.orderDate,
      items: 1,
      total: schedule.price,
      status: schedule.status,
      deliveryDate: schedule.deliveryDate,
      farmerName: schedule.farmerName || '農園',
      farmerId: schedule.farmerId || '',
      paymentMethod: 'on_delivery' as const,
      productName: schedule.productName,
      quantity: schedule.quantity,
      unit: schedule.unit,
    }));
  }, [deliverySchedules]);

  // チャットIDを農家IDから取得するヘルパー
  const getChatIdForFarmer = (farmerId: string): string | undefined => {
    const chat = chats.find(c => c.farmerId === farmerId);
    return chat?.id;
  };

  // B: 受取確認
  const handleConfirmReceipt = (order: Order) => {
    setConfirmedReceipts(prev => new Set(prev).add(order.id));

    // チャットに【受取確認】メッセージを送信
    const chatId = getChatIdForFarmer(order.farmerId || '');
    if (chatId) {
      const dateFmt = new Date(order.deliveryDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
      addMessage(chatId, {
        id: `receipt-confirm-${Date.now()}`,
        text: `【受取確認】\n${order.productName}（${dateFmt}お届け分）を受け取りました。\n\nありがとうございます。`,
        sender: 'restaurant',
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      });
    }

    toast.success('受取確認を送信しました', {
      description: `${order.farmerName}さんに通知しました`,
      style: { background: '#000', color: '#fff' },
    });
  };

  // D: 問題報告を送信
  const handleSubmitReport = () => {
    if (!reportTarget || !reportCategory) return;

    const categoryLabel = issueCategories.find(c => c.id === reportCategory)?.label || reportCategory;
    const detailText = reportDetail.trim() ? `\n詳細: ${reportDetail.trim()}` : '';

    const chatId = getChatIdForFarmer(reportTarget.farmerId || '');
    if (chatId) {
      const dateFmt = new Date(reportTarget.deliveryDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
      addMessage(chatId, {
        id: `issue-report-${Date.now()}`,
        text: `【問題報告】\n${reportTarget.productName}（${dateFmt}お届け分）\n\nカテゴリ: ${categoryLabel}${detailText}\n\nご確認をお願いいたします。`,
        sender: 'restaurant',
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      });
    }

    toast.success('問題報告を送信しました', {
      description: `${reportTarget.farmerName}さんに通知しました`,
      style: { background: '#000', color: '#fff' },
    });

    setReportTarget(null);
    setReportCategory('');
    setReportDetail('');
  };

  const generateOrderDocuments = (order: Order): DocumentData[] => {
    const subtotal = order.total;
    const tax = Math.floor(subtotal * 0.1);
    const totalWithTax = subtotal + tax;

    const baseData = {
      orderNumber: order.id,
      issueDate: order.date,
      items: [
        {
          name: order.productName || 'サンプル商品',
          quantity: order.quantity || 1,
          unit: order.unit || 'kg',
          unitPrice: order.total,
          amount: order.total,
        },
      ],
      subtotal,
      tax,
      total: totalWithTax,
      deliveryDate: order.deliveryDate,
      farmerInfo: {
        name: order.farmerName || '農園名',
        address: '〒000-0000 県 市 町 1-2-3',
        phone: '000-0000-0000',
      },
      restaurantInfo: {
        name: profile?.shop_name || order.farmerName || '',
        address: '〒000-0000 県 市 町 4-5-6',
        phone: '000-0000-0000',
      },
      notes: 'お支払いは月末締め・翌月末までにお願いいたします。',
    };

    const documents: DocumentData[] = [];

    // Step 1: 注文書（注文時から閲覧可能）
    if (order.status === 'ordered' || order.status === 'approved' || order.status === 'delivered' || order.status === 'paid') {
      documents.push({
        ...baseData,
        id: `PO-${order.id}`,
        type: 'purchase_order',
      });
    }

    // Step 2: 納品書（配達完了時から閲覧可能）
    if (order.status === 'delivered' || order.status === 'paid') {
      documents.push({
        ...baseData,
        id: `DN-${order.id}`,
        type: 'delivery_note',
      });
    }

    // Step 3: 請求書（配達完了後から閲覧可能）
    if (order.status === 'delivered' || order.status === 'paid') {
      documents.push({
        ...baseData,
        id: `INV-${order.id}`,
        type: 'invoice',
        paymentDueDate: new Date(new Date(order.date).getFullYear(), new Date(order.date).getMonth() + 2, 0).toISOString(),
        paymentStatus: order.status === 'paid' ? 'paid' : 'unpaid',
      });
    }

    // Step 4: 領収書（支払い済みの場合のみ）
    if (order.status === 'paid') {
      documents.push({
        ...baseData,
        id: `RC-${order.id}`,
        type: 'receipt',
        paidDate: order.deliveryDate,
      });
    }

    return documents;
  };

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

  const getOrdersForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return orders.filter(order => order.deliveryDate === dateStr);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div className="p-4">
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
                  <div className="space-y-1">
                    {dayOrders.slice(0, 2).map((order) => {
                      const config = statusConfig[order.status];
                      const Icon = config.icon;
                      return (
                        <div
                          key={order.id}
                          className={`${config.color} rounded px-1 py-0.5 flex items-center justify-center`}
                        >
                          <Icon className="w-2 h-2 text-white" />
                        </div>
                      );
                    })}
                    {dayOrders.length > 2 && (
                      <div className="text-[8px] text-center text-gray-600">+{dayOrders.length - 2}</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

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
                        <p className="text-xs text-gray-500">{order.farmerName} ・ {order.quantity}{order.unit}</p>
                      </div>
                      <span className="text-sm font-bold text-black">¥{order.total.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      <div className="space-y-2 mb-4">
        <h3 className="text-sm font-bold text-gray-700">ステータス</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(statusConfig).map(([status, config]) => {
            const Icon = config.icon;
            return (
              <div key={status} className="flex items-center gap-2">
                <div className={`${config.color} w-4 h-4 rounded flex items-center justify-center`}>
                  <Icon className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs text-gray-700">{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-bold text-black mb-4">注文一覧</h3>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh]">
            <div className="bg-gray-100 rounded-full p-6 mb-4">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-lg text-gray-600 font-bold mb-1">注文履歴がありません</p>
            <p className="text-sm text-gray-500 mb-4">商品を注文すると、ここに配達状況が表示されます</p>
            <p className="text-xs text-gray-400">「注文」タブから農家の商品を探してみましょう</p>
          </div>
        ) : (
          orders.map((order) => {
            const config = statusConfig[order.status];
            const isReceiptConfirmed = confirmedReceipts.has(order.id);
            return (
              <div key={order.id} className="bg-white border-2 border-gray-300 rounded-2xl p-4 mb-3">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    {(() => {
                      const productImage = products.find(p => order.productName?.includes(p.name))?.imageUrl;
                      return productImage ? (
                        <ImageWithFallback src={productImage} alt={order.productName || ''} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                      ) : null;
                    })()}
                    <div>
                      <div className="text-base font-bold text-black mb-0.5">{order.productName}</div>
                      <div className="text-sm text-gray-600">
                        {order.quantity}{order.unit}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        注文日: {new Date(order.date).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div className={`${config.color} text-white text-xs px-2.5 py-1 rounded-xl font-bold`}>
                    {config.label}
                  </div>
                </div>

                {/* 進捗ステッパー */}
                <div className="mb-4">
                  <div className="flex items-center justify-between relative">
                    {/* 接続線 */}
                    <div className="absolute top-3 left-6 right-6 h-0.5 bg-gray-200" />
                    <div className="absolute top-3 left-6 h-0.5 bg-black transition-all" style={{
                      width: order.status === 'ordered' ? '0%' : order.status === 'approved' ? '30%' : order.status === 'delivered' ? '63%' : '88%'
                    }} />
                    {(['ordered', 'approved', 'delivered', 'paid'] as const).map((step) => {
                      const stepConfig = statusConfig[step];
                      const StepIcon = stepConfig.icon;
                      const stepIndex = ['ordered', 'approved', 'delivered', 'paid'].indexOf(step);
                      const currentIndex = ['ordered', 'approved', 'delivered', 'paid'].indexOf(order.status);
                      const isActive = stepIndex <= currentIndex;
                      return (
                        <div key={step} className="flex flex-col items-center z-10 bg-white px-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isActive ? 'bg-black' : 'bg-gray-200'}`}>
                            <StepIcon className={`w-3 h-3 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          <span className={`text-[10px] mt-1 ${isActive ? 'text-black font-bold' : 'text-gray-400'}`}>
                            {stepConfig.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t-2 border-gray-200 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">農園名</span>
                    <span className="text-black font-bold">{order.farmerName || '未指定'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">納品予定日</span>
                    <span className="text-black font-bold">
                      {new Date(order.deliveryDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">支払い状況</span>
                    <span className={`font-bold ${order.status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                      {order.status === 'paid' ? '支払済' : '未払い'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-base font-bold text-black">合計金額</span>
                    <span className="text-xl font-bold text-black">¥{order.total.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {/* B: 受取確認ボタン（delivered時のみ・C: 個別支払いスワイプ廃止） */}
                  {order.status === 'delivered' && (
                    <>
                      {isReceiptConfirmed ? (
                        <div className="p-4 bg-green-50 border-2 border-green-500 rounded-2xl text-center">
                          <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                          <p className="text-base font-bold text-green-700">受取確認済み</p>
                          <p className="text-xs text-green-600">農家さんに通知しました</p>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleConfirmReceipt(order)}
                          className="w-full h-14 text-lg bg-black text-white hover:bg-gray-800 rounded-xl font-bold active:scale-[0.98]"
                        >
                          <CheckCircle className="w-5 h-5 mr-2" />
                          受け取りました
                        </Button>
                      )}
                      {/* D: 問題報告ボタン */}
                      <Button
                        onClick={() => setReportTarget(order)}
                        variant="outline"
                        className="w-full h-12 text-base border-2 border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        問題を報告
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={() => setSelectedOrder(order)}
                    className="w-full h-12 text-base border-2 border-gray-300 rounded-xl hover:bg-gray-100 bg-white text-black"
                    variant="outline"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    書類を確認する
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 書類選択モーダル */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/30 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-8 shadow-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-3xl font-bold mb-2 text-black text-center">注文書類</h3>
            <p className="text-lg text-gray-600 text-center mb-8">
              {selectedOrder.productName}
            </p>
            
            <div className="space-y-4 mb-8">
              {generateOrderDocuments(selectedOrder).map((doc) => {
                const isRestaurantIssued = doc.type === 'purchase_order';
                const issuerLabel = isRestaurantIssued ? '飲食店発行' : '農家発行';
                const issuerStyle = isRestaurantIssued
                  ? 'bg-black text-white'
                  : 'bg-gray-200 text-gray-700';
                const docLabel = doc.type === 'purchase_order' ? '注文書' : doc.type === 'invoice' ? '請求書' : doc.type === 'delivery_note' ? '納品書' : '領収書';
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocument(doc)}
                    className="w-full bg-gray-50 border-2 border-gray-300 p-5 rounded-2xl hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${issuerStyle}`}>
                        {issuerLabel}
                      </span>
                      <p className="text-2xl font-bold text-black">¥{doc.total.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <FileText className="w-7 h-7 text-gray-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-black">{docLabel}</p>
                        <p className="text-[13px] text-gray-500">
                          {isRestaurantIssued
                            ? `${doc.farmerInfo.name} 宛`
                            : `${doc.farmerInfo.name} より`}
                          <span className="mx-1">·</span>
                          {new Date(doc.issueDate).toLocaleDateString('ja-JP')}
                        </p>
                        {doc.type === 'invoice' && (
                          <p className={`text-sm font-bold mt-0.5 ${doc.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                            {doc.paymentStatus === 'paid' ? '支払済' : '未払い'}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <Button
              onClick={() => setSelectedOrder(null)}
              className="w-full h-16 text-xl bg-black text-white hover:bg-gray-800 rounded-xl font-bold active:scale-[0.98]"
            >
              閉じる
            </Button>
          </div>
        </div>
      )}

      {/* 書類ビューアー */}
      {selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {/* D: 問題報告モーダル */}
      {reportTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={() => setReportTarget(null)}>
          <div className="bg-white w-full rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-5 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-gray-700" />
                  <h3 className="text-xl font-bold text-black">問題を報告</h3>
                </div>
                <button onClick={() => setReportTarget(null)} className="p-2 hover:bg-gray-100 rounded-xl active:scale-95">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* 対象注文情報 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-base font-bold text-black mb-1">{reportTarget.productName}</p>
                <p className="text-sm text-gray-600">
                  {reportTarget.farmerName} ・ {new Date(reportTarget.deliveryDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}お届け分
                </p>
              </div>

              {/* カテゴリ選択 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  問題のカテゴリ <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {issueCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setReportCategory(cat.id)}
                      className={`px-4 py-3 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 ${
                        reportCategory === cat.id
                          ? 'border-black bg-black text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 詳細入力 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  詳細（任意）
                </label>
                <textarea
                  value={reportDetail}
                  onChange={(e) => setReportDetail(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base resize-none focus:border-black"
                  rows={3}
                  placeholder="例: 注文した5kgに対して3kgしか届いていませんでした。"
                />
              </div>

              <p className="text-xs text-gray-500">
                農家さんのチャットに問題報告として送信されます。
              </p>

              {/* アクション */}
              <div className="flex gap-3 pb-4">
                <Button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  variant="outline"
                  className="flex-1 border-2 border-gray-300 rounded-xl h-14 text-base font-bold"
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitReport}
                  disabled={!reportCategory}
                  className="flex-1 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 rounded-xl h-14 text-base font-bold active:scale-[0.98]"
                >
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  報告を送信
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FileText, CheckCircle, TrendingUp, AlertCircle, Clock, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { SwipeButton } from '@/app/components/SwipeButton';
import { DocumentViewer, DocumentData } from '@/app/components/DocumentViewer';
import { useData, DeliverySchedule } from '@/app/context/DataContext';
import { toast } from 'sonner';

interface MonthlyInvoiceProps {
  userType: 'restaurant' | 'farmer';
}

interface PartnerInvoice {
  partnerId: string;
  partnerName: string;
  orders: DeliverySchedule[];
  deliveredOrders: DeliverySchedule[];
  paidOrders: DeliverySchedule[];
  totalAmount: number;
  unpaidAmount: number;
  paidAmount: number;
  allPaid: boolean;
}

const COMMISSION_RATE = 0.1; // 10%

// 支払期限（翌月末）を算出
function getPaymentDueDate(billingDate: Date): Date {
  return new Date(billingDate.getFullYear(), billingDate.getMonth() + 2, 0);
}

// 期限切れ判定
function isOverdue(billingDate: Date): boolean {
  const dueDate = getPaymentDueDate(billingDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today > dueDate;
}

// 期限が近い判定（残り7日以内）
function isDueSoon(billingDate: Date): boolean {
  const dueDate = getPaymentDueDate(billingDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
}

function formatDueDate(billingDate: Date): string {
  const dueDate = getPaymentDueDate(billingDate);
  return `${dueDate.getFullYear()}年${dueDate.getMonth() + 1}月${dueDate.getDate()}日`;
}

export function MonthlyInvoice({ userType }: MonthlyInvoiceProps) {
  const { deliverySchedules, updateDeliverySchedule, chats, addMessage } = useData();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<DocumentData | null>(null);

  // 一括支払い確認モーダル
  const [batchPaymentTarget, setBatchPaymentTarget] = useState<PartnerInvoice | null>(null);

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // 当月の配達済み・支払済み注文を取引先ごとに集計
  const partnerInvoices = useMemo((): PartnerInvoice[] => {
    const monthOrders = deliverySchedules.filter(order => {
      const orderDate = new Date(order.deliveryDate);
      return (
        orderDate.getMonth() === currentDate.getMonth() &&
        orderDate.getFullYear() === currentDate.getFullYear() &&
        (order.status === 'delivered' || order.status === 'paid')
      );
    });

    // 農家→飲食店ごと / 飲食店→農家ごとにグループ化
    const grouped: { [key: string]: DeliverySchedule[] } = {};
    monthOrders.forEach(order => {
      const groupKey = userType === 'farmer'
        ? (order.restaurantId || 'unknown')
        : (order.farmerId || 'unknown');
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(order);
    });

    return Object.entries(grouped).map(([partnerId, orders]) => {
      const deliveredOrders = orders.filter(o => o.status === 'delivered');
      const paidOrders = orders.filter(o => o.status === 'paid');
      const totalAmount = orders.reduce((sum, o) => sum + o.price, 0);
      const unpaidAmount = deliveredOrders.reduce((sum, o) => sum + o.price, 0);
      const paidAmount = paidOrders.reduce((sum, o) => sum + o.price, 0);

      const partnerName = userType === 'farmer'
        ? (orders[0]?.restaurantName || '飲食店')
        : (orders[0]?.farmerName || '農家');

      return {
        partnerId,
        partnerName,
        orders: [...orders].sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)),
        deliveredOrders,
        paidOrders,
        totalAmount,
        unpaidAmount,
        paidAmount,
        allPaid: deliveredOrders.length === 0 && paidOrders.length > 0,
      };
    }).sort((a, b) => {
      // 未回収を上に表示
      if (a.allPaid !== b.allPaid) return a.allPaid ? 1 : -1;
      return b.totalAmount - a.totalAmount;
    });
  }, [deliverySchedules, currentDate, userType]);

  // 月間サマリー
  const monthlySummary = useMemo(() => {
    const totalRevenue = partnerInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalUnpaid = partnerInvoices.reduce((sum, inv) => sum + inv.unpaidAmount, 0);
    const totalPaid = partnerInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const commission = Math.round(totalRevenue * COMMISSION_RATE);
    const orderCount = partnerInvoices.reduce((sum, inv) => sum + inv.orders.length, 0);
    const partnerCount = partnerInvoices.length;

    return { totalRevenue, totalUnpaid, totalPaid, commission, orderCount, partnerCount };
  }, [partnerInvoices]);

  // チャットIDを取引先IDから取得
  const getChatIdForPartner = (partnerId: string): string | undefined => {
    if (userType === 'farmer') {
      const chat = chats.find(c => c.restaurantId === partnerId);
      return chat?.id;
    } else {
      const chat = chats.find(c => c.farmerId === partnerId);
      return chat?.id;
    }
  };

  // 一括支払い/入金確認（確認モーダル経由）
  const handleBatchPaymentConfirm = (invoice: PartnerInvoice) => {
    // ステータス更新
    invoice.deliveredOrders.forEach(order => {
      updateDeliverySchedule(order.id, { status: 'paid' });
    });

    // チャットに通知を送信
    const chatId = getChatIdForPartner(invoice.partnerId);
    if (chatId) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const totalTax = Math.floor(invoice.unpaidAmount * 1.1);
      const orderDetails = invoice.deliveredOrders
        .map(o => `・${o.productName}（${new Date(o.deliveryDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}） ¥${o.price.toLocaleString()}`)
        .join('\n');

      if (userType === 'restaurant') {
        addMessage(chatId, {
          id: `batch-payment-${Date.now()}`,
          text: `【支払い完了】\n${year}年${month}月分のお支払いが完了しました。\n\n${orderDetails}\n\n合計（税込）: ¥${totalTax.toLocaleString()}\n\n今後ともよろしくお願いいたします。`,
          sender: 'restaurant',
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        });
      } else {
        addMessage(chatId, {
          id: `batch-received-${Date.now()}`,
          text: `【支払い完了】\n${year}年${month}月分の入金を確認しました。\n\n${orderDetails}\n\n合計（税込）: ¥${totalTax.toLocaleString()}\n\nありがとうございます。`,
          sender: 'farmer',
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }

    const label = userType === 'farmer' ? '入金' : '支払い';
    toast.success(`${invoice.partnerName}の${label}を確認しました`, {
      description: `${invoice.deliveredOrders.length}件の注文を${label}済みに更新`,
      style: { background: '#000', color: '#fff' },
    });

    setBatchPaymentTarget(null);
  };

  // 個別入金確認
  const handleSinglePaymentConfirm = (orderId: string) => {
    updateDeliverySchedule(orderId, { status: 'paid' });
    const label = userType === 'farmer' ? '入金' : '支払い';
    toast.success(`${label}を確認しました`, {
      style: { background: '#000', color: '#fff' },
    });
  };

  // 請求書ドキュメント生成
  const generateInvoiceDocument = (invoice: PartnerInvoice): DocumentData => {
    const subtotal = invoice.totalAmount;
    const tax = Math.floor(subtotal * 0.1);
    const total = subtotal + tax;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthStr = `${year}年${month}月`;
    const dueDate = getPaymentDueDate(currentDate);

    const items = invoice.orders.map(order => ({
      name: `${order.productName}（${new Date(order.deliveryDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}配達分）`,
      quantity: order.quantity,
      unit: order.unit,
      unitPrice: order.quantity > 0 ? Math.round(order.price / order.quantity) : order.price,
      amount: order.price,
    }));

    const farmerName = userType === 'farmer'
      ? '農園名' // TODO: ログイン中の農家情報
      : invoice.partnerName;
    const restaurantName = userType === 'farmer'
      ? invoice.partnerName
      : '飲食店名'; // TODO: ログイン中の飲食店情報

    return {
      id: `INV-${year}${String(month).padStart(2, '0')}-${invoice.partnerId.slice(0, 8)}`,
      type: 'invoice',
      orderNumber: `${monthStr}分`,
      issueDate: new Date().toISOString(),
      items,
      subtotal,
      tax,
      total,
      deliveryDate: new Date(year, month, 0).toISOString(),
      farmerInfo: {
        name: farmerName,
        address: '',
        phone: '',
      },
      restaurantInfo: {
        name: restaurantName,
        address: '',
        phone: '',
      },
      notes: `${monthStr}分（月末締め）のお取引明細です。\n合計${invoice.orders.length}件のお届けが含まれています。\n\nお支払い条件：月末締め・翌月末払い`,
      paymentDueDate: dueDate.toISOString(),
      paymentStatus: invoice.allPaid ? 'paid' : 'unpaid',
    };
  };

  const handleViewInvoice = (invoice: PartnerInvoice) => {
    const document = generateInvoiceDocument(invoice);
    setViewingDocument(document);
  };

  const toggleExpand = (partnerId: string) => {
    setExpandedPartner(prev => prev === partnerId ? null : partnerId);
  };

  // ラベル定義
  const labels = userType === 'farmer'
    ? {
        summaryTitle: '売上合計（税抜）',
        netLabel: '受取予定額',
        collectionLabel: '回収状況',
        collectedLabel: '回収済',
        uncollectedLabel: '未回収',
        confirmLabel: '入金確認',
        batchConfirmLabel: (n: number) => `${n}件の入金をまとめて確認`,
        batchDoneLabel: '入金確認完了',
        doneLabel: '回収済',
        badgeUncollected: (n: number) => `未回収 ${n}件`,
        badgeCollected: '回収済',
        overdueText: '支払期限を過ぎています',
        dueSoonText: 'まもなく支払期限です',
      }
    : {
        summaryTitle: 'お支払い合計（税抜）',
        netLabel: 'お支払い予定額',
        collectionLabel: '支払い状況',
        collectedLabel: '支払済',
        uncollectedLabel: '未払い',
        confirmLabel: '支払確認',
        batchConfirmLabel: (n: number) => `${n}件の支払いをまとめて確認`,
        batchDoneLabel: '支払確認完了',
        doneLabel: '支払済',
        badgeUncollected: (n: number) => `未払い ${n}件`,
        badgeCollected: '支払済',
        overdueText: '支払期限を過ぎています',
        dueSoonText: 'まもなく支払期限です',
      };

  const overdue = isOverdue(currentDate);
  const dueSoon = isDueSoon(currentDate);
  const hasUnpaid = monthlySummary.totalUnpaid > 0;

  return (
    <div className="p-4 pb-8">
      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={previousMonth} className="p-3 hover:bg-gray-100 rounded-xl transition-colors">
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-black">
            {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">月末締め</p>
        </div>
        <button onClick={nextMonth} className="p-3 hover:bg-gray-100 rounded-xl transition-colors">
          <ChevronRight className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* 期限アラート（未払いがあり、期限切れ or 期限間近の場合） */}
      {hasUnpaid && (overdue || dueSoon) && (
        <div className={`flex items-center gap-3 p-4 rounded-xl mb-4 ${
          overdue ? 'bg-red-50 border-2 border-red-200' : 'bg-amber-50 border-2 border-amber-200'
        }`}>
          {overdue ? (
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          ) : (
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${overdue ? 'text-red-700' : 'text-amber-700'}`}>
              {overdue ? labels.overdueText : labels.dueSoonText}
            </p>
            <p className={`text-xs ${overdue ? 'text-red-500' : 'text-amber-500'}`}>
              支払期限: {formatDueDate(currentDate)} ·
              {labels.uncollectedLabel} ¥{monthlySummary.totalUnpaid.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* 月間サマリーカード */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            <h3 className="text-sm font-bold text-gray-600">月間サマリー</h3>
          </div>
          {monthlySummary.partnerCount > 0 && (
            <span className="text-xs text-gray-400">
              {monthlySummary.partnerCount}件の取引先
            </span>
          )}
        </div>

        {/* メイン数字 */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">{labels.summaryTitle}</p>
          <p className="text-3xl font-bold text-black">
            ¥{monthlySummary.totalRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {monthlySummary.orderCount}件のお届け
          </p>
        </div>

        {/* 内訳（農家のみ手数料表示） */}
        {userType === 'farmer' && monthlySummary.totalRevenue > 0 && (
          <div className="space-y-2 pt-3 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">手数料（10%）</span>
              <span className="text-gray-700">-¥{monthlySummary.commission.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-gray-700">{labels.netLabel}</span>
              <span className="text-black">
                ¥{(monthlySummary.totalRevenue - monthlySummary.commission).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* 回収 / 支払い状況バー */}
        {monthlySummary.totalRevenue > 0 && (
          <div className={`mt-4 pt-3 border-t border-gray-100`}>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-500">{labels.collectionLabel}</span>
              <span className="text-gray-700 font-bold">
                {monthlySummary.totalPaid > 0
                  ? `${Math.round((monthlySummary.totalPaid / monthlySummary.totalRevenue) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full transition-all duration-500"
                style={{
                  width: `${monthlySummary.totalRevenue > 0
                    ? (monthlySummary.totalPaid / monthlySummary.totalRevenue) * 100
                    : 0}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs mt-2">
              <span className="text-green-600 font-bold">
                {labels.collectedLabel} ¥{monthlySummary.totalPaid.toLocaleString()}
              </span>
              {monthlySummary.totalUnpaid > 0 && (
                <span className="text-orange-600 font-bold">
                  {labels.uncollectedLabel} ¥{monthlySummary.totalUnpaid.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 支払期限 */}
        {monthlySummary.totalRevenue > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-500">支払期限</span>
            <span className={`text-xs font-bold ${
              overdue && hasUnpaid ? 'text-red-600' : 'text-gray-700'
            }`}>
              {formatDueDate(currentDate)}
            </span>
          </div>
        )}
      </div>

      {/* 取引先ごとの請求一覧 */}
      {partnerInvoices.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-base text-gray-500 font-bold mb-1">この月の取引はありません</p>
          <p className="text-sm text-gray-400">
            配達が完了すると、ここに請求情報が表示されます
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {partnerInvoices.map(invoice => {
            const isExpanded = expandedPartner === invoice.partnerId;

            return (
              <div
                key={invoice.partnerId}
                className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden"
              >
                {/* 取引先ヘッダー（タップで展開） */}
                <button
                  onClick={() => toggleExpand(invoice.partnerId)}
                  className="w-full p-4 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
                >
                  {/* ステータスアイコン */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    invoice.allPaid
                      ? 'bg-green-100'
                      : overdue
                        ? 'bg-red-100'
                        : 'bg-orange-100'
                  }`}>
                    {invoice.allPaid ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : overdue ? (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                    )}
                  </div>

                  {/* 取引先情報 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-base font-bold text-black truncate">
                        {invoice.partnerName}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                        invoice.allPaid
                          ? 'bg-green-100 text-green-700'
                          : overdue
                            ? 'bg-red-100 text-red-700'
                            : 'bg-orange-100 text-orange-700'
                      }`}>
                        {invoice.allPaid
                          ? labels.badgeCollected
                          : labels.badgeUncollected(invoice.deliveredOrders.length)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {invoice.orders.length}件 · ¥{invoice.totalAmount.toLocaleString()}
                    </p>
                  </div>

                  {/* 未回収金額 */}
                  <div className="text-right flex-shrink-0 mr-1">
                    {invoice.unpaidAmount > 0 && (
                      <p className={`text-lg font-bold ${overdue ? 'text-red-600' : 'text-orange-600'}`}>
                        ¥{invoice.unpaidAmount.toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* 展開アイコン */}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {/* 展開コンテンツ */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* 注文一覧 */}
                    <div className="px-4 py-3">
                      <p className="text-xs font-bold text-gray-500 mb-2 px-1">取引明細</p>
                      <div className="space-y-1.5">
                        {invoice.orders.map(order => (
                          <div
                            key={order.id}
                            className={`flex items-center gap-3 p-3 rounded-xl text-sm ${
                              order.status === 'paid' ? 'bg-gray-50' : 'bg-orange-50'
                            }`}
                          >
                            {/* 日付 */}
                            <div className="w-14 text-center flex-shrink-0">
                              <p className="text-xs text-gray-500">
                                {new Date(order.deliveryDate).toLocaleDateString('ja-JP', { month: 'short' })}
                              </p>
                              <p className="text-lg font-bold text-black leading-tight">
                                {new Date(order.deliveryDate).getDate()}
                              </p>
                            </div>

                            {/* 商品情報 */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-black truncate">{order.productName}</p>
                              <p className="text-xs text-gray-500">
                                {order.quantity}{order.unit}
                                {!order.subscriptionId && (
                                  <span className="ml-1 text-gray-400">· 単発</span>
                                )}
                              </p>
                            </div>

                            {/* 金額・ステータス */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold text-black">
                                ¥{order.price.toLocaleString()}
                              </p>
                              {order.status === 'paid' ? (
                                <p className="text-xs text-green-600 font-bold">{labels.doneLabel}</p>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSinglePaymentConfirm(order.id);
                                  }}
                                  className="text-xs text-orange-600 font-bold underline"
                                >
                                  {labels.confirmLabel}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 合計・アクション */}
                    <div className="px-4 pb-4 space-y-3">
                      {/* 合計欄 */}
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500">小計</span>
                          <span className="font-bold text-black">¥{invoice.totalAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500">消費税（10%）</span>
                          <span className="font-bold text-black">¥{Math.floor(invoice.totalAmount * 0.1).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                          <span className="font-bold text-black">請求額（税込）</span>
                          <span className="text-lg font-bold text-black">
                            ¥{Math.floor(invoice.totalAmount * 1.1).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs pt-2 mt-1 border-t border-gray-200">
                          <span className="text-gray-400">支払期限</span>
                          <span className={`font-bold ${
                            overdue && invoice.unpaidAmount > 0 ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            {formatDueDate(currentDate)}
                          </span>
                        </div>
                      </div>

                      {/* 一括入金 / 支払い確認 */}
                      {invoice.deliveredOrders.length > 0 && (
                        <Button
                          onClick={() => setBatchPaymentTarget(invoice)}
                          className="w-full h-14 text-base bg-black text-white hover:bg-gray-800 rounded-xl font-bold active:scale-[0.98]"
                        >
                          <CheckCircle className="w-5 h-5 mr-2" />
                          {labels.batchConfirmLabel(invoice.deliveredOrders.length)}
                        </Button>
                      )}

                      {/* 請求書PDF */}
                      <Button
                        onClick={() => handleViewInvoice(invoice)}
                        variant="outline"
                        className="w-full h-12 text-base border-2 border-gray-300 rounded-xl font-bold active:scale-[0.98]"
                      >
                        <FileText className="w-5 h-5 mr-2" />
                        請求書を表示・ダウンロード
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 書類ビューアー */}
      {viewingDocument && (
        <DocumentViewer document={viewingDocument} onClose={() => setViewingDocument(null)} />
      )}

      {/* 一括支払い/入金確認モーダル */}
      {batchPaymentTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setBatchPaymentTarget(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-black">
                  {userType === 'farmer' ? '入金確認' : '支払い確認'}
                </h3>
                <button
                  onClick={() => setBatchPaymentTarget(null)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* 対象取引先 */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-base font-bold text-black mb-1">{batchPaymentTarget.partnerName}</p>
                <p className="text-sm text-gray-600">
                  {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月分 · {batchPaymentTarget.deliveredOrders.length}件
                </p>
              </div>

              {/* 対象注文一覧 */}
              <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
                {batchPaymentTarget.deliveredOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between px-3 py-2 bg-orange-50 rounded-lg text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-black truncate">{order.productName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.deliveryDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })} · {order.quantity}{order.unit}
                      </p>
                    </div>
                    <span className="font-bold text-black ml-3">¥{order.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* 合計 */}
              <div className="bg-black text-white rounded-xl p-4 mb-5">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">小計</span>
                  <span>¥{batchPaymentTarget.unpaidAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-300">消費税（10%）</span>
                  <span>¥{Math.floor(batchPaymentTarget.unpaidAmount * 0.1).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-600">
                  <span className="font-bold text-lg">合計（税込）</span>
                  <span className="font-bold text-2xl">
                    ¥{Math.floor(batchPaymentTarget.unpaidAmount * 1.1).toLocaleString()}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                {userType === 'restaurant'
                  ? '農家さんのチャットに支払い完了の通知が送信されます。'
                  : '飲食店のチャットに入金確認の通知が送信されます。'}
              </p>

              {/* アクション */}
              <SwipeButton
                onComplete={() => handleBatchPaymentConfirm(batchPaymentTarget)}
                text={labels.batchConfirmLabel(batchPaymentTarget.deliveredOrders.length)}
                completedText={labels.batchDoneLabel}
              />

              <Button
                onClick={() => setBatchPaymentTarget(null)}
                variant="ghost"
                className="w-full mt-3 h-12 text-base text-gray-500 rounded-xl font-bold"
              >
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

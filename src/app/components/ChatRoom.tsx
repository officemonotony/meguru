import { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Image as ImageIcon, Calendar, MessageSquare, CheckCircle, XCircle, Clock, Package, Repeat, AlertTriangle, Minus, Plus, Truck, Ban, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { DatePicker } from '@/app/components/DatePicker';
import { useData } from '@/app/context/DataContext';
import { useAuth } from '@/app/context/AuthContext';
import type { DeliverySchedule } from '@/app/context/DataContext';
import type { ProposalData, CounterProposalData, SubscriptionCounterData } from '@/app/types';
import type { ChatMessage as Message } from '@/app/context/DataContext';
import { toast } from 'sonner';
import { toHalfWidth } from '@/app/utils/normalizeNumber';

// 後方互換性のため再エクスポート
export type { ProposalData, Message };

export interface ChatRoomProps {
  chatId: string;
  chatName: string;
  avatarUrl?: string;
  onBack: () => void;
  userType?: 'restaurant' | 'farmer';
}

// 定型文リスト
const templateMessages = [
  'ありがとうございます！よろしくお願いいたします。',
  '在庫状況を教えていただけますか？',
  '納品時間の変更は可能でしょうか？',
  'お世話になっております。',
  'ご確認よろしくお願いいたします。',
  '承知いたしました。',
  '追加でご相談したいことがあります。',
  'またよろしくお願いいたします。',
];

// 変更理由の定型文
const counterProposalReasons = [
  '在庫不足のため',
  '配送日の調整のため',
  '季節により品質が変わるため',
  '価格変更のため',
];

// =====================================
// 配送依頼メッセージのパーサー
// =====================================
function parseDeliveryRequest(text: string) {
  const lines = text.split('\n');
  const items: { productName: string; quantity: number; unit: string; unitPrice: number }[] = [];
  let deliveryDate = '';
  let totalAmount = 0;

  lines.forEach(line => {
    if (line.startsWith('・') || line.startsWith('・')) {
      const match = line.match(/[・・](.+?)\s+(\d+)(\S+)/);
      if (match) {
        items.push({
          productName: match[1],
          quantity: parseInt(match[2]),
          unit: match[3],
          unitPrice: 0, // 後で計算
        });
      }
    } else if (line.includes('配送希望日:')) {
      deliveryDate = line.split('配送希望日:')[1]?.trim() || '';
    } else if (line.includes('合計金額:')) {
      const amountMatch = line.match(/¥([\d,]+)/);
      if (amountMatch) totalAmount = parseInt(amountMatch[1].replace(/,/g, ''));
    }
  });

  // 単価を推定（商品が1つの場合は合計/数量、複数の場合は均等割）
  if (items.length === 1 && items[0].quantity > 0) {
    items[0].unitPrice = Math.round(totalAmount / items[0].quantity);
  } else if (items.length > 1) {
    const perItem = Math.round(totalAmount / items.reduce((s, i) => s + i.quantity, 0));
    items.forEach(item => { item.unitPrice = perItem; });
  }

  // 日本語日付をISO形式に変換
  let isoDate = deliveryDate;
  const dateMatch = deliveryDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (dateMatch) {
    isoDate = `${dateMatch[1]}-${String(parseInt(dateMatch[2])).padStart(2, '0')}-${String(parseInt(dateMatch[3])).padStart(2, '0')}`;
  }

  return { items, deliveryDate: isoDate, totalAmount };
}

// =====================================
// メッセージ状態の判定ヘルパー
// =====================================
type DeliveryRequestStatus = 'pending' | 'approved' | 'counterProposed' | 'declined';

function getDeliveryRequestStatus(
  messageId: string,
  messages: Message[],
  messageIndex: number,
  deliverySchedules: DeliverySchedule[]
): DeliveryRequestStatus {
  // DeliveryScheduleに登録済みの場合、実際のステータスを確認
  const schedule = deliverySchedules.find(d => d.id === `onetime-${messageId}`);
  if (schedule) {
    // ordered（注文済み・未承認）はまだ承認待ち
    if (schedule.status === 'ordered') return 'pending';
    // approved以降は承認済み
    return 'approved';
  }

  const after = messages.slice(messageIndex + 1);
  // 承認メッセージがある → approved
  if (after.some(m => m.text?.includes('【注文承認】'))) return 'approved';
  // 変更提案メッセージがある
  if (after.some(m => m.type === 'counterProposal' && m.counterProposalData?.originalMessageId === messageId)) return 'counterProposed';
  // お断りメッセージがある
  if (after.some(m => m.text?.includes('【お断り】'))) return 'declined';

  return 'pending';
}

function getCounterProposalStatus(
  messageIndex: number,
  messages: Message[],
  deliverySchedules: DeliverySchedule[],
  counterData: CounterProposalData
): 'pending' | 'accepted' {
  // 元の配送依頼のDeliveryScheduleがあれば、実際のステータスを確認
  const schedule = deliverySchedules.find(d => d.id === `onetime-${counterData.originalMessageId}`);
  if (schedule && schedule.status !== 'ordered') return 'accepted';
  // 後続に承認メッセージがあれば承認済み
  const after = messages.slice(messageIndex + 1);
  if (after.some(m => m.text?.includes('【注文承認】'))) return 'accepted';
  return 'pending';
}


// =====================================
// メインコンポーネント
// =====================================
export function ChatRoom({ chatId, chatName, avatarUrl, onBack, userType = 'restaurant' }: ChatRoomProps) {
  const { user, profile } = useAuth();
  const { proposals, updateProposal, addActiveSubscription, messages: contextMessages, addMessage, fetchMessages, deliverySchedules, addDeliverySchedule, updateDeliverySchedule, products, chats } = useData();
  const currentChat = chats.find(c => c.id === chatId);
  const [inputText, setInputText] = useState('');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [orderQuantity, setOrderQuantity] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 変更提案モーダル
  const [counterProposalTarget, setCounterProposalTarget] = useState<{
    messageId: string;
    items: { productName: string; originalQuantity: number; proposedQuantity: number; unit: string; unitPrice: number }[];
    originalDate: string;
    proposedDate: string;
    originalAmount: number;
    reason: string;
  } | null>(null);

  // お断りモーダル（単発・継続共通）
  const [declineTarget, setDeclineTarget] = useState<{ messageId: string; productName: string; isProposal?: boolean } | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  // 継続提案の変更提案モーダル
  const [subCounterTarget, setSubCounterTarget] = useState<{
    proposalId: string;
    productName: string;
    quantity: { original: number; proposed: number };
    unit: string;
    pricePerDelivery: { original: number; proposed: number };
    frequency: { original: string; proposed: string };
    deliveryDay: { original: string; proposed: string };
    startDate: { original: string; proposed: string };
    endDate: { original: string; proposed: string };
    totalDeliveries: number;
    reason: string;
  } | null>(null);

  const messages = contextMessages[chatId] || [];

  // チャット開いた時にSupabaseからメッセージを取得
  useEffect(() => {
    fetchMessages(chatId);
  }, [chatId]);

  // 提案のステータスをDataContext.proposalsから取得するヘルパー
  const getProposalStatus = (proposalId: string): 'pending' | 'accepted' | 'rejected' | 'active' => {
    const proposal = proposals.find(p => p.id === proposalId);
    return proposal?.status || 'pending';
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  // =====================================
  // ハンドラー群
  // =====================================
  const handleSend = () => {
    if (!inputText.trim()) return;
    addMessage(chatId, {
      id: Date.now().toString(),
      text: inputText,
      sender: userType,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    });
    setInputText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleProductSelect = (product: any) => {
    setSelectedProduct(product);
    setOrderDate(new Date().toISOString().split('T')[0]);
  };

  const handleOrderConfirm = () => {
    if (!selectedProduct || !orderQuantity || !orderDate) return;
    const totalAmount = selectedProduct.price * parseInt(orderQuantity);
    const dateFmt = new Date(orderDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    const messageId = `delivery-request-${Date.now()}`;
    addMessage(chatId, {
      id: messageId,
      text: `【配送依頼】\n\n・${selectedProduct.name} ${orderQuantity}${selectedProduct.unit}\n\n配送希望日: ${dateFmt}\n合計金額: ¥${totalAmount.toLocaleString()}\n\nよろしくお願いいたします。`,
      sender: userType,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    });

    // DeliveryScheduleを即座に作成（ステータスバッジの正確な判定のため）
    addDeliverySchedule({
      id: `onetime-${messageId}`,
      subscriptionId: '',
      restaurantName: profile?.shop_name || '',
      restaurantId: user?.id || currentChat?.restaurantId || '',
      productName: selectedProduct.name,
      quantity: parseInt(orderQuantity),
      unit: selectedProduct.unit,
      price: totalAmount,
      deliveryDate: orderDate,
      status: 'ordered' as const,
      orderDate: new Date().toISOString().split('T')[0],
      farmerName: currentChat?.name || chatName,
      farmerId: currentChat?.farmerId || '',
      items: [],
      totalAmount: 0,
      createdAt: new Date().toISOString(),
    });

    setSelectedProduct(null);
    setOrderQuantity('');
    setOrderDate('');
    setShowOrderModal(false);
  };

  const handleTemplateSelect = (template: string) => {
    setInputText(template);
    setShowTemplateModal(false);
  };

  const handleProposalAccept = (proposalId: string) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;
    updateProposal(proposalId, 'accepted');
    addActiveSubscription(proposalId);
    setCelebrationData(proposal);
    setShowCelebration(true);
    // 承認メッセージを送信
    addMessage(chatId, {
      id: `sub-approval-${Date.now()}`,
      text: `【注文承認】\n${proposal.productName}の継続契約を承認しました。`,
      sender: 'farmer',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const handleProposalReject = (proposalId: string, reason?: string) => {
    updateProposal(proposalId, 'rejected');
    const proposal = proposals.find(p => p.id === proposalId);
    const productName = proposal?.productName || '提案';
    const reasonText = reason || '申し訳ございませんが、今回はお受けすることが難しい状況です。';
    addMessage(chatId, {
      id: `sub-decline-${Date.now()}`,
      text: `【お断り】\n${productName}の継続提案について\n\n${reasonText}\n\n別の条件でご相談いただければ幸いです。`,
      sender: 'farmer',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    });
    toast('継続提案をお断りしました', { style: { background: '#000', color: '#fff' } });
  };

  // --- 継続提案の変更提案モーダルを開く ---
  const openSubCounter = (message: Message) => {
    if (!message.proposalData) return;
    const d = message.proposalData;
    setSubCounterTarget({
      proposalId: message.id,
      productName: d.productName,
      quantity: { original: d.quantity, proposed: d.quantity },
      unit: d.unit,
      pricePerDelivery: { original: d.pricePerDelivery, proposed: d.pricePerDelivery },
      frequency: { original: d.frequency, proposed: d.frequency },
      deliveryDay: { original: d.deliveryDay, proposed: d.deliveryDay },
      startDate: { original: d.startDate || '', proposed: d.startDate || '' },
      endDate: { original: d.endDate || '', proposed: d.endDate || '' },
      totalDeliveries: d.totalDeliveries,
      reason: '',
    });
  };

  // --- 継続提案の変更提案を送信 ---
  const handleSubmitSubCounter = () => {
    if (!subCounterTarget || !subCounterTarget.reason.trim()) return;
    const s = subCounterTarget;
    const proposedTotal = s.pricePerDelivery.proposed * s.totalDeliveries;
    const originalTotal = s.pricePerDelivery.original * s.totalDeliveries;

    const data: SubscriptionCounterData = {
      originalProposalId: s.proposalId,
      productName: s.productName,
      quantity: s.quantity,
      unit: s.unit,
      pricePerDelivery: s.pricePerDelivery,
      frequency: typeof s.frequency === 'object' ? s.frequency.proposed : s.frequency,
      deliveryDay: typeof s.deliveryDay === 'object' ? s.deliveryDay.proposed : s.deliveryDay,
      startDate: typeof s.startDate === 'object' ? s.startDate.proposed : s.startDate,
      endDate: typeof s.endDate === 'object' ? s.endDate.proposed : s.endDate,
      totalDeliveries: s.totalDeliveries,
      totalAmount: { original: originalTotal, proposed: proposedTotal },
      reason: s.reason,
    };

    addMessage(chatId, {
      id: `sub-counter-${Date.now()}`,
      text: '',
      sender: 'farmer',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      type: 'subscriptionCounter',
      subscriptionCounterData: data,
    });

    // 元の提案をrejectedに（変更提案中として扱う）
    // Note: 実際にはrejectではなくcounterProposed状態だが、proposalのstatusフィールドにはないのでそのまま
    toast.success('変更の提案を送信しました', { style: { background: '#000', color: '#fff' } });
    setSubCounterTarget(null);
  };

  // --- 飲食店が継続提案の変更提案を承認 ---
  const handleAcceptSubCounter = (counterData: SubscriptionCounterData) => {
    const proposal = proposals.find(p => p.id === counterData.originalProposalId);
    if (proposal) {
      // 提案を変更後の内容で更新して承認
      updateProposal(counterData.originalProposalId, "accepted");
      addActiveSubscription(counterData.originalProposalId);
      setCelebrationData({
        ...proposal,
        quantity: counterData.quantity.proposed,
        pricePerDelivery: counterData.pricePerDelivery.proposed,
      });
      setShowCelebration(true);
    }
    addMessage(chatId, {
      id: `sub-counter-accept-${Date.now()}`,
      text: `【注文承認】\n変更内容で${counterData.productName}の継続契約を確定しました。`,
      sender: 'restaurant',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    });
    toast.success('変更内容で契約を確定しました', { style: { background: '#000', color: '#fff' } });
  };

  // --- お断りモーダルを開く（継続提案用） ---
  const openProposalDecline = (message: Message) => {
    const productName = message.proposalData?.productName || '提案';
    setDeclineTarget({ messageId: message.id, productName, isProposal: true });
    setDeclineReason('');
  };

  // --- 配送依頼の承認（そのまま） ---
  const handleDeliveryApprove = (message: Message) => {
    if (!message.text) return;
    const parsed = parseDeliveryRequest(message.text);
    if (parsed.items.length === 0 || !parsed.deliveryDate) return;

    const productName = parsed.items.map(i => i.productName).join('、');
    const currentChat = chats.find(c => c.id === chatId);
    const scheduleId = `onetime-${message.id}`;

    // 既存のスケジュールがあればステータスを更新、なければ新規作成
    const existingSchedule = deliverySchedules.find(d => d.id === scheduleId);
    if (existingSchedule) {
      updateDeliverySchedule(scheduleId, { status: 'approved' as const });
    } else {
      addDeliverySchedule({
        id: scheduleId,
        subscriptionId: '',
        restaurantName: chatName,
        restaurantId: currentChat?.restaurantId || '',
        productName,
        quantity: parsed.items.reduce((s, i) => s + i.quantity, 0),
        unit: parsed.items.map(i => `${i.quantity}${i.unit}`).join(' / '),
        price: parsed.totalAmount,
        deliveryDate: parsed.deliveryDate,
        status: 'approved' as const,
        orderDate: new Date().toISOString().split('T')[0],
        farmerName: currentChat?.name || chatName,
        farmerId: currentChat?.farmerId || '',
      items: [],
      totalAmount: parsed.totalAmount,
      createdAt: new Date().toISOString(),
    });
    }

    const dateFmt = new Date(parsed.deliveryDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    addMessage(chatId, {
      id: `approval-${Date.now()}`,
      text: `【注文承認】\n${productName}の配送依頼を承���しました。\n配送予定日: ${dateFmt}\n合計金額: ¥${parsed.totalAmount.toLocaleString()}\n\nお届けまでお待ちください。`,
      sender: 'farmer',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    });
    toast.success('配送依頼を承認しました', { description: `${productName} - ${dateFmt}`, style: { background: '#000', color: '#fff' } });
  };

  // --- 変更提案モーダルを開く ---
  const openCounterProposal = (message: Message) => {
    if (!message.text) return;
    const parsed = parseDeliveryRequest(message.text);
    if (parsed.items.length === 0) return;

    setCounterProposalTarget({
      messageId: message.id,
      items: parsed.items.map(i => ({
        productName: i.productName,
        originalQuantity: i.quantity,
        proposedQuantity: i.quantity,
        unit: i.unit,
        unitPrice: i.unitPrice,
      })),
      originalDate: parsed.deliveryDate,
      proposedDate: parsed.deliveryDate,
      originalAmount: parsed.totalAmount,
      reason: '',
    });
  };

  // --- 変更提案を送信 ---
  const handleSubmitCounterProposal = () => {
    if (!counterProposalTarget || !counterProposalTarget.reason.trim()) return;
    const cp = counterProposalTarget;
    const proposedAmount = cp.items.reduce((s, i) => s + i.proposedQuantity * i.unitPrice, 0);

    const data: CounterProposalData = {
      originalMessageId: cp.messageId,
      items: cp.items,
      originalDate: cp.originalDate,
      proposedDate: cp.proposedDate,
      originalAmount: cp.originalAmount,
      proposedAmount,
      reason: cp.reason,
    };

    // カード型メッセージとしてチャットに追加
    addMessage(chatId, {
      id: `counter-${Date.now()}`,
      text: '', // テキストはカードで表示
      sender: 'farmer',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      type: 'counterProposal',
      counterProposalData: data,
    });

    toast.success('変更の提案を送信しました', { style: { background: '#000', color: '#fff' } });
    setCounterProposalTarget(null);
  };

  // --- 飲食店が変更提案を承認 ---
  const handleAcceptCounterProposal = (counterData: CounterProposalData) => {
    const productName = counterData.items.map(i => i.productName).join('、');
    const scheduleId = `onetime-${counterData.originalMessageId}`;

    // 既存のスケジュールがあればステータス・内容を更新、なければ新規作成
    const existingSchedule = deliverySchedules.find(d => d.id === scheduleId);
    if (existingSchedule) {
      updateDeliverySchedule(scheduleId, {
        status: 'approved' as const,
        productName,
        quantity: counterData.items.reduce((s, i) => s + i.proposedQuantity, 0),
        unit: counterData.items.map(i => `${i.proposedQuantity}${i.unit}`).join(' / '),
        price: counterData.proposedAmount,
        deliveryDate: counterData.proposedDate,
      });
    } else {
      addDeliverySchedule({
        id: scheduleId,
        subscriptionId: '',
        restaurantName: currentChat?.name || chatName,
        restaurantId: currentChat?.restaurantId || '',
        productName,
        quantity: counterData.items.reduce((s, i) => s + i.proposedQuantity, 0),
        unit: counterData.items.map(i => `${i.proposedQuantity}${i.unit}`).join(' / '),
        price: counterData.proposedAmount,
        deliveryDate: counterData.proposedDate,
        status: 'approved' as const,
        orderDate: new Date().toISOString().split('T')[0],
      farmerName: '',
      farmerId: '',
      items: [],
      totalAmount: counterData.proposedAmount,
      createdAt: new Date().toISOString(),
    });
    }

    const dateFmt = new Date(counterData.proposedDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    addMessage(chatId, {
      id: `approval-${Date.now()}`,
      text: `【注文承認】\n変更内容で注文を確定しました。\n${productName}\n配送予定日: ${dateFmt}\n合計金額: ¥${counterData.proposedAmount.toLocaleString()}`,
      sender: 'restaurant',
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    });
    toast.success('変更内容で注文を確定しました', { style: { background: '#000', color: '#fff' } });
  };

  // --- お断りモーダルを開く ---
  const openDecline = (message: Message) => {
    if (!message.text) return;
    const parsed = parseDeliveryRequest(message.text);
    const productName = parsed.items.map(i => i.productName).join('、') || '注文';
    setDeclineTarget({ messageId: message.id, productName });
    setDeclineReason('');
  };

  // --- お断りを送信 ---
  const handleSubmitDecline = () => {
    if (!declineTarget) return;
    const reason = declineReason.trim() || '申し訳ございませんが、今回はお受けすることが難しい状況です。';
    
    if (declineTarget.isProposal) {
      // 継続提案のお断り
      handleProposalReject(declineTarget.messageId, reason);
    } else {
      // 単発注文のお断り
      addMessage(chatId, {
        id: `decline-${Date.now()}`,
        text: `【お断り】\n${declineTarget.productName}の配送依頼について\n\n${reason}\n\n別の商品や日程でご相談いただければ幸いです。`,
        sender: 'farmer',
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      });
      toast('配送依頼をお断りしました', { style: { background: '#000', color: '#fff' } });
    }
    setDeclineTarget(null);
    setDeclineReason('');
  };

  // =====================================
  // レンダリング
  // =====================================
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-white border-b-2 border-gray-300 px-4 pt-6 pb-4 flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-colors active:scale-95">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <ImageWithFallback src={avatarUrl || ''} alt={chatName} className="w-12 h-12 rounded-full object-cover" />
        <h1 className="text-xl font-bold text-black">{chatName}</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pt-24">
        {messages.map((message, index) => {
          const isMyMessage = message.sender === userType;
          const isDeliveryRequest = message.text?.includes('【配送依頼】');
          const isCounterProposal = message.type === 'counterProposal' && message.counterProposalData;
          const isSubCounter = message.type === 'subscriptionCounter' && message.subscriptionCounterData;
          const isDecline = message.text?.includes('【お断り】');
          const isApproval = message.text?.includes('【注文承認】');
          const isDeliveryComplete = message.text?.includes('【配達完了】');
          const isReceiptConfirm = message.text?.includes('【受取確認】');
          const isIssueReport = message.text?.includes('【問題報告】');
          const isCancelApproval = message.text?.includes('【承認取消】');
          const isBatchPayment = message.text?.includes('【支払い完了】');

          // 配送依頼のステータス判定
          const deliveryStatus = isDeliveryRequest
            ? getDeliveryRequestStatus(message.id, messages, index, deliverySchedules)
            : null;

          // 変更提案のステータス判定
          const counterStatus = isCounterProposal && message.counterProposalData
            ? getCounterProposalStatus(index, messages, deliverySchedules, message.counterProposalData)
            : null;

          // 連続メッセージのアバター表示判定
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const showAvatar = !isMyMessage && (!prevMessage || prevMessage.sender !== message.sender);

          // 吹き出しの尻尾コンポーネント
          const LeftTail = ({ color = 'white' }: { color?: string }) => (
            <div
              className="absolute -left-[6px] bottom-[8px] w-0 h-0"
              style={{
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderRight: `7px solid ${color}`,
              }}
            />
          );
          const RightTail = ({ color = 'black' }: { color?: string }) => (
            <div
              className="absolute -right-[6px] bottom-[8px] w-0 h-0"
              style={{
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                borderLeft: `7px solid ${color}`,
              }}
            />
          );

          return (
            <div key={message.id}>
              <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'} items-end gap-1.5`}>

                {/* 相手側アバター */}
                {!isMyMessage && (
                  showAvatar ? (
                    <ImageWithFallback
                      src={avatarUrl || ''}
                      alt={chatName}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-9 shrink-0" />
                  )
                )}

                {/* 自分のメッセージ: 左にタイムスタンプ */}
                {isMyMessage && (
                  <span className="text-[11px] text-gray-400 shrink-0 mb-0.5">{message.timestamp}</span>
                )}

                {/* ===== 継続提案カード ===== */}
                {message.type === 'proposal' && message.proposalData ? (
                  <div className="relative max-w-[78%]">
                    {!isMyMessage && <LeftTail />}
                    {isMyMessage && <RightTail color="white" />}
                    <ProposalMessage
                      message={{ ...message, proposalStatus: getProposalStatus(message.id) }}
                      userType={userType}
                      onAccept={() => handleProposalAccept(message.id)}
                      onCounter={() => openSubCounter(message)}
                      onDecline={() => openProposalDecline(message)}
                      hasCounterAfter={messages.slice(index + 1).some(m => m.type === 'subscriptionCounter' && m.subscriptionCounterData?.originalProposalId === message.id)}
                    />
                  </div>

                /* ===== 配送依頼カード（農家が受け取った側） ===== */
                ) : isDeliveryRequest && !isMyMessage && userType === 'farmer' ? (
                  <div className="relative max-w-[78%]">
                    <LeftTail />
                    <DeliveryRequestCard
                      message={message}
                      status={deliveryStatus!}
                      onApprove={() => handleDeliveryApprove(message)}
                      onCounter={() => openCounterProposal(message)}
                      onDecline={() => openDecline(message)}
                    />
                  </div>

                /* ===== 配送依頼（飲食店が送った側） ===== */
                ) : isDeliveryRequest && isMyMessage && userType === 'restaurant' ? (
                  <div className="relative max-w-[78%]">
                    <RightTail color="white" />
                    <DeliveryRequestSentCard message={message} status={deliveryStatus!} />
                  </div>

                /* ===== 単発変更提案カード ===== */
                ) : isCounterProposal && message.counterProposalData ? (
                  <div className="relative max-w-[78%]">
                    {!isMyMessage && <LeftTail />}
                    {isMyMessage && <RightTail color="white" />}
                    <CounterProposalCard
                      data={message.counterProposalData}
                      isMyMessage={isMyMessage}
                      userType={userType}
                      status={counterStatus!}
                      onAccept={() => handleAcceptCounterProposal(message.counterProposalData!)}
                      timestamp={message.timestamp}
                    />
                  </div>

                /* ===== 継続提案の変更提案カード ===== */
                ) : isSubCounter && message.subscriptionCounterData ? (
                  <div className="relative max-w-[78%]">
                    {!isMyMessage && <LeftTail />}
                    {isMyMessage && <RightTail color="white" />}
                    <SubscriptionCounterCard
                      data={message.subscriptionCounterData}
                      isMyMessage={isMyMessage}
                      userType={userType}
                      status={getProposalStatus(message.subscriptionCounterData.originalProposalId) === 'accepted' ? 'accepted' : 'pending'}
                      onAccept={() => handleAcceptSubCounter(message.subscriptionCounterData!)}
                      timestamp={message.timestamp}
                    />
                  </div>

                /* ===== お断りメッセージ ===== */
                ) : isDecline && !isMyMessage ? (
                  <div className="relative max-w-[78%]">
                    <LeftTail />
                    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                      <div className="bg-gray-600 text-white px-5 py-3">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-5 h-5" />
                          <span className="font-bold text-base">お断り</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm whitespace-pre-wrap break-words text-gray-700">
                          {message.text?.replace('【お断り】\n', '')}
                        </p>
                      </div>
                    </div>
                  </div>

                /* ===== 注文承認メッセージ（特別表示） ===== */
                ) : isApproval ? (
                  <div className="relative max-w-[78%]">
                    {!isMyMessage && <LeftTail />}
                    {isMyMessage && <RightTail color="white" />}
                    <div className="rounded-2xl overflow-hidden border border-green-200 bg-white shadow-sm">
                      <div className="bg-green-600 text-white px-5 py-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-bold text-base">注文承認</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm whitespace-pre-wrap break-words text-black">
                          {message.text?.replace('【注文承認】\n', '')}
                        </p>
                      </div>
                    </div>
                  </div>

                /* ===== 配達完了メッセージ ===== */
                ) : isDeliveryComplete ? (
                  <div className="relative max-w-[78%]">
                    {!isMyMessage && <LeftTail />}
                    {isMyMessage && <RightTail color="white" />}
                    <div className="rounded-2xl overflow-hidden border border-green-200 bg-white shadow-sm">
                      <div className="bg-green-600 text-white px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Truck className="w-5 h-5" />
                          <span className="font-bold text-base">配達完了</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm whitespace-pre-wrap break-words text-black">
                          {message.text?.replace('【配達完了】\n', '')}
                        </p>
                      </div>
                    </div>
                  </div>

                /* ===== 受取確認メッセージ ===== */
                ) : isReceiptConfirm ? (
                  <div className="relative max-w-[78%]">
                    {!isMyMessage && <LeftTail />}
                    {isMyMessage && <RightTail color="white" />}
                    <div className="rounded-2xl overflow-hidden border border-blue-200 bg-white shadow-sm">
                      <div className="bg-blue-600 text-white px-5 py-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-bold text-base">受取確認</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm whitespace-pre-wrap break-words text-black">
                          {message.text?.replace('【受取確認】\n', '')}
                        </p>
                      </div>
                    </div>
                  </div>

                /* ===== 問題報告メッセージ ===== */
                ) : isIssueReport ? (
                  <div className="relative max-w-[78%]">
                    {!isMyMessage && <LeftTail />}
                    {isMyMessage && <RightTail color="white" />}
                    <div className="rounded-2xl overflow-hidden border border-red-200 bg-white shadow-sm">
                      <div className="bg-red-600 text-white px-5 py-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          <span className="font-bold text-base">問題報告</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm whitespace-pre-wrap break-words text-black">
                          {message.text?.replace('【問題報告】\n', '')}
                        </p>
                      </div>
                    </div>
                  </div>

                /* ===== 承認取消メッセージ ===== */
                ) : isCancelApproval ? (
                  <div className="relative max-w-[78%]">
                    {!isMyMessage && <LeftTail />}
                    {isMyMessage && <RightTail color="white" />}
                    <div className="rounded-2xl overflow-hidden border border-gray-300 bg-white shadow-sm">
                      <div className="bg-gray-700 text-white px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Ban className="w-5 h-5" />
                          <span className="font-bold text-base">承認取消</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm whitespace-pre-wrap break-words text-black">
                          {message.text?.replace('【承認取消】\n', '')}
                        </p>
                      </div>
                    </div>
                  </div>

                /* ===== 一括支払い完了メッセージ ===== */
                ) : isBatchPayment ? (
                  <div className="relative max-w-[78%]">
                    {!isMyMessage && <LeftTail />}
                    {isMyMessage && <RightTail color="white" />}
                    <div className="rounded-2xl overflow-hidden border border-green-200 bg-white shadow-sm">
                      <div className="bg-gray-800 text-white px-5 py-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-bold text-base">支払い完了</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm whitespace-pre-wrap break-words text-black">
                          {message.text?.replace('【支払い完了】\n', '')}
                        </p>
                      </div>
                    </div>
                  </div>

                /* ===== 通常メッセージ ===== */
                ) : (
                  <div className="relative">
                    {!isMyMessage && <LeftTail />}
                    {isMyMessage && <RightTail />}
                    <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                      isMyMessage
                        ? 'bg-black text-white rounded-br-sm'
                        : 'bg-white text-black rounded-bl-sm'
                    }`}>
                      <p className="text-[15px] whitespace-pre-wrap break-words">{message.text}</p>
                    </div>
                  </div>
                )}

                {/* 相手のメッセージ: 右にタイムスタンプ */}
                {!isMyMessage && (
                  <span className="text-[11px] text-gray-400 shrink-0 mb-0.5">{message.timestamp}</span>
                )}
              </div>

              {/* 配送依頼後ヘルプテキスト（飲食店側・pending時のみ） */}
              {isDeliveryRequest && isMyMessage && userType === 'restaurant' && deliveryStatus === 'pending' && (
                <div className="flex justify-center mt-3">
                  <div className="flex items-center gap-2 bg-gray-100 text-gray-500 rounded-full px-4 py-2 text-xs">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>農家からの承認メッセージをお待ちください</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200">
        {/* 展開メニュー */}
        {showPlusMenu && (
          <div className="px-4 pt-3 pb-1 border-b border-gray-100 fixed bottom-[calc(4rem+3.5rem)] left-0 right-0 z-10 bg-white">
            <div className="flex gap-6 justify-center">

              <button
                onClick={() => setShowPlusMenu(false)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-gray-700" />
                </div>
                <span className="text-[11px] text-gray-600 font-medium">写真</span>
              </button>
              <button
                onClick={() => { setShowTemplateModal(true); setShowPlusMenu(false); }}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-gray-700" />
                </div>
                <span className="text-[11px] text-gray-600 font-medium">定型文</span>
              </button>
            </div>
          </div>
        )}
        {/* 入力バー */}
        <div className="flex gap-2 items-end p-3 fixed bottom-16 left-0 right-0 z-10 bg-white border-t border-gray-200">
          <button
            onClick={() => setShowPlusMenu(!showPlusMenu)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all active:scale-90 flex-shrink-0"
          >
            <Plus className={`w-6 h-6 text-gray-500 transition-transform duration-200 ${showPlusMenu ? 'rotate-45' : ''}`} />
          </button>
          <div className="flex-1">
            <Input
              type="text"
              placeholder="メッセージを入力..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setShowPlusMenu(false)}
              autoFocus
              className="w-full h-10 text-base rounded-full border border-gray-300 focus:border-gray-500 px-4 bg-gray-50"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-all disabled:bg-gray-300 disabled:text-gray-400"
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {/* ===== 変更提案モーダル（農家用ボトムシート） ===== */}
      {counterProposalTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={() => setCounterProposalTarget(null)}>
          <div className="bg-white w-full rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-5 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Repeat className="w-6 h-6 text-black" />
                  <h3 className="text-xl font-bold text-black">変更の提案</h3>
                </div>
                <button onClick={() => setCounterProposalTarget(null)} className="p-2 hover:bg-gray-100 rounded-xl active:scale-95">
                  <XCircle className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* 商品ごとの数量変更 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">数量の変更</label>
                <div className="space-y-3">
                  {counterProposalTarget.items.map((item, idx) => {
                    const changed = item.proposedQuantity !== item.originalQuantity;
                    return (
                      <div key={idx} className={`p-4 rounded-xl border-2 ${changed ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-black">{item.productName}</span>
                          {changed && <span className="text-xs text-amber-600 font-bold">変更あり</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16">元の数量:</span>
                          <span className="text-sm text-gray-500">{item.originalQuantity}{item.unit}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-700 font-bold w-16">提案:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...counterProposalTarget.items];
                              updated[idx] = { ...updated[idx], proposedQuantity: Math.max(0, updated[idx].proposedQuantity - 1) };
                              setCounterProposalTarget({ ...counterProposalTarget, items: updated });
                            }}
                            className="w-9 h-9 bg-white border-2 border-gray-300 hover:bg-gray-100 rounded-lg flex items-center justify-center active:scale-95"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item.proposedQuantity}
                            onChange={e => {
                              const val = toHalfWidth(e.target.value);
                              const num = Math.max(0, parseInt(val) || 0);
                              const updated = [...counterProposalTarget.items];
                              updated[idx] = { ...updated[idx], proposedQuantity: num };
                              setCounterProposalTarget({ ...counterProposalTarget, items: updated });
                            }}
                            className="w-16 border-2 border-gray-300 rounded-lg px-2 py-1.5 text-center text-base font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...counterProposalTarget.items];
                              updated[idx] = { ...updated[idx], proposedQuantity: updated[idx].proposedQuantity + 1 };
                              setCounterProposalTarget({ ...counterProposalTarget, items: updated });
                            }}
                            className="w-9 h-9 bg-white border-2 border-gray-300 hover:bg-gray-100 rounded-lg flex items-center justify-center active:scale-95"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <span className="text-sm text-gray-600">{item.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 配送日変更 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">配送日の変更</label>
                <div className="text-xs text-gray-500 mb-2">
                  元の希望日: {counterProposalTarget.originalDate
                    ? new Date(counterProposalTarget.originalDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '未指定'}
                </div>
                <DatePicker
                  value={counterProposalTarget.proposedDate}
                  onChange={date => setCounterProposalTarget({ ...counterProposalTarget, proposedDate: date })}
                  minDate={new Date().toISOString().split('T')[0]}
                  placeholder="変更後の配送日"
                />
                {counterProposalTarget.proposedDate !== counterProposalTarget.originalDate && (
                  <p className="text-xs text-amber-600 font-bold mt-1">配送日が変更されています</p>
                )}
              </div>

              {/* 変更理由 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  変更理由 <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {counterProposalReasons.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCounterProposalTarget({ ...counterProposalTarget, reason: r })}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all active:scale-95 ${
                        counterProposalTarget.reason === r
                          ? 'border-black bg-black text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  value={counterProposalTarget.reason}
                  onChange={e => setCounterProposalTarget({ ...counterProposalTarget, reason: e.target.value })}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base resize-none focus:border-black"
                  rows={3}
                  placeholder="変更の理由を入力してください"
                />
              </div>

              {/* 変更後の見積もり */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                <h4 className="font-bold text-sm text-gray-700 mb-3">変更後の金額</h4>
                {(() => {
                  const newAmount = counterProposalTarget.items.reduce((s, i) => s + i.proposedQuantity * i.unitPrice, 0);
                  const diff = newAmount - counterProposalTarget.originalAmount;
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">変更前</span>
                        <span className="text-gray-500 line-through">¥{counterProposalTarget.originalAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-black">変更後</span>
                        <span className="text-black text-lg">¥{newAmount.toLocaleString()}</span>
                      </div>
                      {diff !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">差額</span>
                          <span className={`font-bold ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {diff > 0 ? '+' : ''}¥{diff.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* アクション */}
              <div className="flex gap-3 pb-4">
                <Button
                  type="button"
                  onClick={() => setCounterProposalTarget(null)}
                  variant="outline"
                  className="flex-1 border-2 border-gray-300 rounded-xl h-14 text-base font-bold"
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitCounterProposal}
                  disabled={!counterProposalTarget.reason.trim()}
                  className="flex-1 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 rounded-xl h-14 text-base font-bold active:scale-[0.98]"
                >
                  <Repeat className="w-5 h-5 mr-2" />
                  提案を送信
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== お断りモーダル ===== */}
      {declineTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={() => setDeclineTarget(null)}>
          <div className="bg-white w-full rounded-t-3xl p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <AlertTriangle className="w-6 h-6 text-gray-600" />
              <h3 className="text-xl font-bold text-black">{declineTarget.isProposal ? '継続提案をお断り' : '配送依頼をお断り'}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {declineTarget.productName}の{declineTarget.isProposal ? '継続提案' : '配送依頼'}をお断りします。
              理由を入力してください。
            </p>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base resize-none focus:border-black mb-4"
              rows={3}
              placeholder="例: 現在在庫がなく、次の収穫は来月の予定です。"
            />
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setDeclineTarget(null)}
                variant="outline"
                className="flex-1 border-2 border-gray-300 rounded-xl h-14 text-base font-bold"
              >
                戻る
              </Button>
              <Button
                type="button"
                onClick={handleSubmitDecline}
                className="flex-1 bg-gray-700 text-white hover:bg-gray-800 rounded-xl h-14 text-base font-bold active:scale-[0.98]"
              >
                お断りを送信
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 継続提案の変更提案モーダル ===== */}
      {subCounterTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50" onClick={() => setSubCounterTarget(null)}>
          <div className="bg-white w-full rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-5 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Repeat className="w-6 h-6 text-black" />
                  <h3 className="text-xl font-bold text-black">継続提案の変更</h3>
                </div>
                <button onClick={() => setSubCounterTarget(null)} className="p-2 hover:bg-gray-100 rounded-xl active:scale-95">
                  <XCircle className="w-6 h-6 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">{subCounterTarget.productName}</p>
            </div>
            <div className="p-6 space-y-5">
              {/* 数量 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">配送量（1回あたり）</label>
                <div className="text-xs text-gray-500 mb-2">元の数量: {subCounterTarget.quantity.original}{subCounterTarget.unit}</div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setSubCounterTarget({ ...subCounterTarget, quantity: { ...subCounterTarget.quantity, proposed: Math.max(1, subCounterTarget.quantity.proposed - 1) } })}
                    className="w-9 h-9 bg-white border-2 border-gray-300 hover:bg-gray-100 rounded-lg flex items-center justify-center active:scale-95"><Minus className="w-4 h-4" /></button>
                  <input type="text" inputMode="numeric" value={subCounterTarget.quantity.proposed}
                    onChange={e => { const val = toHalfWidth(e.target.value); setSubCounterTarget({ ...subCounterTarget, quantity: { ...subCounterTarget.quantity, proposed: Math.max(1, parseInt(val) || 1) } }); }}
                    className="w-20 border-2 border-gray-300 rounded-lg px-2 py-1.5 text-center text-base font-bold" />
                  <button type="button" onClick={() => setSubCounterTarget({ ...subCounterTarget, quantity: { ...subCounterTarget.quantity, proposed: subCounterTarget.quantity.proposed + 1 } })}
                    className="w-9 h-9 bg-white border-2 border-gray-300 hover:bg-gray-100 rounded-lg flex items-center justify-center active:scale-95"><Plus className="w-4 h-4" /></button>
                  <span className="text-sm text-gray-600">{subCounterTarget.unit}</span>
                  {subCounterTarget.quantity.proposed !== subCounterTarget.quantity.original && <span className="text-xs text-amber-600 font-bold">変更</span>}
                </div>
              </div>
              {/* 単価 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">1回あたりの価格</label>
                <div className="text-xs text-gray-500 mb-2">元の価格: ¥{subCounterTarget.pricePerDelivery.original.toLocaleString()}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">¥</span>
                  <input type="text" inputMode="numeric" value={subCounterTarget.pricePerDelivery.proposed}
                    onChange={e => { const val = toHalfWidth(e.target.value); setSubCounterTarget({ ...subCounterTarget, pricePerDelivery: { ...subCounterTarget.pricePerDelivery, proposed: Math.max(0, parseInt(val) || 0) } }); }}
                    className="w-32 border-2 border-gray-300 rounded-lg px-3 py-1.5 text-base font-bold" />
                  {subCounterTarget.pricePerDelivery.proposed !== subCounterTarget.pricePerDelivery.original && <span className="text-xs text-amber-600 font-bold">変更</span>}
                </div>
              </div>
              {/* 配送開始日 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">配送開始日</label>
                <DatePicker value={subCounterTarget.startDate.proposed}
                  onChange={date => setSubCounterTarget({ ...subCounterTarget, startDate: { ...subCounterTarget.startDate, proposed: date } })}
                  minDate={new Date().toISOString().split('T')[0]} placeholder="配送開始日" />
                {subCounterTarget.startDate.proposed !== subCounterTarget.startDate.original && <p className="text-xs text-amber-600 font-bold mt-1">開始日が変更されています</p>}
              </div>
              {/* 変更理由 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">変更理由 <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {counterProposalReasons.map(r => (
                    <button key={r} type="button" onClick={() => setSubCounterTarget({ ...subCounterTarget, reason: r })}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all active:scale-95 ${
                        subCounterTarget.reason === r ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}>{r}</button>
                  ))}
                </div>
                <textarea value={subCounterTarget.reason} onChange={e => setSubCounterTarget({ ...subCounterTarget, reason: e.target.value })}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base resize-none focus:border-black" rows={3} placeholder="変更の理由を入力してください" />
              </div>
              {/* 見積もり */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                <h4 className="font-bold text-sm text-gray-700 mb-3">変更後の見積もり</h4>
                {(() => {
                  const origTotal = subCounterTarget.pricePerDelivery.original * subCounterTarget.totalDeliveries;
                  const newTotal = subCounterTarget.pricePerDelivery.proposed * subCounterTarget.totalDeliveries;
                  const diff = newTotal - origTotal;
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">1回あたり</span><span className="font-bold text-black">¥{subCounterTarget.pricePerDelivery.proposed.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">配送回数</span><span className="font-bold text-black">{subCounterTarget.totalDeliveries}回</span></div>
                      <div className="border-t border-gray-200 pt-2 flex justify-between">
                        <span className="text-gray-700 font-bold">合計見積</span>
                        <span className="font-bold text-lg text-black">¥{newTotal.toLocaleString()}</span>
                      </div>
                      {diff !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">差額</span>
                          <span className={`font-bold ${diff > 0 ? 'text-red-600' : 'text-green-600'}`}>{diff > 0 ? '+' : ''}¥{diff.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              {/* アクション */}
              <div className="flex gap-3 pb-4">
                <Button type="button" onClick={() => setSubCounterTarget(null)} variant="outline" className="flex-1 border-2 border-gray-300 rounded-xl h-14 text-base font-bold">キャンセル</Button>
                <Button type="button" onClick={handleSubmitSubCounter} disabled={!subCounterTarget.reason.trim()}
                  className="flex-1 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 rounded-xl h-14 text-base font-bold active:scale-[0.98]">
                  <Repeat className="w-5 h-5 mr-2" />提案を送信</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 商品選択モーダル */}
      {showOrderModal && !selectedProduct && (
        <div className="fixed inset-0 bg-black/30 flex items-end z-50" onClick={() => setShowOrderModal(false)}>
          <div className="bg-white w-full rounded-t-3xl p-6 animate-slide-up shadow-2xl h-[65vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-bold mb-6 text-black text-center">商品を選択</h3>
            <div className="space-y-3">
              {(() => {
                const currentChat = chats.find(c => c.id === chatId);
                const farmerId = currentChat?.farmerId;
                const farmerProducts = farmerId
                  ? products.filter(p => p.farmerId === farmerId && p.isPublished !== false)
                  : products.filter(p => p.isPublished !== false);
                if (farmerProducts.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-lg text-gray-500">この農家の登録商品がありません</p>
                      <p className="text-sm text-gray-400 mt-2">農家が商品を登録すると、ここに表示されます</p>
                    </div>
                  );
                }
                return farmerProducts.map(product => (
                  <button key={product.id} onClick={() => handleProductSelect(product)}
                    className="w-full bg-white border-2 border-gray-300 rounded-xl p-4 hover:border-black transition-all active:scale-[0.98] flex items-center gap-4">
                    <ImageWithFallback src={product.imageUrl || ''} alt={product.name} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <h4 className="text-xl font-bold text-black mb-1">{product.name}</h4>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-black">¥{product.price.toLocaleString()}</span>
                        <span className="text-base text-gray-600">/{product.unit}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">在庫 {product.stock}{product.unit}</p>
                    </div>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 発注詳細モーダル */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/30 flex items-end z-50" onClick={() => { setSelectedProduct(null); setOrderQuantity(''); setOrderDate(''); }}>
          <div className="bg-white w-full rounded-t-3xl p-8 animate-slide-up shadow-2xl h-[65vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="mb-6">
              <ImageWithFallback src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-24 h-24 rounded-xl object-cover mx-auto mb-4" />
              <h3 className="text-3xl font-bold text-center text-black mb-2">{selectedProduct.name}</h3>
              <div className="text-center">
                <span className="text-4xl font-bold text-black">¥{selectedProduct.price.toLocaleString()}</span>
                <span className="text-xl text-gray-600">/{selectedProduct.unit}</span>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-xl font-bold mb-4 text-black">数量 <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-3">
                <Input type="text" inputMode="numeric" placeholder="0" value={orderQuantity} onChange={e => { const val = toHalfWidth(e.target.value); if (val === '' || /^\d+$/.test(val)) setOrderQuantity(val); }} autoFocus
                  className="flex-1 text-2xl p-6 rounded-xl border-2 border-gray-300 focus:border-black text-center font-bold" />
                <span className="text-2xl font-bold text-gray-700">{selectedProduct.unit}</span>
              </div>
            </div>
            <div className="mb-8">
              <label className="block text-xl font-bold mb-4 text-black">
                <Calendar className="w-6 h-6 inline mr-2" />納品希望日 <span className="text-red-500">*</span>
              </label>
              <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="w-full text-xl p-6 rounded-xl border-2 border-gray-300 focus:border-black" />
            </div>
            <div className="flex gap-4">
              <Button onClick={() => { setSelectedProduct(null); setOrderQuantity(''); setOrderDate(''); }} variant="outline"
                className="flex-1 h-16 text-xl border-2 border-gray-300 rounded-xl hover:bg-gray-100">キャンセル</Button>
              <Button onClick={handleOrderConfirm} disabled={!orderQuantity || !orderDate}
                className="flex-1 h-16 text-xl bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 rounded-xl font-bold">発注する</Button>
            </div>
          </div>
        </div>
      )}

      {/* 定型文モーダル */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/30 flex items-end z-50" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white w-full rounded-t-3xl p-6 animate-slide-up shadow-2xl h-[65vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-bold mb-6 text-black text-center">定型文を選択</h3>
            <div className="space-y-3">
              {templateMessages.map(template => (
                <button key={template} onClick={() => handleTemplateSelect(template)}
                  className="w-full bg-white border-2 border-gray-300 rounded-xl p-4 hover:border-black transition-all active:scale-[0.98] flex items-center gap-4">
                  <MessageSquare className="w-6 h-6 text-gray-600" />
                  <div className="flex-1 text-left"><p className="text-xl font-bold text-black mb-1">{template}</p></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 承認祝賀モーダル */}
      {showCelebration && celebrationData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCelebration(false)}>
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <div className="mb-6">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold text-black mb-2">契約が成立しました！</h2>
              <p className="text-base text-gray-600 mb-6">{celebrationData.productName}の継続契約が承認されました</p>
            </div>
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 mb-6">
              <div className="text-sm text-green-700 mb-2">契約内容</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm"><span className="text-green-700">商品:</span><span className="font-bold text-green-900">{celebrationData.productName}</span></div>
                <div className="flex justify-between text-sm"><span className="text-green-700">数量:</span><span className="font-bold text-green-900">{celebrationData.quantity}{celebrationData.unit} / 回</span></div>
                <div className="flex justify-between text-sm"><span className="text-green-700">頻度:</span><span className="font-bold text-green-900">{celebrationData.frequency}</span></div>
                <div className="flex justify-between text-sm border-t border-green-300 pt-2"><span className="text-green-700">1回あたり:</span><span className="font-bold text-green-900 text-lg">¥{celebrationData.pricePerDelivery.toLocaleString()}</span></div>
              </div>
            </div>
            <Button onClick={() => setShowCelebration(false)} className="w-full bg-black text-white hover:bg-gray-800 h-14 text-lg font-bold rounded-xl">確認</Button>
          </div>
        </div>
      )}
    </div>
  );
}


// =====================================
// サブコンポーネント
// =====================================

// --- 農家が見る配送依頼カード ---
function DeliveryRequestCard({ message, status, onApprove, onCounter, onDecline }: {
  message: Message;
  status: DeliveryRequestStatus;
  onApprove: () => void;
  onCounter: () => void;
  onDecline: () => void;
}) {
  const bodyText = message.text?.replace('【配送依頼】\n', '') || '';

  const statusBadge = {
    approved: { bg: 'bg-green-50 border-green-200', icon: <CheckCircle className="w-4 h-4 text-green-600" />, label: '承認済み', color: 'text-green-700' },
    counterProposed: { bg: 'bg-amber-50 border-amber-200', icon: <Repeat className="w-4 h-4 text-amber-600" />, label: '変更提案中', color: 'text-amber-700' },
    declined: { bg: 'bg-gray-50 border-gray-300', icon: <XCircle className="w-4 h-4 text-gray-500" />, label: 'お断り済み', color: 'text-gray-600' },
    pending: null,
  };

  const badge = statusBadge[status];

  return (
    <div className="max-w-[85%] rounded-2xl overflow-hidden border-2 border-gray-200 bg-white">
      <div className="bg-black text-white px-5 py-3">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          <span className="font-bold text-base">配送依頼</span>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm whitespace-pre-wrap break-words text-black mb-3">{bodyText}</p>

        {status === 'pending' ? (
          <div className="flex items-center gap-2">
            <Button onClick={onApprove} className="flex-1 bg-black text-white hover:bg-gray-800 h-9 text-[13px] font-bold rounded-lg active:scale-[0.98]">
              <CheckCircle className="w-4 h-4 mr-1.5" />
              承認
            </Button>
            <Button onClick={onCounter} variant="outline" className="border border-gray-300 rounded-lg h-9 text-[13px] font-bold px-3 active:scale-[0.98]">
              <Repeat className="w-3.5 h-3.5 mr-1" />
              変更
            </Button>
            <button onClick={onDecline} className="h-9 px-3 text-[13px] text-gray-400 hover:text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors active:scale-[0.98] whitespace-nowrap flex-shrink-0">
              お断り
            </button>
          </div>
        ) : badge ? (
          <div className={`${badge.bg} rounded-lg px-3 py-2 flex items-center justify-center gap-1.5`}>
            {badge.icon}
            <span className={`${badge.color} font-bold text-[13px]`}>{badge.label}</span>
          </div>
        ) : null}

      </div>
    </div>
  );
}

// --- 飲食店が送った配送依頼カード（自分が送った側） ---
function DeliveryRequestSentCard({ message, status }: {
  message: Message;
  status: DeliveryRequestStatus;
}) {
  const bodyText = message.text?.replace('【配送依頼】\n', '') || '';

  const statusLabel = {
    pending: { text: '承認待ち', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: <Clock className="w-4 h-4 text-yellow-600" /> },
    approved: { text: '承認済み', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: <CheckCircle className="w-4 h-4 text-green-600" /> },
    counterProposed: { text: '変更提案あり', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <Repeat className="w-4 h-4 text-amber-600" /> },
    declined: { text: 'お断り', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-300', icon: <XCircle className="w-4 h-4 text-gray-500" /> },
  };

  const s = statusLabel[status];

  return (
    <div className="max-w-[85%] rounded-2xl overflow-hidden border-2 border-gray-200 bg-white">
      <div className="bg-black text-white px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            <span className="font-bold text-base">配送依頼</span>
          </div>
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm whitespace-pre-wrap break-words text-black mb-3">{bodyText}</p>
        <div className={`${s.bg} border-2 rounded-xl p-3 text-center flex items-center justify-center gap-2`}>
          {s.icon}
          <span className={`${s.color} font-bold text-sm`}>{s.text}</span>
        </div>
      </div>
    </div>
  );
}


// --- 変更提案カード ---
function CounterProposalCard({ data, isMyMessage, userType, status, onAccept, timestamp }: {
  data: CounterProposalData;
  isMyMessage: boolean;
  userType: 'restaurant' | 'farmer';
  status: 'pending' | 'accepted';
  onAccept: () => void;
  timestamp: string;
}) {
  const dateChanged = data.originalDate !== data.proposedDate;
  const qtyChanged = data.items.some(i => i.originalQuantity !== i.proposedQuantity);
  const showAcceptButton = !isMyMessage && userType === 'restaurant' && status === 'pending';

  return (
    <div className={`max-w-[85%] rounded-2xl overflow-hidden border-2 ${
      status === 'accepted' ? 'border-green-200' : 'border-amber-200'
    } bg-white`}>
      {/* ヘッダー */}
      <div className="bg-amber-500 text-white px-5 py-3">
        <div className="flex items-center gap-2">
          <Repeat className="w-5 h-5" />
          <span className="font-bold text-base">変更の提案</span>
        </div>
      </div>

      <div className="p-4">
        {/* 変更理由 */}
        <div className="bg-amber-50 rounded-xl p-3 mb-3">
          <p className="text-sm text-amber-800">
            <span className="font-bold">変更理由:</span> {data.reason}
          </p>
        </div>

        {/* 変更内容 */}
        <div className="space-y-2 mb-3">
          {data.items.map((item, idx) => {
            const changed = item.originalQuantity !== item.proposedQuantity;
            return (
              <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-sm ${changed ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <span className="font-bold text-black">{item.productName}</span>
                <div className="flex items-center gap-2">
                  {changed ? (
                    <>
                      <span className="text-gray-400 line-through text-xs">{item.originalQuantity}{item.unit}</span>
                      <span className="text-amber-700 font-bold">{item.proposedQuantity}{item.unit}</span>
                    </>
                  ) : (
                    <span className="text-gray-700">{item.originalQuantity}{item.unit}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* 配送日 */}
          <div className={`flex items-center justify-between p-2 rounded-lg text-sm ${dateChanged ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <span className="font-bold text-black">配送日</span>
            <div className="flex items-center gap-2">
              {dateChanged ? (
                <>
                  <span className="text-gray-400 line-through text-xs">
                    {new Date(data.originalDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-amber-700 font-bold">
                    {new Date(data.proposedDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </span>
                </>
              ) : (
                <span className="text-gray-700">
                  {new Date(data.originalDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          {/* 金額 */}
          {data.originalAmount !== data.proposedAmount && (
            <div className="flex items-center justify-between p-2 rounded-lg text-sm bg-amber-50">
              <span className="font-bold text-black">合計金額</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 line-through text-xs">¥{data.originalAmount.toLocaleString()}</span>
                <span className="text-amber-700 font-bold">¥{data.proposedAmount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* 変更まとめチップ */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {qtyChanged && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-bold">数量変更</span>
          )}
          {dateChanged && (
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-bold">日程変更</span>
          )}
        </div>

        {/* アクション or ステータス */}
        {showAcceptButton ? (
          <Button
            onClick={onAccept}
            className="w-full bg-black text-white hover:bg-gray-800 h-12 text-base font-bold rounded-xl active:scale-[0.98]"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            この内容で注文する
          </Button>
        ) : status === 'accepted' ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-green-700 font-bold text-sm">承認済み</span>
          </div>
        ) : isMyMessage ? (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 text-center flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-amber-700 font-bold text-sm">相手の回答待ち</span>
          </div>
        ) : null}

      </div>
    </div>
  );
}


// --- 継続提案の変更提案カード ---
function SubscriptionCounterCard({ data, isMyMessage, userType, status, onAccept, timestamp }: {
  data: SubscriptionCounterData;
  isMyMessage: boolean;
  userType: 'restaurant' | 'farmer';
  status: 'pending' | 'accepted';
  onAccept: () => void;
  timestamp: string;
}) {
  const qtyChanged = data.quantity.original !== data.quantity.proposed;
  const priceChanged = data.pricePerDelivery.original !== data.pricePerDelivery.proposed;
  const startChanged = (data.startDate as any).original !== (data.startDate as any).proposed;
  const showAcceptButton = !isMyMessage && userType === 'restaurant' && status === 'pending';

  const changes: { label: string; original: string; proposed: string }[] = [];
  if (qtyChanged) changes.push({ label: '配送量', original: `${data.quantity.original}${data.unit}`, proposed: `${data.quantity.proposed}${data.unit}` });
  if (priceChanged) changes.push({ label: '単価', original: `¥${data.pricePerDelivery.original.toLocaleString()}`, proposed: `¥${data.pricePerDelivery.proposed.toLocaleString()}` });
  if (startChanged) changes.push({
    label: '開始日',
    original: (data.startDate as any).original ? new Date((data.startDate as any).original).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : '—',
    proposed: (data.startDate as any).proposed ? new Date((data.startDate as any).proposed).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : '—',
  });

  return (
    <div className={`max-w-[85%] rounded-2xl overflow-hidden border-2 ${status === 'accepted' ? 'border-green-200' : 'border-amber-200'} bg-white`}>
      <div className="bg-amber-500 text-white px-5 py-3">
        <div className="flex items-center gap-2"><Repeat className="w-5 h-5" /><span className="font-bold text-base">継続提案の変更</span></div>
      </div>
      <div className="p-4">
        <p className="text-sm font-bold text-black mb-2">{data.productName}</p>
        <div className="bg-amber-50 rounded-xl p-3 mb-3">
          <p className="text-sm text-amber-800"><span className="font-bold">変更理由:</span> {data.reason}</p>
        </div>
        <div className="space-y-2 mb-3">
          {changes.map((c, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-lg text-sm bg-amber-50">
              <span className="font-bold text-black">{c.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 line-through text-xs">{c.original}</span>
                <span className="text-amber-700 font-bold">{c.proposed}</span>
              </div>
            </div>
          ))}
          {data.totalAmount.original !== data.totalAmount.proposed && (
            <div className="flex items-center justify-between p-2 rounded-lg text-sm bg-amber-50">
              <span className="font-bold text-black">合計見積</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 line-through text-xs">¥{data.totalAmount.original.toLocaleString()}</span>
                <span className="text-amber-700 font-bold">¥{data.totalAmount.proposed.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
        {showAcceptButton ? (
          <Button onClick={onAccept} className="w-full bg-black text-white hover:bg-gray-800 h-12 text-base font-bold rounded-xl active:scale-[0.98]">
            <CheckCircle className="w-5 h-5 mr-2" />この内容で契約する</Button>
        ) : status === 'accepted' ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-700 font-bold text-sm">契約成立</span></div>
        ) : isMyMessage ? (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 text-center flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" /><span className="text-amber-700 font-bold text-sm">相手の回答待ち</span></div>
        ) : null}
      </div>
    </div>
  );
}

// --- 継続提案カード ---
interface ProposalMessageProps {
  message: Message;
  userType: 'restaurant' | 'farmer';
  onAccept: () => void;
  onCounter: () => void;
  onDecline: () => void;
  hasCounterAfter: boolean;
}

function ProposalMessage({ message, userType, onAccept, onCounter, onDecline, hasCounterAfter }: ProposalMessageProps) {
  const proposalData = message.proposalData;
  if (!proposalData) return null;

  const statusConfig = {
    pending: { color: 'bg-yellow-50 border-yellow-300', text: '承認待ち', textColor: 'text-yellow-700' },
    accepted: { color: 'bg-green-50 border-green-300', text: '承認済み', textColor: 'text-green-700' },
    rejected: { color: 'bg-gray-50 border-gray-300', text: '却下', textColor: 'text-gray-700' },
  };

  const status = message.proposalStatus || 'pending';
  const config = statusConfig[status];
  const isReceivedMessage = message.sender !== userType;

  return (
    <div className={`max-w-[85%] rounded-2xl overflow-hidden border-2 ${config.color}`}>
      <div className="bg-blue-600 text-white px-5 py-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          <span className="font-bold text-lg">継続の提案</span>
        </div>
      </div>
      <div className="p-4 bg-white space-y-3">
        <h3 className="text-lg font-bold text-black">{proposalData.productName}</h3>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-500">配送量</span>
            <span className="font-semibold text-black">{proposalData.quantity}{proposalData.unit} / 回</span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-500">開始日</span>
            <span className="font-semibold text-black">
              {proposalData.startDate ? new Date(proposalData.startDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
            </span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-500">終了日</span>
            <span className="font-semibold text-black">
              {proposalData.endDate
                ? new Date(proposalData.endDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
                : `${proposalData.totalDeliveries}回（${proposalData.period}）`}
            </span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-500">配送頻度</span>
            <span className="font-semibold text-black">
              {{ twice_weekly: '週2回', weekly: '週1回', biweekly: '隔週', monthly: '月1回' }[proposalData.frequency] || proposalData.frequency}
            </span>
          </div>
          <div className="flex justify-between text-[13px]">
            <span className="text-gray-500">配送曜日</span>
            <span className="font-semibold text-black">{proposalData.deliveryDay}</span>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-blue-600">1回あたり</span>
            <span className="text-base font-bold text-blue-900">{proposalData.pricePerDelivery.toLocaleString()}円</span>
          </div>
          <div className="border-t border-blue-200 mt-2 pt-2 flex justify-between items-center">
            <span className="text-xs font-bold text-blue-600">合計見積</span>
            <span className="text-xl font-bold text-blue-900">{proposalData.totalAmount.toLocaleString()}円</span>
          </div>
        </div>
        {proposalData.message && (
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{proposalData.message}</p>
          </div>
        )}
        {isReceivedMessage && status === 'pending' && !hasCounterAfter ? (
          <div className="space-y-2 pt-1">
            <Button onClick={onAccept} className="w-full bg-black text-white hover:bg-gray-800 h-11 text-sm font-bold rounded-xl active:scale-[0.98]">
              <CheckCircle className="w-4 h-4 mr-1.5" />このまま承認
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={onCounter} variant="outline" className="border-2 border-gray-300 rounded-xl h-10 text-xs font-bold active:scale-[0.98]">
                <Repeat className="w-3.5 h-3.5 mr-1" />変更を提案
              </Button>
              <Button onClick={onDecline} variant="outline" className="border-2 border-gray-300 rounded-xl h-10 text-xs font-bold text-gray-500 active:scale-[0.98]">
                <XCircle className="w-3.5 h-3.5 mr-1" />お断り
              </Button>
            </div>
          </div>
        ) : hasCounterAfter ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-center flex items-center justify-center gap-1.5">
            <Repeat className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-amber-700 font-bold text-xs">変更提案中</span>
          </div>
        ) : (
          <div className={`${config.color} rounded-lg p-2.5 text-center`}>
            <span className={`${config.textColor} font-bold text-sm`}>{config.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}

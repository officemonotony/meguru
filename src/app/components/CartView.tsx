import { useState } from 'react';
import { Trash2, Minus, Plus, Package, FileText, CheckCircle } from 'lucide-react';
interface CartItem { productId: string; name: string; farmerName: string; farmerId?: string; unit: string; price: number; quantity: number; deliveryDate: string; imageUrl?: string }
import { Button } from '@/app/components/ui/button';
import { DocumentViewer, DocumentData, DocumentType } from '@/app/components/DocumentViewer';

interface CartViewProps {
  cart: CartItem[];
  onUpdateItem: (productId: string, deliveryDate: string, quantity: number) => void;
  onRemoveItem: (productId: string, deliveryDate: string) => void;
  onClearCart: () => void;
}

export function CartView({ cart, onUpdateItem, onRemoveItem, onClearCart }: CartViewProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'on_delivery' | 'monthly'>('on_delivery');
  const [showDocuments, setShowDocuments] = useState(false);
  const [generatedDocuments, setGeneratedDocuments] = useState<DocumentData[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentData | null>(null);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    setIsProcessing(true);
    // 注文処理のシミュレーショ���
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // 書類を生成
    const documents = generateDocuments();
    setGeneratedDocuments(documents);
    
    setIsProcessing(false);
    setShowCheckout(false);
    setShowDocuments(true);
  };

  const generateDocuments = (): DocumentData[] => {
    // 農家ごとにグループ化
    const farmerGroups = cart.reduce((groups, item) => {
      if (!groups[item.farmerName]) {
        groups[item.farmerName] = [];
      }
      groups[item.farmerName].push(item);
      return groups;
    }, {} as Record<string, CartItem[]>);

    const allDocuments: DocumentData[] = [];

    // 各農家ごとに書類を生成
    Object.entries(farmerGroups).forEach(([farmerName, items]) => {
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const tax = Math.floor(subtotal * 0.1);
      const total = subtotal + tax;
      const orderNumber = `ORD${Date.now()}`;
      const issueDate = new Date().toISOString();
      const deliveryDate = items[0].deliveryDate;

      const documentItems = items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.price,
        amount: item.price * item.quantity,
      }));

      const baseData = {
        orderNumber,
        issueDate,
        items: documentItems,
        subtotal,
        tax,
        total,
        deliveryDate,
        farmerInfo: {
          name: farmerName,
          address: '〒000-0000 県 市 町 1-2-3',
          phone: '000-0000-0000',
        },
        restaurantInfo: {
          name: 'レストラン○○',
          address: '〒000-0000 県 市 町 4-5-6',
          phone: '000-0000-0000',
        },
        notes: paymentMethod === 'monthly' 
          ? 'お支払いは月末締めとなります。' 
          : '商品お届け時にお支払いください。',
      };

      // 請求書
      const invoice: DocumentData = {
        ...baseData,
        id: `INV${Date.now()}-${farmerName}`,
        type: 'invoice',
        paymentDueDate: paymentMethod === 'monthly'
          ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
          : deliveryDate,
        paymentStatus: 'unpaid',
      };

      // 納品書
      const deliveryNote: DocumentData = {
        ...baseData,
        id: `DN${Date.now()}-${farmerName}`,
        type: 'delivery_note',
      };

      allDocuments.push(invoice, deliveryNote);
    });

    return allDocuments;
  };

  const handleCloseDocuments = () => {
    setShowDocuments(false);
    setGeneratedDocuments([]);
    onClearCart();
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh]">
        <div className="bg-gray-100 rounded-full p-8 mb-6">
          <Package className="w-16 h-16 text-gray-400" />
        </div>
        <p className="text-xl text-gray-600">カートに商品がありません</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-32">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-black">カート</h2>
        <Button
          onClick={onClearCart}
          variant="ghost"
          className="text-base text-gray-600 hover:text-black px-4 py-2"
        >
          すべて削除
        </Button>
      </div>

      <div className="space-y-4 mb-4">
        {cart.map((item, index) => (
          <div
            key={`${item.productId}-${item.deliveryDate}-${index}`}
            className="bg-white border-2 border-gray-300 rounded-2xl p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-black mb-1">{item.name}</h3>
                <p className="text-base text-gray-600 mb-2">{item.farmerName}</p>
                <p className="text-base text-gray-700 font-medium">
                  納品日: {new Date(item.deliveryDate).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => onRemoveItem(item.productId, item.deliveryDate)}
                className="p-3 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
              >
                <Trash2 className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-2">
                <button
                  onClick={() =>
                    onUpdateItem(item.productId, item.deliveryDate, item.quantity - 1)
                  }
                  className="p-3 hover:bg-gray-200 rounded-lg transition-colors active:scale-95"
                >
                  <Minus className="w-6 h-6 text-gray-700" />
                </button>
                <span className="font-bold text-black min-w-[80px] text-center text-2xl">
                  {item.quantity}
                  <span className="text-lg text-gray-600 ml-1">{item.unit}</span>
                </span>
                <button
                  onClick={() =>
                    onUpdateItem(item.productId, item.deliveryDate, item.quantity + 1)
                  }
                  className="p-3 hover:bg-gray-200 rounded-lg transition-colors active:scale-95"
                >
                  <Plus className="w-6 h-6 text-gray-700" />
                </button>
              </div>
              <div className="text-3xl font-bold text-black">
                ¥{(item.price * item.quantity).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 合計・注文確定ボタン */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t-2 border-gray-300 p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xl font-bold text-gray-700">合計</span>
          <span className="text-4xl font-bold text-black">¥{total.toLocaleString()}</span>
        </div>
        <Button
          onClick={() => setShowCheckout(true)}
          className="w-full bg-black text-white hover:bg-gray-800 h-16 text-xl font-bold rounded-xl active:scale-[0.98]"
        >
          <Package className="w-6 h-6 mr-2" />
          注文を確定する
        </Button>
      </div>

      {/* 注文確認モーダル */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/30 flex items-end z-50" onClick={() => setShowCheckout(false)}>
          <div className="bg-white w-full rounded-t-3xl p-8 animate-slide-up shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-3xl font-bold mb-6 text-black text-center">注文内容の確認</h3>
            
            {/* 注文内容 */}
            <div className="mb-8 space-y-4 bg-gray-50 p-6 rounded-2xl">
              <div className="flex justify-between text-lg">
                <span className="text-gray-600">商品点数</span>
                <span className="text-black font-bold text-xl">{cart.length}品目</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-gray-600">合計数量</span>
                <span className="text-black font-bold text-xl">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}kg
                </span>
              </div>
              <div className="border-t-2 border-gray-300 pt-4 flex justify-between items-center">
                <span className="text-2xl font-bold text-black">合計金額</span>
                <span className="text-4xl font-bold text-black">¥{total.toLocaleString()}</span>
              </div>
            </div>

            {/* 支払い方法選択 */}
            <div className="mb-8">
              <h4 className="text-xl font-bold text-black mb-4">お支払い方法</h4>
              <div className="space-y-3">
                <button
                  onClick={() => setPaymentMethod('on_delivery')}
                  className={`w-full p-6 rounded-2xl border-2 transition-all text-left ${
                    paymentMethod === 'on_delivery'
                      ? 'border-black bg-gray-50'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl font-bold text-black">納品時支払い</span>
                    {paymentMethod === 'on_delivery' && (
                      <CheckCircle className="w-6 h-6 text-black" />
                    )}
                  </div>
                  <p className="text-base text-gray-600">
                    商品お届け時に現金でお支払いいただきます
                  </p>
                </button>
                <button
                  onClick={() => setPaymentMethod('monthly')}
                  className={`w-full p-6 rounded-2xl border-2 transition-all text-left ${
                    paymentMethod === 'monthly'
                      ? 'border-black bg-gray-50'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl font-bold text-black">月末まとめて支払い</span>
                    {paymentMethod === 'monthly' && (
                      <CheckCircle className="w-6 h-6 text-black" />
                    )}
                  </div>
                  <p className="text-base text-gray-600">
                    月末にまとめて請求書を発行します
                  </p>
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => setShowCheckout(false)}
                variant="outline"
                className="flex-1 h-16 text-xl border-2 border-gray-300 rounded-xl hover:bg-gray-100"
                disabled={isProcessing}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="flex-1 h-16 text-xl bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 rounded-xl font-bold active:scale-[0.98]"
              >
                {isProcessing ? '処理中...' : '注文を確定する'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 書類表示モーダル */}
      {showDocuments && (
        <div className="fixed inset-0 bg-black/30 flex items-end z-50">
          <div className="bg-white w-full rounded-t-3xl p-8 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
            <h3 className="text-3xl font-bold mb-2 text-black text-center">注文が完了しました！</h3>
            <p className="text-lg text-gray-600 text-center mb-8">
              以下の書類が発行されました
            </p>
            
            <div className="space-y-4 mb-8">
              {generatedDocuments.map((doc) => {
                const isRestaurantIssued = doc.type === 'purchase_order';
                const issuerLabel = isRestaurantIssued ? '飲食店発行' : '農家発行';
                const issuerStyle = isRestaurantIssued
                  ? 'bg-black text-white'
                  : 'bg-gray-200 text-gray-700';
                const docLabel = doc.type === 'invoice' ? '請求書' : doc.type === 'purchase_order' ? '注文書' : doc.type === 'delivery_note' ? '納品書' : '領収書';
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
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <Button
              onClick={handleCloseDocuments}
              className="w-full h-16 text-xl bg-black text-white hover:bg-gray-800 rounded-xl font-bold active:scale-[0.98]"
            >
              完了
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
    </div>
  );
}
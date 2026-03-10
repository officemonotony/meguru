import { useState } from 'react';
import { Search, ShoppingBag, X, Repeat, Package as PackageIcon, Lock } from 'lucide-react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { ProposalForm, SubscriptionProposal } from '@/app/components/ProposalForm';
import { OneTimeOrderForm } from '@/app/components/OneTimeOrderForm';
import { useData, Product } from '@/app/context/DataContext';
import { RESTAURANT_INFO } from '@/app/context/DataContext';

interface ProductBrowserProps {
  onProposalSubmit: (proposal: Omit<SubscriptionProposal, 'id' | 'status' | 'createdAt'>) => void;
  onDeliveryRequest?: (request: any) => void;
}

export function ProductBrowser({ onProposalSubmit, onDeliveryRequest }: ProductBrowserProps) {
  const { products, getCropRemainingStock } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [showOneTimeOrderForm, setShowOneTimeOrderForm] = useState(false);

  const currentRestaurantId = RESTAURANT_INFO.id;

  const filteredProducts = products.filter((product) => {
    // 非公開商品は除外
    if (product.isPublished === false) return false;
    // 限定公開の場合、自分が対象でなければ除外
    if (product.visibility === 'private' && !product.visibleTo?.includes(currentRestaurantId)) return false;
    // 検索フィルタ
    return product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.farmerName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // 売り切れ判定
  const isProductSoldOut = (product: Product): boolean => {
    // 商品自体の在庫が0
    if (product.stock <= 0) return true;
    // 作物マスターに紐づいている場合、作物の残量が0
    if (product.cropId) {
      const remaining = getCropRemainingStock(product.cropId);
      if (remaining <= 0) return true;
    }
    return false;
  };

  // 商品タップ → アクション選択シートを表示
  const handleProductTap = (product: Product) => {
    setSelectedProduct(product);
    setShowActionSheet(true);
  };

  // 「単発注文」選択 → 単発注文フォームを開く
  const handleOneTimeOrder = () => {
    setShowActionSheet(false);
    setShowOneTimeOrderForm(true);
  };

  // 「継続購入」選択 → 提案フォームを開く
  const handleSubscription = () => {
    setShowActionSheet(false);
    setShowProposalForm(true);
  };

  const handleProposalSubmit = (proposal: Omit<SubscriptionProposal, 'id' | 'status' | 'createdAt'>) => {
    onProposalSubmit(proposal);
    setShowProposalForm(false);
    setSelectedProduct(null);
  };

  const handleOneTimeOrderSubmit = (order: any) => {
    if (onDeliveryRequest) {
      onDeliveryRequest(order);
    }
    setShowOneTimeOrderForm(false);
    setSelectedProduct(null);
  };

  // 空状態
  if (filteredProducts.length === 0 && !searchTerm) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh]">
        <div className="bg-gray-100 rounded-full p-8 mb-6">
          <ShoppingBag className="w-16 h-16 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-600 mb-2">
          商品がまだ登録されていません
        </h3>
        <p className="text-base text-gray-600 text-center max-w-md mb-6">
          農家さんが商品を登録すると、ここに表示されます
        </p>
        <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-5 w-full max-w-sm">
          <p className="text-xs font-bold text-gray-700 mb-3">注文の始め方</p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
              <p className="text-xs text-gray-600 text-left">農家が商品を登録・公開するのを待つ</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
              <p className="text-xs text-gray-600 text-left">商品を選んで「単発注文」または「継続で提案」</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
              <p className="text-xs text-gray-600 text-left">チャットで農家と直接やり取りできます</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-full">
      {/* 検索バー */}
      <div className="bg-white px-4 py-3 border-b border-gray-200 sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="商品名や農園名で検索"
            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-base focus:bg-white focus:ring-2 focus:ring-black focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* メルカリ風 商品グリッド */}
      <div className="grid grid-cols-2 gap-px bg-gray-200">
        {filteredProducts.map((product) => {
            const soldOut = isProductSoldOut(product);
            return (
            <div
              key={product.id}
              className={`bg-white cursor-pointer active:bg-gray-50 transition-colors ${soldOut ? 'opacity-75' : ''}`}
              onClick={() => handleProductTap(product)}
            >
              {/* 商品画像 */}
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {product.imageUrl ? (
                  <ImageWithFallback
                    src={product.imageUrl}
                    alt={product.name}
                    className={`w-full h-full object-cover ${soldOut ? 'grayscale' : ''}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                    <PackageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                {soldOut && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-bold">
                      売り切れ
                    </span>
                  </div>
                )}
                {product.visibility === 'private' && !soldOut && (
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1 bg-black/80 text-white px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm">
                    <Lock className="w-2.5 h-2.5" />
                    あなた専用
                  </div>
                )}
              </div>
              {/* 商品情報 */}
              <div className="p-3">
                <h3 className={`text-sm font-bold line-clamp-1 mb-0.5 ${soldOut ? 'text-gray-400' : 'text-black'}`}>{product.name}</h3>
                <p className="text-xs text-gray-500 mb-1.5">{product.farmerName}</p>
                <p className={`text-base font-bold ${soldOut ? 'text-gray-400' : 'text-black'}`}>
                  {product.price.toLocaleString()}
                  <span className="text-xs text-gray-500 font-normal ml-0.5">円/{product.unit}</span>
                </p>
                {product.seasonStart && product.seasonEnd && (
                  <div className="mt-1 text-xs text-green-700">
                    <span>販売期間: {product.seasonStart.month}月{product.seasonStart.period === 'early' ? '上旬' : product.seasonStart.period === 'mid' ? '中旬' : '下旬'}〜{product.seasonEnd.month}月{product.seasonEnd.period === 'early' ? '上旬' : product.seasonEnd.period === 'mid' ? '中旬' : '下旬'}</span>
                  </div>
                )}
              </div>
            </div>
            );
        })}
      </div>

      {/* 検索結果なし */}
      {filteredProducts.length === 0 && searchTerm && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">「{searchTerm}」に一致する商品がありません</p>
        </div>
      )}

      {/* アクション選択ボトムシート */}
      {showActionSheet && selectedProduct && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => {
            setShowActionSheet(false);
            setSelectedProduct(null);
          }}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 商品プレビュー */}
            <div className="flex items-center gap-4 p-5 border-b border-gray-100">
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                {selectedProduct.imageUrl ? (
                  <ImageWithFallback
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                    <PackageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-black truncate">{selectedProduct.name}</h3>
                <p className="text-sm text-gray-500">{selectedProduct.farmerName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-base font-bold text-black">
                    {selectedProduct.price.toLocaleString()}円
                    <span className="text-xs text-gray-500 font-normal">/{selectedProduct.unit}</span>
                  </p>
                  {selectedProduct.visibility === 'private' && (
                    <span className="inline-flex items-center gap-1 bg-black text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                      <Lock className="w-2.5 h-2.5" />
                      あなた専用
                    </span>
                  )}
                </div>
                {selectedProduct.seasonStart && selectedProduct.seasonEnd && (
                  <div className="mt-1 text-xs text-green-700">
                    <span>販売期間: {selectedProduct.seasonStart.month}月{selectedProduct.seasonStart.period === 'early' ? '上旬' : selectedProduct.seasonStart.period === 'mid' ? '中旬' : '下旬'}〜{selectedProduct.seasonEnd.month}月{selectedProduct.seasonEnd.period === 'early' ? '上旬' : selectedProduct.seasonEnd.period === 'mid' ? '中旬' : '下旬'}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setShowActionSheet(false);
                  setSelectedProduct(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* アクションボタン */}
            <div className="p-5 space-y-3">
              {isProductSoldOut(selectedProduct) ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <PackageIcon className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="text-base font-bold text-gray-700 mb-1">現在売り切れです</p>
                  <p className="text-xs text-gray-500">在庫が補充されるまでお待ちください</p>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleOneTimeOrder}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border-2 border-gray-200 hover:border-black hover:bg-gray-100 transition-all active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-base font-bold text-black">単発注文</div>
                      <div className="text-xs text-gray-500 mt-0.5">今回だけ必要な分を注文</div>
                    </div>
                  </button>

                  <button
                    onClick={handleSubscription}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border-2 border-gray-200 hover:border-black hover:bg-gray-100 transition-all active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
                      <Repeat className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-base font-bold text-black">継続購入を提案</div>
                      <div className="text-xs text-gray-500 mt-0.5">定期的にお届けしてもらう</div>
                    </div>
                  </button>
                </>
              )}
            </div>

            {/* 安全領域 */}
            <div className="h-6" />
          </div>
        </div>
      )}

      {/* 継続提案フォーム */}
      {showProposalForm && selectedProduct && (
        <ProposalForm
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          farmerName={selectedProduct.farmerName}
          farmerId={selectedProduct.farmerId}
          unit={selectedProduct.unit}
          basePrice={selectedProduct.price}
          onClose={() => {
            setShowProposalForm(false);
            setSelectedProduct(null);
          }}
          onSubmit={handleProposalSubmit}
        />
      )}

      {/* 単発注文フォーム */}
      {showOneTimeOrderForm && selectedProduct && (
        <OneTimeOrderForm
          product={selectedProduct}
          onCancel={() => {
            setShowOneTimeOrderForm(false);
            setSelectedProduct(null);
          }}
          onSubmit={handleOneTimeOrderSubmit}
        />
      )}
    </div>
  );
}
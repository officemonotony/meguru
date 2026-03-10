import { useState } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Calendar, ShoppingBag } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useData } from '@/app/context/DataContext';
import { DatePicker } from './DatePicker';

interface Product {
  id: string;
  name: string;
  farmerName: string;
  price: number;
  unit: string;
  stock: number;
  category: string;
  farmerId: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface DeliveryRequest {
  farmerId: string;
  farmerName: string;
  items: CartItem[];
  deliveryDate: string;
  totalAmount: number;
}

interface OneTimeOrderProps {
  onAddToCart?: (item: any) => void;
  onDeliveryRequest?: (request: DeliveryRequest) => void;
}

const categories = ['すべて', '果菜類', '葉菜類', '根菜類'];

export function OneTimeOrder({ onAddToCart, onDeliveryRequest }: OneTimeOrderProps) {
  const { products } = useData();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [dateError, setDateError] = useState(false);

  // DataContextの商品をProductに換
  const convertedProducts: Product[] = products.map(p => ({
    id: p.id,
    name: p.name,
    farmerName: p.farmerName,
    price: p.price,
    unit: p.unit,
    stock: p.stock || 100,
    category: p.category || 'その他',
    farmerId: p.farmerId || 'farmer1',
  }));

  const filteredProducts =
    selectedCategory === 'すべて'
      ? convertedProducts
      : convertedProducts.filter((p) => p.category === selectedCategory);

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    if (onAddToCart) {
      onAddToCart({ product, quantity: 1 });
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(
        cart.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handleCheckout = () => {
    if (!deliveryDate) {
      setDateError(true);
      return;
    }
    if (cart.length === 0) {
      alert('商品をカートに追加してください');
      return;
    }
    
    // 最初の商品から農家情報を取得（全商品が同じ農家のものと仮定）
    const firstProduct = products.find(p => p.id === cart[0].product.id);
    const farmerId = firstProduct?.farmerId || 'farmer1';
    const farmerName = firstProduct?.farmerName || cart[0].product.farmerName;
    
    // 注文処理
    const request: DeliveryRequest = {
      farmerId: farmerId,
      farmerName: farmerName,
      items: cart,
      deliveryDate: deliveryDate,
      totalAmount: Math.floor(getCartTotal() * 1.1),
    };
    
    if (onDeliveryRequest) {
      onDeliveryRequest(request);
    }
    
    // カートをクリア
    setCart([]);
    setDeliveryDate('');
    setShowCart(false);
  };

  // 商品がない場合は空状態を表示
  if (convertedProducts.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh]">
          <div className="bg-gray-100 rounded-full p-8 mb-6">
            <ShoppingBag className="w-16 h-16 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-600 mb-2">
            商品がまだ登録されていません
          </h3>
          <p className="text-base text-gray-600 text-center max-w-md">
            農家さんが商品を登録すると、ここに表示されます
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 -mx-4 -mt-4 mb-4">
        <p className="text-sm text-gray-600">
          今回だけ必要な野菜を注文できます
        </p>
      </div>

      {/* カテゴリフィルター */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap text-sm transition-all ${
              selectedCategory === category
                ? 'bg-black text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* 商品一覧 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {filteredProducts.map((product) => {
          const cartItem = cart.find((item) => item.product.id === product.id);
          const inCart = !!cartItem;

          return (
            <div
              key={product.id}
              className="bg-white border-2 border-gray-300 rounded-xl p-3 hover:shadow-md transition-shadow"
            >
              <div className="mb-3">
                <h3 className="text-base font-bold text-black mb-1 line-clamp-1">{product.name}</h3>
                <div className="text-xs text-gray-600 mb-0.5">{product.farmerName}</div>
                <div className="text-xs text-gray-500">{product.category}</div>
              </div>

              <div className="mb-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-black">
                    ¥{product.price.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-600">/ {product.unit}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  在庫: {product.stock}{product.unit}
                </div>
              </div>

              {inCart ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                    className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-4 h-4 text-gray-700" />
                  </button>
                  <div className="flex-1 text-center">
                    <div className="text-lg font-bold text-black">{cartItem.quantity}</div>
                  </div>
                  <button
                    onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                    className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4 text-gray-700" />
                  </button>
                </div>
              ) : (
                <Button
                  onClick={() => addToCart(product)}
                  className="w-full bg-black text-white hover:bg-gray-800 h-9 text-sm font-bold rounded-lg"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  追加
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* カートボタン（フローティング） */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowCart(!showCart)}
          className="fixed bottom-20 right-4 bg-black text-white hover:bg-gray-800 h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all z-20"
        >
          <div className="relative">
            <ShoppingCart className="w-6 h-6" />
            <div className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
              {getCartItemCount()}
            </div>
          </div>
        </button>
      )}

      {/* カートサイドパネル */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b-2 border-gray-300 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                カート
              </h2>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">カートに商品がありません</p>
                </div>
              ) : (
                <>
                  {/* 配送希望日 */}
                  <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      配送希望日 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <DatePicker
                        value={deliveryDate}
                        onChange={(date) => {
                          setDeliveryDate(date);
                          if (date) setDateError(false);
                        }}
                        minDate={new Date().toISOString().split('T')[0]}
                        placeholder="配送希望日を選択"
                      />
                    </div>
                    {dateError && (
                      <p className="text-xs text-red-600 mt-1">配送希望日を選択してください</p>
                    )}
                  </div>

                  {/* カート内容 */}
                  <div className="space-y-4 mb-6">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-black mb-1">
                              {item.product.name}
                            </h3>
                            <div className="text-sm text-gray-600">
                              {item.product.farmerName}
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5 text-red-600" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity - 1)
                              }
                              className="w-8 h-8 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg flex items-center justify-center"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <div className="w-16 text-center font-bold text-black">
                              {item.quantity}
                              <span className="text-sm text-gray-600 ml-1">
                                {item.product.unit}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity + 1)
                              }
                              className="w-8 h-8 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg flex items-center justify-center"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-xl font-bold text-black">
                            ¥{(item.product.price * item.quantity).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 合計 */}
                  <div className="border-t-2 border-gray-300 pt-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-base text-gray-600">小計</span>
                      <span className="text-xl font-bold text-black">
                        ¥{getCartTotal().toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-base text-gray-600">消費税（10%）</span>
                      <span className="text-xl font-bold text-black">
                        ¥{Math.floor(getCartTotal() * 0.1).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                      <span className="text-lg font-bold text-black">合計</span>
                      <span className="text-3xl font-bold text-black">
                        ¥{Math.floor(getCartTotal() * 1.1).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* 配送依頼ボタン */}
                  <Button
                    onClick={handleCheckout}
                    className="w-full bg-black text-white hover:bg-gray-800 h-14 text-lg font-bold rounded-xl"
                  >
                    配送を依頼する
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
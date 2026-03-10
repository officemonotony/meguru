import { useState } from 'react';
import { Edit, Save } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { toHalfWidth } from '@/app/utils/normalizeNumber';

interface ProductPrice {
  productId: string;
  productName: string;
  basePrice: number;
  customPrices: Record<string, number>; // restaurantId -> price
}

interface Restaurant {
  id: string;
  name: string;
}

// モックデータ
const mockRestaurants: Restaurant[] = [
  { id: 'r1', name: 'あら屋' },
  { id: 'r2', name: '和食処さくら' },
  { id: 'r3', name: 'カフェ緑' },
];

const initialPrices: ProductPrice[] = [
  {
    productId: '1',
    productName: 'トマト',
    basePrice: 800,
    customPrices: { r1: 750, r2: 820 },
  },
  {
    productId: '2',
    productName: 'きゅうり',
    basePrice: 600,
    customPrices: { r1: 580 },
  },
  {
    productId: '3',
    productName: 'レタス',
    basePrice: 500,
    customPrices: {},
  },
];

export function PriceManagement() {
  const [prices, setPrices] = useState<ProductPrice[]>(initialPrices);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [tempPrices, setTempPrices] = useState<Record<string, string>>({});

  const handleEdit = (product: ProductPrice) => {
    setEditingProduct(product.productId);
    const temp: Record<string, string> = {};
    mockRestaurants.forEach((restaurant) => {
      const customPrice = product.customPrices[restaurant.id];
      temp[restaurant.id] = customPrice ? customPrice.toString() : '';
    });
    setTempPrices(temp);
  };

  const handleSave = () => {
    if (!editingProduct) return;

    setPrices((prev) =>
      prev.map((p) => {
        if (p.productId === editingProduct) {
          const customPrices: Record<string, number> = {};
          Object.entries(tempPrices).forEach(([restaurantId, price]) => {
            if (price && Number(price) > 0) {
              customPrices[restaurantId] = Number(price);
            }
          });
          return { ...p, customPrices };
        }
        return p;
      })
    );
    setEditingProduct(null);
    setTempPrices({});
  };

  const handleCancel = () => {
    setEditingProduct(null);
    setTempPrices({});
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2 text-black">価格設定</h2>
      <p className="text-sm text-gray-600 mb-4">
        飲食店ごとに個別の価格を設定できます。未設定の場合は基本価格が適用されます。
      </p>

      <div className="space-y-3">
        {prices.map((product) => (
          <div
            key={product.productId}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-black">{product.productName}</h3>
                <p className="text-sm text-gray-600">
                  基本価格: ¥{product.basePrice.toLocaleString()}/kg
                </p>
              </div>
              {editingProduct !== product.productId && (
                <Button
                  onClick={() => handleEdit(product)}
                  size="sm"
                  variant="outline"
                  className="border-gray-300"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  編集
                </Button>
              )}
            </div>

            {editingProduct === product.productId ? (
              <div className="space-y-3 pt-3 border-t border-gray-200">
                <p className="text-sm font-bold text-gray-700">個別価格設定</p>
                {mockRestaurants.map((restaurant) => (
                  <div key={restaurant.id} className="flex items-center gap-3">
                    <label className="text-sm text-gray-700 flex-1">
                      {restaurant.name}
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">¥</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={tempPrices[restaurant.id] || ''}
                        onChange={(e) => {
                          const val = toHalfWidth(e.target.value);
                          if (val === '' || /^\d+$/.test(val)) {
                            setTempPrices({ ...tempPrices, [restaurant.id]: val });
                          }
                        }}
                        placeholder={product.basePrice.toString()}
                        className="w-24"
                      />
                      <span className="text-sm text-gray-600">/kg</span>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    size="sm"
                    className="flex-1 border-gray-300"
                  >
                    キャンセル
                  </Button>
                  <Button
                    onClick={handleSave}
                    size="sm"
                    className="flex-1 bg-black text-white hover:bg-gray-800"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    保存
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-3 border-t border-gray-200">
                {mockRestaurants.map((restaurant) => {
                  const customPrice = product.customPrices[restaurant.id];
                  return (
                    <div
                      key={restaurant.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">{restaurant.name}</span>
                      <span className={customPrice ? 'text-black font-bold' : 'text-gray-500'}>
                        {customPrice
                          ? `¥${customPrice.toLocaleString()}/kg`
                          : '基本価格を適用'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
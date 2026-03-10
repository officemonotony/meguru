import { useState } from 'react';
import { Plus, Calendar } from 'lucide-react';
interface CartItem { productId: string; name: string; farmerName: string; farmerId?: string; unit: string; price: number; quantity: number; deliveryDate: string; imageUrl?: string }
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  farmerName: string;
  description: string;
  stock: number;
  imageUrl?: string;
}

// モックデータ
const mockProducts: Product[] = [
  { id: '1', name: 'トマト', price: 800, unit: 'kg', farmerName: '龍ノ傘', description: '甘みが強い完熟トマト', stock: 50, imageUrl: 'https://images.unsplash.com/photo-1546470427-e26264be0580?w=400' },
  { id: '2', name: 'きゅうり', price: 600, unit: 'kg', farmerName: '佐藤農園', description: '新鮮な朝採りきゅうり', stock: 30, imageUrl: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=400' },
  { id: '3', name: 'レタス', price: 500, unit: 'kg', farmerName: '龍ノ傘', description: 'シャキシャキのサニーレタス', stock: 40, imageUrl: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=400' },
  { id: '4', name: '人参', price: 400, unit: 'kg', farmerName: '鈴木農園', description: '甘くて栄養豊富な人参', stock: 60, imageUrl: 'https://images.unsplash.com/photo-1606162537842-f80f6b891831?w=400' },
  { id: '5', name: '玉ねぎ', price: 350, unit: 'kg', farmerName: '佐藤農園', description: '辛味が少ない新玉ねぎ', stock: 70, imageUrl: 'https://images.unsplash.com/photo-1589927986089-35812378d7f2?w=400' },
  { id: '6', name: 'じゃがいも', price: 450, unit: 'kg', farmerName: '鈴木農園', description: 'ホクホクの男爵いも', stock: 80, imageUrl: 'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=400' },
  { id: '7', name: 'ほうれん草', price: 700, unit: 'kg', farmerName: '龍ノ傘', description: '鉄分豊富なほうれん草', stock: 25, imageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400' },
  { id: '8', name: '白菜', price: 550, unit: 'kg', farmerName: '佐藤農園', description: '甘みのある白菜', stock: 35, imageUrl: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400' },
];

interface ProductListProps {
  onAddToCart: (item: Omit<CartItem, 'quantity'>) => void;
}

export function ProductList({ onAddToCart }: ProductListProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deliveryDate, setDeliveryDate] = useState('');

  // 商品選択時に当日の日付をセット
  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    const today = new Date();
    setDeliveryDate(today.toISOString().split('T')[0]);
  };

  const handleAddToCart = () => {
    if (!selectedProduct || !deliveryDate) return;

    onAddToCart({
      productId: selectedProduct.id,
      name: selectedProduct.name,
      price: selectedProduct.price,
      unit: selectedProduct.unit,
      deliveryDate,
      farmerName: selectedProduct.farmerName,
    });

    setSelectedProduct(null);
    setDeliveryDate('');
  };

  return (
    <div className="p-4 pb-24">
      <h2 className="text-2xl font-bold mb-6 text-black">食材を選ぶ</h2>
      <div className="space-y-4">
        {mockProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => handleProductSelect(product)}
            className="w-full bg-white border-2 border-gray-300 rounded-2xl p-6 hover:border-black transition-all active:scale-[0.98]"
          >
            <div className="flex gap-4 items-center">
              {product.imageUrl && (
                <ImageWithFallback
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-28 h-28 rounded-xl object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 text-left">
                <h3 className="text-2xl font-bold text-black mb-1">{product.name}</h3>
                <p className="text-base text-gray-600 mb-2">{product.farmerName}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-black">¥{product.price.toLocaleString()}</span>
                  <span className="text-lg text-gray-600">/{product.unit}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
              <span className="text-base text-gray-600">在庫 {product.stock}kg</span>
              <div className="flex items-center gap-2 text-black font-bold">
                <Plus className="w-6 h-6" />
                <span className="text-lg">選択</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 納品日選択モーダル */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/30 flex items-end z-50" onClick={() => { setSelectedProduct(null); setDeliveryDate(''); }}>
          <div className="bg-white w-full rounded-t-3xl p-8 animate-slide-up shadow-2xl h-[65vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6">
              {selectedProduct.imageUrl && (
                <ImageWithFallback
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="w-24 h-24 rounded-xl object-cover mx-auto mb-4"
                />
              )}
              <h3 className="text-3xl font-bold text-center text-black mb-2">
                {selectedProduct.name}
              </h3>
              <p className="text-xl text-center text-gray-600 mb-1">{selectedProduct.farmerName}</p>
              <div className="text-center">
                <span className="text-4xl font-bold text-black">¥{selectedProduct.price.toLocaleString()}</span>
                <span className="text-xl text-gray-600">/{selectedProduct.unit}</span>
              </div>
            </div>
            
            <div className="mb-8">
              <label className="block text-xl font-bold mb-4 text-black">
                <Calendar className="w-6 h-6 inline mr-2" />
                納品希望日
              </label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full text-xl p-6 rounded-xl border-2 border-gray-300 focus:border-black"
              />
            </div>
            
            <div className="flex gap-4">
              <Button
                onClick={() => {
                  setSelectedProduct(null);
                  setDeliveryDate('');
                }}
                variant="outline"
                className="flex-1 h-16 text-xl border-2 border-gray-300 rounded-xl hover:bg-gray-100"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleAddToCart}
                disabled={!deliveryDate}
                className="flex-1 h-16 text-xl bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 rounded-xl font-bold"
              >
                カートに追加
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
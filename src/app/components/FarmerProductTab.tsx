import { useState } from 'react';
import { Sprout, Package } from 'lucide-react';
import { ProductManagement } from '@/app/components/ProductManagement';
import { CropManagement } from '@/app/components/CropManagement';

type Tab = 'crops' | 'products';

export function FarmerProductTab() {
  const [activeTab, setActiveTab] = useState<Tab>('crops');
  const [initialCropId, setInitialCropId] = useState<string | null>(null);

  const handleNavigateToProducts = (cropId: string) => {
    setInitialCropId(cropId);
    setActiveTab('products');
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* タブヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6">
        <div className="flex gap-0">
          <button
            onClick={() => setActiveTab('crops')}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'crops'
                ? 'border-black text-black'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Sprout className="w-4 h-4" />
            収穫
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'products'
                ? 'border-black text-black'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Package className="w-4 h-4" />
            商品
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1">
        {activeTab === 'crops' && (
          <CropManagement onNavigateToProducts={handleNavigateToProducts} />
        )}
        {activeTab === 'products' && (
          <ProductManagement
            initialCropId={initialCropId}
            onInitialCropHandled={() => setInitialCropId(null)}
          />
        )}
      </div>
    </div>
  );
}

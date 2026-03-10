import { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Trash2, Camera, Package, Eye, EyeOff, Calendar, Lock, Sprout, Copy, ChevronRight, ChevronLeft, AlertCircle, ArrowDown } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { ImageGallery } from '@/app/components/ImageGallery';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { useData, Product } from '@/app/context/DataContext';
import { REGISTERED_RESTAURANTS } from '@/app/context/DataContext';
import { toast } from 'sonner';
import { toHalfWidth } from '@/app/utils/normalizeNumber';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const PERIOD_OPTIONS = [
  { value: 'early', label: '上旬' },
  { value: 'mid', label: '中旬' },
  { value: 'late', label: '下旬' },
] as const;

const ALL_UNITS = ['kg', 'g', '個', '本', '束', '袋', '株', '玉', '把', '箱', 'パック', '枚', 'L'];

// 単位変換ヘルパー（kg↔g, L↔mL 対応）
const UNIT_CONVERSIONS: Record<string, { subUnit: string; factor: number }> = {
  kg: { subUnit: 'g', factor: 1000 },
  L: { subUnit: 'mL', factor: 1000 },
};

const formatSeasonPeriod = (month: number, period: 'early' | 'mid' | 'late') => {
  const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || '';
  return `${month}月${periodLabel}`;
};

const formatSeasonRange = (product: Product) => {
  if (!product.seasonStart || !product.seasonEnd) return null;
  return `${formatSeasonPeriod(product.seasonStart.month, product.seasonStart.period)}〜${formatSeasonPeriod(product.seasonEnd.month, product.seasonEnd.period)}`;
};

export interface ProductManagementProps {
  initialCropId?: string | null;
  onInitialCropHandled?: () => void;
}

export function ProductManagement({ initialCropId, onInitialCropHandled }: ProductManagementProps) {
  const { products, addProduct, updateProduct, deleteProduct, crops, getCropRemainingStock } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [showConfirmPublish, setShowConfirmPublish] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [justPublishedId, setJustPublishedId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'public' | 'private' | 'unpublished'>('public');
  const [unpublishTarget, setUnpublishTarget] = useState<Product | null>(null);

  // D: 2ステップウィザード
  const [formStep, setFormStep] = useState<1 | 2>(1);

  // F: バリデーション用のtouched状態
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    basePrice: '',
    unit: 'kg',
    stock: '',
    imageUrl: '',
    visibility: 'public' as 'public' | 'private',
    visibleTo: [] as string[],
    hasSeason: false,
    seasonStart: { month: 1, period: 'early' } as { month: number, period: 'early' | 'mid' | 'late' },
    seasonEnd: { month: 12, period: 'late' } as { month: number, period: 'early' | 'mid' | 'late' },
    cropId: '' as string,
    quantityPerUnit: '1',
  });

  // 自動入力の詳細メッセージ（課題3）
  const [autoFillDetails, setAutoFillDetails] = useState<string | null>(null);

  // 外部からの作物ID指定で自動的にフォームを開く（課題1）
  useEffect(() => {
    if (initialCropId && crops.length > 0) {
      const crop = crops.find(c => c.id === initialCropId);
      if (crop) {
        setIsAdding(true);
        setEditingProduct(null);
        setFormStep(1);
        setTouched({});
        const remaining = getCropRemainingStock(initialCropId);
        setFormData({
          name: crop.name,
          description: '',
          basePrice: '',
          unit: crop.unit,
          stock: String(remaining),
          imageUrl: crop.imageUrl || '',
          visibility: 'public',
          visibleTo: [],
          hasSeason: false,
          seasonStart: { month: 1, period: 'early' },
          seasonEnd: { month: 12, period: 'late' },
          cropId: initialCropId,
          quantityPerUnit: '1',
        });
        setAutoFillDetails(`商品名を「${crop.name}」、在庫を${remaining}${crop.unit}に設定しました`);
      }
      onInitialCropHandled?.();
    }
  }, [initialCropId]);

  // C: 最近使った単位を既存商品から抽出
  const recentUnits = useMemo(() => {
    const unitCounts: Record<string, number> = {};
    products.forEach(p => {
      unitCounts[p.unit] = (unitCounts[p.unit] || 0) + 1;
    });
    return Object.entries(unitCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([unit]) => unit);
  }, [products]);

  // C: スマート単位リスト（最近使った単位を上位に）
  const smartUnits = useMemo(() => {
    const rest = ALL_UNITS.filter(u => !recentUnits.includes(u));
    return { recent: recentUnits, rest };
  }, [recentUnits]);

  // G: 同じ作物に紐づく既存商品の価格帯を計算
  const priceReference = useMemo(() => {
    if (!formData.cropId) return null;
    const sameProducts = products.filter(p =>
      p.cropId === formData.cropId && p.id !== editingProduct?.id
    );
    if (sameProducts.length === 0) return null;
    const prices = sameProducts.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const units = [...new Set(sameProducts.map(p => p.unit))];
    return { min, max, count: sameProducts.length, units };
  }, [formData.cropId, products, editingProduct]);

  // 課題8: 同じ作物に紐づく既存商品数
  const existingCropProductCount = useMemo(() => {
    if (!formData.cropId) return 0;
    return products.filter(p => p.cropId === formData.cropId && p.id !== editingProduct?.id).length;
  }, [formData.cropId, products, editingProduct]);

  // 課題5: 配分超過チェック（フッターガイド用）
  const allocationExceeded = useMemo(() => {
    if (!formData.cropId) return false;
    const crop = crops.find(c => c.id === formData.cropId);
    if (!crop) return false;
    const remaining = getCropRemainingStock(formData.cropId);
    const stockNum = Number(formData.stock) || 0;
    const qpu = Number(formData.quantityPerUnit) || 1;
    const currentAllocation = editingProduct?.cropId === formData.cropId
      ? editingProduct.stock * (editingProduct.quantityPerUnit || 1)
      : 0;
    const newAllocation = stockNum * qpu;
    return newAllocation > remaining + currentAllocation;
  }, [formData.cropId, formData.stock, formData.quantityPerUnit, crops, getCropRemainingStock, editingProduct]);

  // F: バリデーションエラー
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!formData.name) errors.name = '商品名を入力してください';
    if (!formData.basePrice) errors.basePrice = '価格を入力してください';
    if (!formData.stock) errors.stock = '在庫数を入力してください';
    if (formData.visibility === 'private' && formData.visibleTo.length === 0) {
      errors.visibleTo = '少なくとも1つの飲食店を選択してください';
    }
    return errors;
  }, [formData]);

  // ステップ1のバリデーション
  const isStep1Valid = !validationErrors.name && !validationErrors.basePrice && !validationErrors.stock;

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      basePrice: '',
      unit: 'kg',
      stock: '',
      imageUrl: '',
      visibility: 'public',
      visibleTo: [],
      hasSeason: false,
      seasonStart: { month: 1, period: 'early' },
      seasonEnd: { month: 12, period: 'late' },
      cropId: '',
      quantityPerUnit: '1',
    });
    setIsAdding(false);
    setEditingProduct(null);
    setFormStep(1);
    setTouched({});
    setAutoFillDetails(null);
  };

  // A: 作物マスター選択時の自動入力
  const handleCropSelect = useCallback((cropId: string) => {
    if (!cropId) {
      setFormData(prev => ({ ...prev, cropId: '' }));
      return;
    }
    const crop = crops.find(c => c.id === cropId);
    if (!crop) return;
    const remaining = getCropRemainingStock(cropId);

    setFormData(prev => {
      const isNew = !editingProduct;
      const filledFields: string[] = [];
      const newName = isNew && !prev.name ? crop.name : prev.name;
      const newUnit = isNew && prev.unit === 'kg' ? crop.unit : prev.unit;
      const newStock = isNew && !prev.stock ? String(remaining) : prev.stock;
      const newImageUrl = isNew && !prev.imageUrl && crop.imageUrl ? crop.imageUrl : prev.imageUrl;

      if (newName !== prev.name) filledFields.push(`商品名を「${crop.name}」`);
      if (newUnit !== prev.unit) filledFields.push(`単位を${crop.unit}`);
      if (newStock !== prev.stock) filledFields.push(`在庫を${remaining}${crop.unit}`);
      if (newImageUrl !== prev.imageUrl) filledFields.push('画像');

      if (filledFields.length > 0) {
        setAutoFillDetails(`${filledFields.join('、')}に設定しました`);
      } else {
        setAutoFillDetails(null);
      }

      return {
        ...prev,
        cropId,
        name: newName,
        unit: newUnit,
        stock: newStock,
        imageUrl: newImageUrl,
      };
    });
  }, [crops, getCropRemainingStock, editingProduct]);

  const handleSubmit = () => {
    if (Object.keys(validationErrors).length > 0) return;

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name: formData.name,
        description: formData.description,
        price: Number(formData.basePrice),
        unit: formData.unit,
        stock: Number(formData.stock),
        imageUrl: formData.imageUrl,
        visibility: formData.visibility,
        visibleTo: formData.visibleTo,
        seasonStart: formData.hasSeason ? formData.seasonStart : undefined,
        seasonEnd: formData.hasSeason ? formData.seasonEnd : undefined,
        cropId: formData.cropId || undefined,
        quantityPerUnit: formData.cropId ? Number(formData.quantityPerUnit) || 1 : undefined,
      });
      resetForm();
    } else {
      const newProduct: Product = {
        category: (formData as any).category || '野菜',
        isAvailable: true,
        id: `product-${Date.now()}`,
        name: formData.name,
        farmerId: 'farmer1',
        farmerName: '龍ノ傘',
        description: formData.description,
        price: Number(formData.basePrice),
        unit: formData.unit,
        stock: Number(formData.stock),
        imageUrl: formData.imageUrl,
        isPublished: true,
        createdAt: new Date().toISOString(),
        visibility: formData.visibility,
        visibleTo: formData.visibleTo,
        seasonStart: formData.hasSeason ? formData.seasonStart : undefined,
        seasonEnd: formData.hasSeason ? formData.seasonEnd : undefined,
        cropId: formData.cropId || undefined,
        quantityPerUnit: formData.cropId ? Number(formData.quantityPerUnit) || 1 : undefined,
      };
      setPendingProduct(newProduct);
      setShowConfirmPublish(true);
    }
  };

  const handleConfirmPublish = () => {
    if (pendingProduct) {
      addProduct(pendingProduct);
      setJustPublishedId(pendingProduct.id);
      setTimeout(() => setJustPublishedId(null), 3000);
      setPendingProduct(null);
      setShowConfirmPublish(false);
      resetForm();
      toast.success('商品を公開しました');
    }
  };

  const handleCancelPublish = () => {
    setPendingProduct(null);
    setShowConfirmPublish(false);
  };

  const handleTogglePublish = (product: Product) => {
    updateProduct(product.id, { isPublished: !product.isPublished });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      basePrice: product.price.toString(),
      unit: product.unit,
      stock: product.stock.toString(),
      imageUrl: product.imageUrl || '',
      visibility: product.visibility || 'public',
      visibleTo: product.visibleTo || [],
      hasSeason: !!product.seasonStart && !!product.seasonEnd,
      seasonStart: product.seasonStart || { month: 1, period: 'early' },
      seasonEnd: product.seasonEnd || { month: 12, period: 'late' },
      cropId: product.cropId || '',
      quantityPerUnit: (product.quantityPerUnit || 1).toString(),
    });
    setFormStep(1);
    setTouched({});
    setAutoFillDetails(null);
    setIsAdding(true);
  };

  // E: 複製ハンドラ
  const handleDuplicate = (product: Product) => {
    setEditingProduct(null);
    setFormData({
      name: `${product.name}（コピー）`,
      description: product.description || '',
      basePrice: product.price.toString(),
      unit: product.unit,
      stock: product.stock.toString(),
      imageUrl: product.imageUrl || '',
      visibility: product.visibility || 'public',
      visibleTo: product.visibleTo || [],
      hasSeason: !!product.seasonStart && !!product.seasonEnd,
      seasonStart: product.seasonStart || { month: 1, period: 'early' },
      seasonEnd: product.seasonEnd || { month: 12, period: 'late' },
      cropId: product.cropId || '',
      quantityPerUnit: (product.quantityPerUnit || 1).toString(),
    });
    setFormStep(1);
    setTouched({});
    setAutoFillDetails(null);
    setIsAdding(true);
    toast('商品をコピーしました', {
      description: '内容を確認して登録してください',
      style: { background: '#000', color: '#fff' },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('この商品を削除しますか?')) {
      deleteProduct(id);
    }
  };

  const handleCancel = () => {
    resetForm();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  const unpublishedCount = products.filter(p => p.isPublished === false).length;

  // F: 送信ボタン近くのガイドメッセージ
  const getSubmitGuide = (): { text: string; type: 'error' | 'warning' } | null => {
    if (formStep === 1) {
      if (validationErrors.name) return { text: '商品名を入力してください', type: 'error' };
      if (validationErrors.basePrice) return { text: '価格を入力してください', type: 'error' };
      if (validationErrors.stock) return { text: '在庫数を入力してください', type: 'error' };
      // 課題5: 配分超過の警告（登録はブロックしない）
      if (allocationExceeded) return { text: '作物の残量を超えていますが、そのまま登録できます', type: 'warning' };
      return null;
    }
    if (validationErrors.visibleTo) return { text: '公開先の飲食店を選択してください', type: 'error' };
    return null;
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-black">うちの商品</h2>
        <Button
          onClick={() => setIsAdding(true)}
          className="bg-black text-white hover:bg-gray-800 h-10 px-4 text-sm rounded-xl active:scale-95"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          新規登録
        </Button>
      </div>

      {/* 公開状況サマリー */}
      {products.length > 0 && (
        <div className="flex border-b border-gray-200 mb-4">
          {[
            { key: 'public' as const, label: '全体公開', count: products.filter(p => p.isPublished !== false && p.visibility !== 'private').length },
            { key: 'private' as const, label: '限定公開', count: products.filter(p => p.isPublished !== false && p.visibility === 'private').length },
            { key: 'unpublished' as const, label: '非公開', count: unpublishedCount },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
                filterTab === tab.key
                  ? 'text-black'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
              <span className="ml-1">{tab.count}</span>
              {filterTab === tab.key && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-black" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh]">
            <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <Package className="w-16 h-16 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-600 mb-2">商品がまだありません</h3>
            <p className="text-base text-gray-600 text-center mb-6 px-4">
              右上の「新規登録」ボタンから<br />最初の商品を登録しましょう
            </p>
            <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-5 w-full max-w-sm">
              <p className="text-xs font-bold text-gray-700 mb-3">商品登録のポイント</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-gray-600 text-left">「収穫」タブで作物を先に登録しておくと、在庫が自動連動します</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-gray-600 text-left">商品名・価格・単位を設定して公開すると飲食店に表示されます</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-gray-600 text-left">特定の飲食店だけに見せる「限定公開」も設定できます</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          products.filter(product => {
            const isPublished = product.isPublished !== false;
            if (filterTab === 'public') return isPublished && product.visibility !== 'private';
            if (filterTab === 'private') return isPublished && product.visibility === 'private';
            if (filterTab === 'unpublished') return !isPublished;
            return true;
          }).map((product) => {
            const isPublished = product.isPublished !== false;
            const isJustPublished = justPublishedId === product.id;

            return (
              <div
                key={product.id}
                onClick={() => handleEdit(product)}
                className={`bg-white border-2 rounded-2xl overflow-hidden transition-all duration-500 cursor-pointer active:scale-[0.98] ${
                  isJustPublished
                    ? 'border-green-400 ring-2 ring-green-200'
                    : isPublished
                    ? 'border-gray-300'
                    : 'border-gray-200 opacity-70'
                }`}
              >
                {/* 商品画像 + コンテンツ */}
                <div className="flex">
                  {/* サムネイル画像 */}
                  {product.imageUrl ? (
                    <div className="w-28 min-h-[7rem] flex-shrink-0 bg-gray-100">
                      <ImageWithFallback
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-28 min-h-[7rem] flex-shrink-0 bg-gray-100 flex items-center justify-center">
                      <Package className="w-10 h-10 text-gray-300" />
                    </div>
                  )}

                  {/* 右側コンテンツ */}
                  <div className="flex-1 p-3 pl-4 min-w-0 flex flex-col justify-between">
                    {/* 上段: ステータスバッジ + アクション */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {isPublished && product.visibility === 'private' ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setUnpublishTarget(product); }}
                              className="inline-flex items-center gap-1.5 bg-gray-800 text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold hover:bg-gray-700 active:scale-95 transition-all"
                              type="button"
                            >
                              <Lock className="w-3 h-3" />
                              限定公開中
                            </button>
                          ) : isPublished ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); setUnpublishTarget(product); }}
                              className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold hover:bg-green-200 active:scale-95 transition-all"
                              type="button"
                            >
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                              公開中
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleTogglePublish(product); }}
                              className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 px-2.5 py-0.5 rounded-full text-[11px] font-bold hover:bg-gray-200 active:scale-95 transition-all"
                              type="button"
                              title="タップで公開する"
                            >
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                              非公開
                            </button>
                          )}
                          {isJustPublished && (
                            <span className="text-[11px] text-green-600 font-bold animate-pulse">
                              公開されました
                            </span>
                          )}
                        </div>
                        {/* E: 複製 + 削除ボタン */}
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(product); }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
                            type="button"
                            title="この商品を複製"
                          >
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors active:scale-95 -mr-1"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </div>

                      {/* 商品名 */}
                      <h3 className="text-base font-bold text-black leading-snug truncate">{product.name}</h3>

                      {/* 価格・在庫 */}
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-sm font-bold text-black">
                          {product.price.toLocaleString()}円
                        </span>
                        <span className="text-xs text-gray-400">/{product.unit}</span>
                        <span className="text-gray-300 mx-1">·</span>
                        <span className="text-xs text-gray-500">
                          残 <span className="font-bold text-black">{product.stock}</span>{product.unit}
                        </span>
                      </div>
                    </div>

                    {/* 下段: メタ情報 */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-gray-100">
                      {formatSeasonRange(product) && (
                        <div className="text-[11px] text-green-700">
                          <span>販売期間: {formatSeasonRange(product)}</span>
                        </div>
                      )}
                      {product.createdAt && (
                        <div className="flex items-center gap-1 text-[11px] text-gray-400">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          <span>{formatDate(product.createdAt)}</span>
                        </div>
                      )}
                      {product.visibility === 'private' && product.visibleTo && product.visibleTo.length > 0 && (
                        <span className="text-[11px] text-gray-400 truncate">
                          {REGISTERED_RESTAURANTS.filter(r => product.visibleTo!.includes(r.id)).map(r => r.name).join('・')}
                        </span>
                      )}
                      {product.cropId && (() => {
                        const linkedCrop = crops.find(c => c.id === product.cropId);
                        return linkedCrop ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-green-700">
                            <Sprout className="w-3 h-3" />
                            {linkedCrop.name}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 登録・編集モーダル（D: 2ステップウィザード） */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/30 flex items-end z-50 animate-fade-in" onClick={handleCancel}>
          <div className="bg-white w-full rounded-t-2xl animate-slide-up h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* ヘッダー + 進捗 */}
            <div className="px-6 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg text-black">
                  {editingProduct ? '商品を編集' : '新規商品登録'}
                </h3>
                <span className="text-xs text-gray-400">
                  ステップ {formStep} / 2
                </span>
              </div>
              {/* D: 進捗バー */}
              <div className="flex gap-2">
                <div className={`flex-1 h-1 rounded-full transition-colors ${formStep >= 1 ? 'bg-black' : 'bg-gray-200'}`} />
                <div className={`flex-1 h-1 rounded-full transition-colors ${formStep >= 2 ? 'bg-black' : 'bg-gray-200'}`} />
              </div>
            </div>

            {/* スクロールコンテンツ */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {formStep === 1 ? (
                <div className="space-y-5">
                  {/* B: ヒーロー画像エリア */}
                  <button
                    type="button"
                    onClick={() => setShowImageGallery(true)}
                    className="w-full aspect-[2/1] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-2 overflow-hidden hover:border-gray-400 active:scale-[0.99] transition-all relative"
                  >
                    {formData.imageUrl ? (
                      <>
                        <ImageWithFallback
                          src={formData.imageUrl}
                          alt="商品画像"
                          className="w-full h-full object-cover absolute inset-0"
                        />
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="relative z-10 bg-white/90 rounded-full px-4 py-2 flex items-center gap-2">
                          <Camera className="w-4 h-4 text-gray-700" />
                          <span className="text-sm font-bold text-gray-700">画像を変更</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center">
                          <Camera className="w-7 h-7 text-gray-400" />
                        </div>
                        <span className="text-sm text-gray-400">タップして画像を選択</span>
                      </>
                    )}
                  </button>

                  {/* A: 紐づける作物（課題6: 用語改善） */}
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700">
                      <Sprout className="w-4 h-4 inline mr-1.5 text-green-600" />
                      紐づける作物
                    </label>
                    {crops.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => { handleCropSelect(''); setAutoFillDetails(null); }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                            !formData.cropId
                              ? 'border-black bg-gray-50 font-bold text-black'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          <Package className="w-4 h-4 flex-shrink-0" />
                          紐づけなし
                        </button>
                        {crops.map(crop => {
                          const remaining = getCropRemainingStock(crop.id);
                          const linkedProductCount = products.filter(p => p.cropId === crop.id && p.id !== editingProduct?.id).length;
                          const isSelected = formData.cropId === crop.id;
                          return (
                            <button
                              key={crop.id}
                              type="button"
                              onClick={() => handleCropSelect(crop.id)}
                              className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                                isSelected
                                  ? 'border-black bg-green-50 font-bold text-black'
                                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {/* 課題4: 作物画像サムネイル */}
                                {crop.imageUrl ? (
                                  <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                                    <ImageWithFallback src={crop.imageUrl} alt="" className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <Sprout className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-green-600' : 'text-gray-400'}`} />
                                )}
                                <span className="truncate">{crop.name}</span>
                              </div>
                              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                                {linkedProductCount > 0 && (
                                  <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                                    {linkedProductCount}商品
                                  </span>
                                )}
                                <span className={`text-xs ${remaining <= 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                  残{remaining}{crop.unit}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
                        <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <Sprout className="w-5 h-5 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-500 font-medium">作物がまだ登録されていません</p>
                          <p className="text-xs text-gray-400 mt-0.5">「在庫」タブから作物を登録すると、ここで紐づけできます</p>
                        </div>
                      </div>
                    )}
                    {/* 課題3: 具体的な自動入力メッセージ */}
                    {!editingProduct && formData.cropId && autoFillDetails && (
                      <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                        <Sprout className="w-3 h-3" />
                        {autoFillDetails}
                      </p>
                    )}
                    {/* 課題8: 同じ作物から複数商品の警告 */}
                    {!editingProduct && formData.cropId && existingCropProductCount > 0 && (
                      <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        この作物には既に{existingCropProductCount}件の商品があります。商品名を変更してください
                      </p>
                    )}
                  </div>

                  {/* 商品名 */}
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700">
                      商品名 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      onBlur={() => handleBlur('name')}
                      placeholder="例: トマト"
                      className={touched.name && validationErrors.name ? 'border-red-400 focus:ring-red-300' : ''}
                    />
                    {touched.name && validationErrors.name && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {validationErrors.name}
                      </p>
                    )}
                  </div>

                  {/* 価格 + 単位 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold mb-2 text-gray-700">
                        基本価格 <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={formData.basePrice}
                          onChange={(e) => {
                            const val = toHalfWidth(e.target.value);
                            if (val === '' || /^\d+$/.test(val)) {
                              setFormData({ ...formData, basePrice: val });
                            }
                          }}
                          onBlur={() => handleBlur('basePrice')}
                          placeholder="金額"
                          className={`flex-1 min-w-0 h-9 rounded-md border px-3 py-1 text-base outline-none focus:ring-2 ${
                            touched.basePrice && validationErrors.basePrice
                              ? 'border-red-400 focus:ring-red-300'
                              : 'border-gray-300 focus:ring-gray-400 focus:border-gray-400'
                          }`}
                        />
                        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">円/</span>
                      </div>
                      {touched.basePrice && validationErrors.basePrice && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {validationErrors.basePrice}
                        </p>
                      )}
                    </div>
                    <div>
                      {/* C: スマート単位選択 */}
                      <label className="block text-sm font-bold mb-2 text-gray-700">単位</label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
                      >
                        {smartUnits.recent.length > 0 && (
                          <optgroup label="よく使う単位">
                            {smartUnits.recent.map(unit => (
                              <option key={`recent-${unit}`} value={unit}>{unit}</option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label={smartUnits.recent.length > 0 ? 'その他' : 'すべての単位'}>
                          {smartUnits.rest.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* G: 価格参考情報 */}
                  {priceReference && (
                    <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-600">
                      <Package className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                      <span>
                        同じ作物の商品: ¥{priceReference.min.toLocaleString()}
                        {priceReference.min !== priceReference.max && `〜¥${priceReference.max.toLocaleString()}`}
                        /{priceReference.units.join('・')}
                        <span className="text-gray-400 ml-1">（{priceReference.count}商品）</span>
                      </span>
                    </div>
                  )}

                  {/* 在庫数 */}
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700">
                      在庫数 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.stock}
                        onChange={(e) => {
                          const val = toHalfWidth(e.target.value);
                          if (val === '' || /^\d+$/.test(val)) {
                            setFormData({ ...formData, stock: val });
                          }
                        }}
                        onBlur={() => handleBlur('stock')}
                        placeholder="数量"
                        className={`flex-1 min-w-0 h-9 rounded-md border px-3 py-1 text-base outline-none focus:ring-2 ${
                          touched.stock && validationErrors.stock
                            ? 'border-red-400 focus:ring-red-300'
                            : 'border-gray-300 focus:ring-gray-400 focus:border-gray-400'
                        }`}
                      />
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{formData.unit}</span>
                    </div>
                    {touched.stock && validationErrors.stock && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {validationErrors.stock}
                      </p>
                    )}
                  </div>

                  {/* 作物紐づけ時の小分け設定・消費量詳細 */}
                  {formData.cropId && (() => {
                    const selectedCrop = crops.find(c => c.id === formData.cropId);
                    if (!selectedCrop) return null;
                    const remaining = getCropRemainingStock(formData.cropId);
                    const stockNum = Number(formData.stock) || 0;
                    const qpu = Number(formData.quantityPerUnit) || 1;
                    const currentAllocation = editingProduct?.cropId === formData.cropId
                      ? editingProduct.stock * (editingProduct.quantityPerUnit || 1)
                      : 0;
                    const newAllocation = stockNum * qpu;
                    const adjustedRemaining = remaining + currentAllocation;
                    const wouldExceed = newAllocation > adjustedRemaining;

                    // 商品単位と作物単位が異なる場合 = 小分け販売パターン
                    const isDifferentUnit = formData.unit !== selectedCrop.unit;
                    const conversion = UNIT_CONVERSIONS[selectedCrop.unit];
                    // kg→g等の変換が可能かどうか
                    const hasSubUnitConversion = conversion && isDifferentUnit;
                    // 最大作成可能数
                    const maxItems = qpu > 0 ? Math.floor(adjustedRemaining / qpu) : 0;

                    return (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                        {isDifferentUnit ? (
                          <>
                            {/* 小分け販売ヘッダー */}
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
                                <ArrowDown className="w-3.5 h-3.5 text-white" />
                              </div>
                              <span className="text-sm font-bold text-black">小分け設定</span>
                              <span className="text-[11px] text-gray-400">
                                {selectedCrop.unit}→{formData.unit}
                              </span>
                            </div>

                            {/* 内容量入力 */}
                            <div>
                              <label className="block text-xs font-medium mb-1.5 text-gray-600">
                                1{formData.unit}あたりの内容量
                              </label>
                              {hasSubUnitConversion ? (
                                // kg→g などサブ単位で入力可能
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={
                                      // quantityPerUnit(kg) を g表示に変換
                                      formData.quantityPerUnit
                                        ? String(Math.round(Number(formData.quantityPerUnit) * conversion.factor * 100) / 100)
                                        : ''
                                    }
                                    onChange={(e) => {
                                      const val = toHalfWidth(e.target.value);
                                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        // g→kgに変換して保存
                                        const inBase = val ? String(Number(val) / conversion.factor) : '';
                                        setFormData({ ...formData, quantityPerUnit: inBase || '0' });
                                      }
                                    }}
                                    placeholder={`例: 500`}
                                    className="flex-1 min-w-0 h-10 rounded-lg border border-gray-300 px-3 text-base outline-none focus:ring-2 focus:ring-gray-400"
                                  />
                                  <span className="text-sm font-bold text-gray-700 whitespace-nowrap w-8">{conversion.subUnit}</span>
                                </div>
                              ) : (
                                // 変換なし（個→袋 等）: 作物単位で直接入力
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={formData.quantityPerUnit}
                                    onChange={(e) => {
                                      const val = toHalfWidth(e.target.value);
                                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        setFormData({ ...formData, quantityPerUnit: val });
                                      }
                                    }}
                                    placeholder="数量"
                                    className="flex-1 min-w-0 h-10 rounded-lg border border-gray-300 px-3 text-base outline-none focus:ring-2 focus:ring-gray-400"
                                  />
                                  <span className="text-sm font-bold text-gray-700 whitespace-nowrap w-8">{selectedCrop.unit}</span>
                                </div>
                              )}
                            </div>

                            {/* 自動計算サマリー */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-500">作物の残量</span>
                                <span className={`text-sm font-bold ${wouldExceed ? 'text-red-600' : 'text-black'}`}>
                                  {adjustedRemaining}{selectedCrop.unit}
                                </span>
                              </div>
                              {qpu > 0 && (
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-500">最大つくれる数</span>
                                  <span className="text-sm font-bold text-black">
                                    {maxItems}{formData.unit}
                                  </span>
                                </div>
                              )}
                              {/* 在庫に反映ボタン */}
                              {qpu > 0 && maxItems > 0 && stockNum !== maxItems && (
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, stock: String(maxItems) })}
                                  className="w-full mt-1 py-2 text-xs font-bold text-black bg-gray-100 rounded-lg hover:bg-gray-200 active:scale-[0.98] transition-all"
                                >
                                  在庫を {maxItems}{formData.unit} に設定する
                                </button>
                              )}
                            </div>

                            {/* 変換の要約 */}
                            {qpu > 0 && stockNum > 0 && (
                              <div className={`flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg ${
                                wouldExceed ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                              }`}>
                                <Sprout className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <span>
                                  {adjustedRemaining}{selectedCrop.unit} → {stockNum}{formData.unit}
                                  （1{formData.unit} = {hasSubUnitConversion
                                    ? `${Math.round(qpu * conversion.factor)}${conversion.subUnit}`
                                    : `${qpu}${selectedCrop.unit}`
                                  }）
                                  で合計 {newAllocation}{selectedCrop.unit} を使用
                                  {wouldExceed && '（残量を超えています）'}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          /* 同じ単位の場合: 従来のシンプルUI */
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium mb-1 text-gray-500">
                                  1{formData.unit}あたりの消費量
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={formData.quantityPerUnit}
                                    onChange={(e) => {
                                      const val = toHalfWidth(e.target.value);
                                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                        setFormData({ ...formData, quantityPerUnit: val });
                                      }
                                    }}
                                    className="flex-1 min-w-0 h-9 rounded-md border border-gray-300 px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-gray-400"
                                  />
                                  <span className="text-xs text-gray-500 whitespace-nowrap">{selectedCrop.unit}</span>
                                </div>
                              </div>
                              <div className="flex flex-col justify-end">
                                <p className="text-xs text-gray-500 mb-1">作物の残量</p>
                                <p className={`text-sm font-bold ${wouldExceed ? 'text-red-600' : 'text-black'}`}>
                                  {adjustedRemaining}{selectedCrop.unit}
                                </p>
                              </div>
                            </div>
                            {stockNum > 0 && (
                              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                                wouldExceed ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                              }`}>
                                <Sprout className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>
                                  この商品で{newAllocation}{selectedCrop.unit}を使用
                                  {wouldExceed && '（残量を超えています）'}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* ステップ2: 公開設定 */
                <div className="space-y-5">
                  {/* 詳細説明 */}
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700">詳細説明</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="例: 甘みが強い完熟トマト。サラダやパスタにおすすめです。"
                      rows={3}
                    />
                  </div>

                  {/* 公開範囲 */}
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700">公開範囲</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, visibility: 'public', visibleTo: [] })}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                          formData.visibility === 'public'
                            ? 'border-black bg-black text-white'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <Eye className="w-4 h-4" />
                        全体公開
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, visibility: 'private' })}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                          formData.visibility === 'private'
                            ? 'border-black bg-black text-white'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <Lock className="w-4 h-4" />
                        限定公開
                      </button>
                    </div>
                    {formData.visibility === 'private' && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-2">この商品を閲覧できる飲食店を選択</p>
                        <div className="space-y-2">
                          {REGISTERED_RESTAURANTS.map(restaurant => {
                            const isChecked = formData.visibleTo.includes(restaurant.id);
                            return (
                              <label
                                key={restaurant.id}
                                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                                  isChecked ? 'bg-white border border-black' : 'bg-white border border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const newVisibleTo = isChecked
                                      ? formData.visibleTo.filter(id => id !== restaurant.id)
                                      : [...formData.visibleTo, restaurant.id];
                                    setFormData({ ...formData, visibleTo: newVisibleTo });
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black accent-black"
                                />
                                <span className={`text-sm ${isChecked ? 'font-bold text-black' : 'text-gray-700'}`}>
                                  {restaurant.name}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {formData.visibility === 'private' && formData.visibleTo.length === 0 && (
                          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            少なくとも1つの飲食店を選択してください
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 発売期間 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-bold text-gray-700">発売期間</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, hasSeason: !formData.hasSeason })}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          formData.hasSeason ? 'bg-black' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          formData.hasSeason ? 'translate-x-5' : ''
                        }`} />
                      </button>
                    </div>
                    {formData.hasSeason && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-3">この商品が出荷できるおおよその期間</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium mb-1 text-gray-500">開始</label>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={formData.seasonStart.month}
                                onChange={(e) => setFormData({ ...formData, seasonStart: { ...formData.seasonStart, month: Number(e.target.value) } })}
                                className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                              >
                                {MONTHS.map(month => (
                                  <option key={month} value={month}>{month}月</option>
                                ))}
                              </select>
                              <select
                                value={formData.seasonStart.period}
                                onChange={(e) => setFormData({ ...formData, seasonStart: { ...formData.seasonStart, period: e.target.value as 'early' | 'mid' | 'late' } })}
                                className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                              >
                                {PERIOD_OPTIONS.map(period => (
                                  <option key={period.value} value={period.value}>{period.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1 text-gray-500">終了</label>
                            <div className="flex items-center gap-1.5">
                              <select
                                value={formData.seasonEnd.month}
                                onChange={(e) => setFormData({ ...formData, seasonEnd: { ...formData.seasonEnd, month: Number(e.target.value) } })}
                                className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                              >
                                {MONTHS.map(month => (
                                  <option key={month} value={month}>{month}月</option>
                                ))}
                              </select>
                              <select
                                value={formData.seasonEnd.period}
                                onChange={(e) => setFormData({ ...formData, seasonEnd: { ...formData.seasonEnd, period: e.target.value as 'early' | 'mid' | 'late' } })}
                                className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                              >
                                {PERIOD_OPTIONS.map(period => (
                                  <option key={period.value} value={period.value}>{period.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                        {formData.hasSeason && (
                          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-200">
                            <Sprout className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                            <span className="font-medium">
                              {formatSeasonPeriod(formData.seasonStart.month, formData.seasonStart.period)}〜{formatSeasonPeriod(formData.seasonEnd.month, formData.seasonEnd.period)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {editingProduct && (
                    <p className="text-xs text-gray-400 text-center leading-relaxed">
                      ※ 編集前の内容で契約中の飲食店は、<br />編集前の情報で引き続き契約が維持されます
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* フッター: ナビゲーション + ガイド */}
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white">
              {/* F: ガイドメッセージ */}
              {(() => {
                const guide = getSubmitGuide();
                if (!guide) return null;
                return (
                  <p className={`text-xs text-center mb-3 flex items-center justify-center gap-1 ${
                    guide.type === 'warning' ? 'text-amber-500' : 'text-gray-400'
                  }`}>
                    <AlertCircle className="w-3 h-3" />
                    {guide.text}
                  </p>
                );
              })()}
              <div className="flex gap-3">
                {formStep === 1 ? (
                  <>
                    <Button
                      onClick={resetForm}
                      variant="outline"
                      className="flex-1 border-gray-300 rounded-xl h-12"
                    >
                      キャンセル
                    </Button>
                    <Button
                      onClick={() => {
                        // バリデーション：全必須フィールドをtouchedに
                        setTouched({ name: true, basePrice: true, stock: true });
                        if (isStep1Valid) setFormStep(2);
                      }}
                      disabled={false}
                      className="flex-1 bg-black text-white hover:bg-gray-800 rounded-xl h-12 flex items-center justify-center gap-1"
                    >
                      次へ
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => setFormStep(1)}
                      variant="outline"
                      className="flex-shrink-0 border-gray-300 rounded-xl h-12 px-4 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      戻る
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={Object.keys(validationErrors).length > 0}
                      className="flex-1 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 rounded-xl h-12"
                    >
                      {editingProduct ? '更新' : '登録'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 画像ギャラリー */}
      {showImageGallery && (
        <ImageGallery
          selectedImage={formData.imageUrl}
          onSelectImage={(imageUrl) => setFormData({ ...formData, imageUrl })}
          onClose={() => setShowImageGallery(false)}
        />
      )}

      {/* 公開確認モーダル */}
      {showConfirmPublish && pendingProduct && (() => {
        const isPrivate = pendingProduct.visibility === 'private';
        const targetNames = isPrivate
          ? REGISTERED_RESTAURANTS.filter(r => pendingProduct.visibleTo?.includes(r.id)).map(r => r.name)
          : [];
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isPrivate ? 'bg-gray-100' : 'bg-green-100'}`}>
                {isPrivate ? <Lock className="w-8 h-8 text-gray-700" /> : <Eye className="w-8 h-8 text-green-600" />}
              </div>
              <h3 className="text-2xl font-bold text-black mb-3">
                {isPrivate ? '限定商品を公開しますか？' : '商品を公開しますか？'}
              </h3>
              {isPrivate ? (
                <p className="text-base text-gray-600 mb-2">
                  この商品は以下の飲食店のみに<br />公開されます。
                </p>
              ) : (
                <p className="text-base text-gray-600 mb-2">
                  この商品は、アプリを利用している<br />すべての飲食店に公開されます。
                </p>
              )}
              <p className="text-sm text-gray-400">
                公開後もうちの商品画面からいつでも非公開にできます
              </p>
            </div>
            
            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-6">
              <div className="text-sm text-gray-600 mb-2">登録内容</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-700">商品名:</span>
                  <span className="font-bold text-black">{pendingProduct.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">価格:</span>
                  <span className="font-bold text-black">
                    {pendingProduct.price.toLocaleString()}円/{pendingProduct.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">在庫:</span>
                  <span className="font-bold text-black">
                    {pendingProduct.stock}{pendingProduct.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">公開範囲:</span>
                  <span className="font-bold text-black">
                    {isPrivate ? '限定公開' : '全体公開'}
                  </span>
                </div>
                {isPrivate && targetNames.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">対象:</span>
                    <span className="font-bold text-black text-right">
                      {targetNames.join('、')}
                    </span>
                  </div>
                )}
                {pendingProduct.seasonStart && pendingProduct.seasonEnd && (
                  <div className="flex justify-between">
                    <span className="text-gray-700">発売期間:</span>
                    <span className="font-bold text-black text-right">
                      {formatSeasonRange(pendingProduct)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleCancelPublish}
                variant="outline"
                className="flex-1 border-2 border-gray-300 rounded-xl h-12 text-base font-bold"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleConfirmPublish}
                className="flex-1 bg-black text-white hover:bg-gray-800 rounded-xl h-12 text-base font-bold"
              >
                公開する
              </Button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* 非公開確認モーダル */}
      {unpublishTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <EyeOff className="w-7 h-7 text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-black mb-2">
                この商品を非公開にしますか？
              </h3>
              <p className="text-sm text-gray-500">
                「{unpublishTarget.name}」は{unpublishTarget.visibility === 'private' ? '限定公開先の' : ''}<br />飲食店から見えなくなります
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setUnpublishTarget(null)}
                variant="outline"
                className="flex-1 border-gray-300 rounded-xl h-11 text-sm font-bold"
              >
                キャンセル
              </Button>
              <Button
                onClick={() => {
                  handleTogglePublish(unpublishTarget);
                  setUnpublishTarget(null);
                }}
                className="flex-1 bg-black text-white hover:bg-gray-800 rounded-xl h-11 text-sm font-bold"
              >
                非公開にする
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

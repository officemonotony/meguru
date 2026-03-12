import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Sprout, Camera, Trash2, Edit2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useData, Crop } from '@/app/context/DataContext';
import { ImageGallery } from '@/app/components/ImageGallery';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { toast } from 'sonner';

const UNITS = ['kg', 'g', 'L', 'mL', '個', '本', '束', '袋', '箱'];

interface CropManagementProps {
  onNavigateToProducts?: (cropId: string) => void;
}

export function CropManagement({ onNavigateToProducts }: CropManagementProps) {
  const { crops, products, deliverySchedules, addCrop, updateCrop, deleteCrop, addHarvestLog } = useData();

  const [isAdding, setIsAdding] = useState(false);
  const [editingCrop, setEditingCrop] = useState<Crop | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [addHarvestTarget, setAddHarvestTarget] = useState<Crop | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '', totalStock: '', unit: 'kg', memo: '', imageUrl: '',
  });
  const [harvestForm, setHarvestForm] = useState({ quantity: '', memo: '' });

  const resetForm = () => setFormData({ name: '', totalStock: '', unit: 'kg', memo: '', imageUrl: '' });

  const handleSubmit = () => {
    if (!formData.name.trim()) { toast.error('作物名を入力してください'); return; }
    const qty = parseFloat(formData.totalStock);
    if (!qty || qty <= 0) { toast.error('収穫量を入力してください'); return; }

    if (editingCrop) {
      updateCrop(editingCrop.id, {
        name: formData.name,
        totalStock: editingCrop.totalStock + (qty - (editingCrop.harvestLogs[0]?.quantity || editingCrop.totalStock)),
        unit: formData.unit,
        memo: formData.memo,
        imageUrl: formData.imageUrl,
      });
      toast.success('作物情報を更新しました');
      setEditingCrop(null);
    } else {
      const tempId = `crop-${Date.now()}`;
      addCrop({ name: formData.name, totalStock: qty, unit: formData.unit, memo: formData.memo, imageUrl: formData.imageUrl });
      setJustAddedId(tempId);
      toast.success('収穫を登録しました');
    }
    resetForm();
    setIsAdding(false);
  };

  const handleDelete = (crop: Crop) => {
    try {
      deleteCrop(crop.id);
      toast.success(`${crop.name}を削除しました`);
    } catch {
      toast.error('この作物に紐づく商品があるため削除できません');
    }
  };

  const handleAddHarvest = () => {
    if (!addHarvestTarget) return;
    const qty = parseFloat(harvestForm.quantity);
    if (!qty || qty <= 0) { toast.error('収穫量を入力してください'); return; }
    addHarvestLog(addHarvestTarget.id, qty, harvestForm.memo);
    toast.success(`${qty}${addHarvestTarget.unit}の収穫を追加しました`);
    setAddHarvestTarget(null);
    setHarvestForm({ quantity: '', memo: '' });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getCropStats = (crop: Crop) => {
    const linkedProducts = products.filter(p => p.cropId === crop.id);
    const allocated = linkedProducts.reduce((sum, p) => sum + p.stock * (p.quantityPerUnit || 1), 0);
    const consumed = deliverySchedules
      .filter(d => linkedProducts.some(p => p.name === d.productName) && ['approved', 'delivered', 'paid'].includes(d.status))
      .reduce((sum, d) => sum + d.quantity, 0);
    const remaining = Math.max(0, crop.totalStock - allocated - consumed);
    const rate = crop.totalStock > 0 ? remaining / crop.totalStock : 0;
    return { linkedProducts, allocated, consumed, remaining, rate };
  };

  const getBarColor = (rate: number) => {
    if (rate > 0.4) return 'bg-black';
    if (rate > 0.2) return 'bg-amber-500';
    if (rate > 0) return 'bg-red-500';
    return 'bg-gray-300';
  };

  const lowStockCrops = crops.filter(c => {
    const { rate } = getCropStats(c);
    return rate <= 0.2 && c.totalStock > 0;
  });

  const FormModal = ({ isEdit }: { isEdit: boolean }) => (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setIsAdding(false); setEditingCrop(null); resetForm(); }}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="font-bold text-lg">{isEdit ? '作物を編集' : '収穫を登録'}</h3>
        </div>
        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 画像 */}
          <button
            onClick={() => setShowImageGallery(true)}
            className="w-full h-36 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-2 hover:border-gray-400 transition-colors overflow-hidden"
          >
            {formData.imageUrl ? (
              <ImageWithFallback src={formData.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <>
                <Camera className="w-6 h-6 text-gray-400" />
                <span className="text-sm text-gray-400">画像を選択（任意）</span>
              </>
            )}
          </button>

          {/* 作物名 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">作物名 <span className="text-red-500">*</span></label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              placeholder="例: トマト、きゅうり"
              value={formData.name}
              onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
            />
          </div>

          {/* 収穫量 + 単位 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">収穫量 <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input
                type="number"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="数値を入力"
                value={formData.totalStock}
                onChange={e => setFormData(p => ({ ...p, totalStock: e.target.value }))}
              />
              <select
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                value={formData.unit}
                onChange={e => setFormData(p => ({ ...p, unit: e.target.value }))}
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">メモ（任意）</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
              rows={3}
              placeholder="品種情報、圃場メモなど"
              value={formData.memo}
              onChange={e => setFormData(p => ({ ...p, memo: e.target.value }))}
            />
          </div>
        </div>
        <div className="px-6 py-4 flex gap-3 border-t border-gray-100">
          <button onClick={() => { setIsAdding(false); setEditingCrop(null); resetForm(); }} className="flex-1 border border-gray-300 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">キャンセル</button>
          <button onClick={handleSubmit} className="flex-1 bg-black text-white rounded-xl py-3 text-sm font-bold hover:bg-gray-800">{isEdit ? '保存' : '登録する'}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-black">在庫</h2>
        <button
          onClick={() => { resetForm(); setIsAdding(true); }}
          className="flex items-center gap-2 bg-black text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          収穫を登録
        </button>
      </div>

      {/* 空状態 */}
      {crops.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <Sprout className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">収穫がまだありません</h3>
          <p className="text-sm text-gray-500 mb-8">「収穫を登録」ボタンから<br />収穫した作物の総量を登録しましょう</p>
          <div className="bg-gray-50 rounded-2xl p-5 text-left max-w-sm w-full">
            <p className="text-sm font-bold text-gray-800 mb-3">メグルの始め方</p>
            {[
              '収穫した作物の総量を登録する（注文による消費は自動追跡されます）',
              '「商品」タブで作物から販売商品を作成する',
              '商品を公開すると飲食店から注文が届きます',
            ].map((text, i) => (
              <div key={i} className="flex gap-3 mb-2">
                <div className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                <p className="text-xs text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {crops.map(crop => {
            const { linkedProducts, allocated, consumed, remaining, rate } = getCropStats(crop);
            const isExpanded = expandedIds.has(crop.id);
            const barColor = getBarColor(rate);

            return (
              <div key={crop.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* カードヘッダー */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* サムネイル */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                      {crop.imageUrl ? (
                        <ImageWithFallback src={crop.imageUrl} alt={crop.name} className="w-full h-full object-cover" />
                      ) : (
                        <Sprout className="w-6 h-6 text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-black text-base">{crop.name}</span>
                        {rate <= 0.2 && rate > 0 && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">残りわずか</span>
                        )}
                        {rate === 0 && crop.totalStock > 0 && (
                          <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">在庫なし</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                        <span>商品 {linkedProducts.length}件</span>
                        <span>{new Date(crop.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}登録</span>
                      </div>

                      {/* 在庫バー */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">残在庫</span>
                          <span className="text-sm font-bold text-black">{remaining}{crop.unit} / {crop.totalStock}{crop.unit}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.max(0, rate * 100)}%` }} />
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                          <span>消化済 {consumed}{crop.unit}</span>
                          <span>配分中 {allocated}{crop.unit}</span>
                          <span>残率 {Math.round(rate * 100)}%</span>
                        </div>
                      </div>
                    </div>

                    <button onClick={() => toggleExpand(crop.id)} className="p-1 hover:bg-gray-100 rounded-lg shrink-0">
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                    </button>
                  </div>
                </div>

                {/* 展開コンテンツ */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                    {/* 紐づく商品 */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2">紐づく商品</p>
                      {linkedProducts.length === 0 ? (
                        <button
                          onClick={() => onNavigateToProducts?.(crop.id)}
                          className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-black hover:text-black transition-colors"
                        >
                          + この作物で商品を作る
                        </button>
                      ) : (
                        <div className="space-y-2">
                          {linkedProducts.map(p => (
                            <div key={p.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${p.stock === 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                              <span className="font-medium text-black">{p.name}</span>
                              <span className="text-gray-500">在庫 {p.stock}{p.unit}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* メモ */}
                    {crop.memo && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 mb-1">メモ</p>
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{crop.memo}</p>
                      </div>
                    )}

                    {/* 収穫履歴 */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-2">収穫履歴</p>
                      <div className="space-y-2">
                        {crop.harvestLogs.map(log => (
                          <div key={log.id} className="flex items-center gap-3 text-sm">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${log.type === 'initial' ? 'bg-black' : 'bg-green-500'}`} />
                            <span className="text-gray-400 text-xs">{new Date(log.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</span>
                            <span className="text-gray-700">{log.type === 'initial' ? '初回登録' : '追加収穫'} +{log.quantity}{crop.unit}</span>
                            {log.memo && <span className="text-gray-400 text-xs truncate">{log.memo}</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* アクションボタン */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setAddHarvestTarget(crop)}
                        className="flex-1 bg-black text-white rounded-xl py-2.5 text-sm font-bold hover:bg-gray-800"
                      >
                        + 収穫を追加
                      </button>
                      <button
                        onClick={() => {
                          setEditingCrop(crop);
                          setFormData({ name: crop.name, totalStock: String(crop.totalStock), unit: crop.unit, memo: crop.memo || '', imageUrl: crop.imageUrl || '' });
                        }}
                        className="px-4 border border-gray-300 rounded-xl py-2.5 hover:bg-gray-50"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(crop)}
                        className="px-4 border border-red-200 rounded-xl py-2.5 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 低在庫アラート */}
      {lowStockCrops.length > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-bold text-amber-800">在庫が少ない作物があります</p>
          </div>
          {lowStockCrops.map(crop => {
            const { remaining, rate } = getCropStats(crop);
            return (
              <div key={crop.id} className="flex items-center justify-between text-sm py-1">
                <span className="text-amber-800">{crop.name}</span>
                <span className="text-amber-600 font-medium">{remaining}{crop.unit}（{Math.round(rate * 100)}%）</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 登録/編集モーダル */}
      {isAdding && <FormModal isEdit={false} />}
      {editingCrop && <FormModal isEdit={true} />}

      {/* 収穫追加モーダル */}
      {addHarvestTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setAddHarvestTarget(null)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <h3 className="font-bold text-lg">{addHarvestTarget.name}の収穫を追加</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">追加収穫量 <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="数値を入力"
                    value={harvestForm.quantity}
                    onChange={e => setHarvestForm(p => ({ ...p, quantity: e.target.value }))}
                  />
                  <div className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-600">{addHarvestTarget.unit}</div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">メモ（任意）</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="備考など"
                  value={harvestForm.memo}
                  onChange={e => setHarvestForm(p => ({ ...p, memo: e.target.value }))}
                />
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3 border-t border-gray-100">
              <button onClick={() => setAddHarvestTarget(null)} className="flex-1 border border-gray-300 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">キャンセル</button>
              <button onClick={handleAddHarvest} className="flex-1 bg-black text-white rounded-xl py-3 text-sm font-bold hover:bg-gray-800">追加する</button>
            </div>
          </div>
        </div>
      )}

      {/* 画像ギャラリー */}
      {showImageGallery && (
        <ImageGallery
          selectedImage={formData.imageUrl} onSelectImage={(url) => { setFormData(p => ({ ...p, imageUrl: url })); setShowImageGallery(false); }}
          onClose={() => setShowImageGallery(false)}
        />
      )}
    </div>
  );
}

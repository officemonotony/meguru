import { useState, useEffect } from 'react';
import { Calendar, Package, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { toHalfWidth } from '@/app/utils/normalizeNumber';
import type { SubscriptionProposal } from '@/app/types';

// 後方互換性のため再エクスポート
export type { SubscriptionProposal };

interface ProposalFormProps {
  productId: string;
  productName: string;
  farmerName: string;
  farmerId: string;
  unit: string;
  basePrice: number;
  onClose: () => void;
  onSubmit: (proposal: Omit<SubscriptionProposal, 'id' | 'status' | 'createdAt'>) => void;
}

type Frequency = 'twice_weekly' | 'weekly' | 'biweekly' | 'monthly';

const frequencyOptions: { value: Frequency; label: string }[] = [
  { value: 'twice_weekly', label: '週2回' },
  { value: 'weekly', label: '週1回' },
  { value: 'biweekly', label: '隔週' },
  { value: 'monthly', label: '月1回' },
];

const dayOptions = ['月', '火', '水', '木', '金', '土', '日'];
const dayFullNames: Record<string, string> = {
  '月': '月曜日', '火': '火曜日', '水': '水曜日', '木': '木曜日',
  '金': '金曜日', '土': '土曜日', '日': '日曜日',
};

const weekPatternOptions = [
  { value: '1_3' as const, label: '第1・第3週' },
  { value: '2_4' as const, label: '第2・第4週' },
];

const monthWeekOptions = [
  { value: 1, label: '第1週' },
  { value: 2, label: '第2週' },
  { value: 3, label: '第3週' },
  { value: 4, label: '第4週' },
];

export function ProposalForm({
  productId,
  productName,
  farmerName,
  farmerId,
  unit,
  basePrice,
  onClose,
  onSubmit,
}: ProposalFormProps) {
  const today = new Date().toISOString().split('T')[0];

  const defaultStartDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const defaultEndDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    quantity: 1,
    startDate: defaultStartDate(),
    endDate: defaultEndDate(),
    frequency: 'weekly' as Frequency,
    customPrice: basePrice,
    message: '',
  });

  // 曜日選択の状態（頻度に応じて使い分け）
  const [selectedDays, setSelectedDays] = useState<string[]>(['月']);
  const [weekPattern, setWeekPattern] = useState<'1_3' | '2_4'>('1_3');
  const [monthWeek, setMonthWeek] = useState<number>(1);

  // 頻度が変わったら曜日選択をリセット
  useEffect(() => {
    if (formData.frequency === 'twice_weekly') {
      setSelectedDays(prev => prev.length === 2 ? prev : ['月', '木']);
    } else {
      setSelectedDays(prev => [prev[0] || '月']);
    }
  }, [formData.frequency]);

  // 曜日トグル（週2回用）
  const toggleDay = (day: string) => {
    if (formData.frequency === 'twice_weekly') {
      setSelectedDays(prev => {
        if (prev.includes(day)) {
          return prev.length > 1 ? prev.filter(d => d !== day) : prev;
        }
        if (prev.length >= 2) {
          return [prev[1], day]; // 古い方を押し出す
        }
        return [...prev, day];
      });
    } else {
      setSelectedDays([day]);
    }
  };

  // deliveryDay 文字列を組み立て
  const buildDeliveryDayString = (): string => {
    const dayNames = selectedDays.map(d => dayFullNames[d]);
    switch (formData.frequency) {
      case 'twice_weekly':
        // 曜日順にソートして表示
        const sorted = [...selectedDays].sort(
          (a, b) => dayOptions.indexOf(a) - dayOptions.indexOf(b)
        );
        return sorted.map(d => dayFullNames[d]).join('・');
      case 'weekly':
        return dayNames[0];
      case 'biweekly': {
        const patternLabel = weekPattern === '1_3' ? '第1・第3週' : '第2・第4週';
        return `${patternLabel} ${dayNames[0]}`;
      }
      case 'monthly':
        return `第${monthWeek}週 ${dayNames[0]}`;
    }
  };

  // 配送回数の自動計算
  const calculateTotalDeliveries = () => {
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (end <= start) return 0;
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const deliveriesPerWeek =
      formData.frequency === 'twice_weekly' ? 2
      : formData.frequency === 'weekly' ? 1
      : formData.frequency === 'biweekly' ? 0.5
      : 12 / 52; // monthly ≈ 0.23/week
    const weeks = diffDays / 7;
    return Math.max(1, Math.round(weeks * deliveriesPerWeek));
  };

  const calculatePeriod = () => {
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (end <= start) return '—';
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 30) return `${diffDays}日間`;
    const months = Math.round(diffDays / 30);
    return `約${months}ヶ月間`;
  };

  const totalDeliveries = calculateTotalDeliveries();
  const pricePerDelivery = formData.customPrice * formData.quantity;
  const totalAmount = pricePerDelivery * totalDeliveries;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalDeliveries <= 0) return;
    onSubmit({
      restaurantId: '',
      restaurantName: '',
      productId,
      productName,
      farmerName,
      farmerId,
      quantity: formData.quantity,
      unit,
      frequency: formData.frequency,
      totalDeliveries,
      period: calculatePeriod(),
      startDate: formData.startDate,
      endDate: formData.endDate,
      deliveryDay: buildDeliveryDayString(),
      pricePerDelivery,
      totalAmount,
      message: formData.message,
    });
  };

  // 曜日選択のヘルプテキスト
  const getDaySelectionHint = () => {
    switch (formData.frequency) {
      case 'twice_weekly':
        return `2つの曜日を選択（${selectedDays.length}/2）`;
      case 'weekly':
        return '配送を希望する曜日を選択';
      case 'biweekly':
        return '配送を希望する週と曜日を選択';
      case 'monthly':
        return '配送を希望する週と曜日を選択';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
        {/* ヘッダー */}
        <div className="sticky top-0 bg-white border-b-2 border-gray-300 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-black">継続を提案</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 説明文 */}
          <div className="px-1">
            <p className="text-sm font-bold text-black mb-1">
              まずは農家さんに提案してみましょう
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              農家さんはこちらの提案を見てメッセージを返信します。この提案で注文が確定するわけではありませんので、お気軽にどうぞ。
            </p>
          </div>

          {/* 商品情報 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-5 h-5 text-gray-600" />
              <h3 className="font-bold text-lg text-black">{productName}</h3>
            </div>
            <p className="text-sm text-gray-600">{farmerName}</p>
            <p className="text-sm text-gray-600 mt-1">
              基本価格: {basePrice.toLocaleString()}円/{unit}
            </p>
          </div>

          {/* ① 配送量 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              1回あたりの配送量
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                value={formData.quantity}
                onChange={(e) => { const val = toHalfWidth(e.target.value); setFormData({ ...formData, quantity: Math.max(1, parseInt(val) || 1) }); }}
                className="w-32 border-2 border-gray-300 rounded-xl px-4 py-3 text-base text-center"
                required
              />
              <span className="text-gray-600">{unit}</span>
            </div>
          </div>

          {/* ② 開始日 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              開始日
            </label>
            <input
              type="date"
              value={formData.startDate}
              min={today}
              onChange={(e) => {
                const newStart = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  startDate: newStart,
                  endDate: newStart >= prev.endDate
                    ? (() => { const d = new Date(newStart); d.setMonth(d.getMonth() + 3); return d.toISOString().split('T')[0]; })()
                    : prev.endDate,
                }));
              }}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base"
              required
            />
          </div>

          {/* ③ 終了日 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              終了日
            </label>
            <input
              type="date"
              value={formData.endDate}
              min={formData.startDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base"
              required
            />
            {totalDeliveries > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                {calculatePeriod()} ・ 約{totalDeliveries}回のお届け
              </p>
            )}
          </div>

          {/* ④ 配送頻度 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              配送頻度
            </label>
            <div className="grid grid-cols-4 gap-2">
              {frequencyOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, frequency: option.value })}
                  className={`py-3 px-2 rounded-xl font-bold transition-all border-2 text-sm ${
                    formData.frequency === option.value
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* ⑤ 配送希望曜日（頻度に応じてUI変化） */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              配送希望曜日
            </label>
            <p className="text-xs text-gray-500 mb-3">{getDaySelectionHint()}</p>

            {/* 隔週: 週パターン選択 */}
            {formData.frequency === 'biweekly' && (
              <div className="mb-3">
                <div className="grid grid-cols-2 gap-2">
                  {weekPatternOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setWeekPattern(opt.value)}
                      className={`py-2.5 px-3 rounded-xl font-bold transition-all border-2 text-sm ${
                        weekPattern === opt.value
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 月1回: 第何週選択 */}
            {formData.frequency === 'monthly' && (
              <div className="mb-3">
                <div className="grid grid-cols-4 gap-2">
                  {monthWeekOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMonthWeek(opt.value)}
                      className={`py-2.5 px-2 rounded-xl font-bold transition-all border-2 text-sm ${
                        monthWeek === opt.value
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 曜日ボタン（全頻度共通） */}
            <div className="grid grid-cols-7 gap-1.5">
              {dayOptions.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`py-3 rounded-xl font-bold transition-all border-2 text-sm ${
                      isSelected
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* 選択結果プレビュー */}
            <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-sm text-gray-700">
                <span className="text-gray-500">選択中: </span>
                <span className="font-bold">{buildDeliveryDayString()}</span>
              </p>
            </div>
          </div>

          {/* ⑥ 希望価格 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              希望価格（1{unit}あたり）
            </label>
            <p className="text-xs text-gray-600 mb-3">
              基本価格: {basePrice.toLocaleString()}円/{unit}（変更可能です）
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                value={formData.customPrice}
                onChange={(e) => { const val = toHalfWidth(e.target.value); setFormData({ ...formData, customPrice: Math.max(0, parseInt(val) || 0) }); }}
                className="w-40 border-2 border-gray-300 rounded-xl px-4 py-3 text-base text-center"
                required
              />
              <span className="text-gray-600">円/{unit}</span>
            </div>
          </div>

          {/* ⑦ メッセージ */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              メッセージ（任意）
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base resize-none"
              rows={4}
              placeholder="例: よろしくお願いします。打ち合わせの日程について相談させてください。"
            />
          </div>

          {/* 見積もり */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
            <h4 className="font-bold text-sm text-blue-800 mb-3">見積もり</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">単価:</span>
                <span className="font-bold text-blue-900">
                  {formData.customPrice.toLocaleString()}円/{unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">1回あたり:</span>
                <span className="font-bold text-blue-900">
                  {pricePerDelivery.toLocaleString()}円
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">配送回数:</span>
                <span className="font-bold text-blue-900">{totalDeliveries}回（{calculatePeriod()}）</span>
              </div>
              <div className="border-t-2 border-blue-300 pt-2 mt-2 flex justify-between">
                <span className="text-blue-700 font-bold">合計見積:</span>
                <span className="font-bold text-xl text-blue-900">
                  {totalAmount.toLocaleString()}円
                </span>
              </div>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 border-2 border-gray-300 rounded-xl h-12 text-base font-bold"
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={totalDeliveries <= 0}
              className="flex-1 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 rounded-xl h-12 text-base font-bold"
            >
              <Calendar className="w-4 h-4 mr-2" />
              農家に提案する
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
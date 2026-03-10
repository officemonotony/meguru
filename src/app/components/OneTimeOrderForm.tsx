import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { DatePicker } from '@/app/components/DatePicker'
import { toHalfWidth } from '@/app/utils/normalizeNumber'
import type { Product } from '@/app/context/DataContext'

interface OneTimeOrderFormProps {
  product: Product
  onSubmit: (order: { quantity: number; deliveryDate: string }) => void
  onCancel: () => void
}

export function OneTimeOrderForm({ product, onSubmit, onCancel }: OneTimeOrderFormProps) {
  const [quantity, setQuantity] = useState('1')
  const [deliveryDate, setDeliveryDate] = useState('')

  const handleSubmit = () => {
    const qty = parseInt(toHalfWidth(quantity))
    if (!qty || qty <= 0) return
    if (!deliveryDate) return
    onSubmit({ quantity: qty, deliveryDate })
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-bold">単発注文</h3>
      <p className="text-sm text-gray-600">{product.name} ({product.price.toLocaleString()}円/{product.unit})</p>
      <div>
        <label className="text-sm font-bold text-gray-700 mb-1 block">数量 ({product.unit})</label>
        <input
          type="number"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          className="w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-base"
          min="1"
        />
      </div>
      <div>
        <label className="text-sm font-bold text-gray-700 mb-1 block">希望配送日</label>
        <DatePicker value={deliveryDate} onChange={setDeliveryDate} minDate={new Date().toISOString().split('T')[0]} />
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={onCancel}>キャンセル</Button>
        <Button className="flex-1 h-12 rounded-xl bg-black text-white" onClick={handleSubmit} disabled={!quantity || !deliveryDate}>注文する</Button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface DatePickerProps {
  value?: string
  onChange?: (date: string) => void
  placeholder?: string
  minDate?: string
}

export function DatePicker({ value, onChange, placeholder = '日付を選択', minDate }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const handleSelect = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange?.(dateStr)
    setOpen(false)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full h-12 px-4 border-2 border-gray-200 rounded-xl text-sm hover:border-gray-400 transition-colors"
      >
        <Calendar className="w-4 h-4 text-gray-400" />
        <span className={value ? 'text-black' : 'text-gray-400'}>{value || placeholder}</span>
      </button>

      {open && (
        <div className="absolute top-14 left-0 z-50 bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-xl w-72">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-bold text-sm">{viewYear}年{viewMonth + 1}月</span>
            <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['日','月','火','水','木','金','土'].map(d => (
              <div key={d} className="text-center text-xs text-gray-400 font-bold py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => {
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isSelected = value === dateStr
              const isDisabled = minDate ? dateStr < minDate : false
              return (
                <button
                  key={day}
                  onClick={() => !isDisabled && handleSelect(day)}
                  className={`text-center text-sm py-1.5 rounded-lg transition-colors ${
                    isSelected ? 'bg-black text-white font-bold' :
                    isDisabled ? 'text-gray-200 cursor-not-allowed' :
                    'hover:bg-gray-100'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <Button variant="outline" className="w-full mt-3 h-9 text-sm" onClick={() => setOpen(false)}>閉じる</Button>
        </div>
      )}
    </div>
  )
}

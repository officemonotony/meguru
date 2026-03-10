import { useState, useRef, useEffect } from 'react';
import { ChevronRight, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface SwipeButtonProps {
  onComplete: () => void;
  text: string;
  completedText?: string;
  disabled?: boolean;
  confirmMessage?: string;
}

export function SwipeButton({ onComplete, text, completedText = '完了', disabled = false, confirmMessage }: SwipeButtonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  const thumbWidth = 64; // w-16 = 64px

  const handleStart = (clientX: number) => {
    if (disabled || isCompleted) return;
    setIsDragging(true);
    startXRef.current = clientX - position;
  };

  const completeAction = () => {
    setIsCompleted(true);
    if (containerRef.current) {
      setPosition(containerRef.current.offsetWidth - thumbWidth);
    }
    onComplete();
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const maxPosition = containerWidth - thumbWidth;
    const newPosition = Math.max(0, Math.min(clientX - startXRef.current, maxPosition));
    
    setPosition(newPosition);

    // Check if swiped to the end (90% threshold)
    if (newPosition >= maxPosition * 0.9) {
      setIsDragging(false);
      if (confirmMessage) {
        // 確認が必要な場合はダイアログを表示
        setPosition(maxPosition);
        setShowConfirm(true);
      } else {
        setPosition(maxPosition);
        completeAction();
      }
    }
  };

  const handleConfirmYes = () => {
    setShowConfirm(false);
    completeAction();
  };

  const handleConfirmNo = () => {
    setShowConfirm(false);
    setPosition(0);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (!isCompleted && !showConfirm) {
      // Snap back to start with animation
      setPosition(0);
    }
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging) {
      e.preventDefault(); // Prevent scrolling while swiping
      handleMove(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging]);

  const progress = containerRef.current 
    ? (position / (containerRef.current.offsetWidth - thumbWidth)) * 100 
    : 0;

  return (
    <>
      <div
        ref={containerRef}
        className={`relative h-16 bg-gray-200 rounded-full overflow-hidden select-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {/* Progress background */}
        <div
          className={`absolute inset-0 transition-all ${
            isCompleted ? 'bg-green-500' : showConfirm ? 'bg-amber-400' : 'bg-gray-300'
          }`}
          style={{
            width: `${Math.max(thumbWidth, position + thumbWidth)}px`,
            transition: isDragging ? 'none' : 'width 0.3s ease-out, background-color 0.3s ease-out',
          }}
        />

        {/* Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className={`text-lg font-bold transition-all duration-300 ${
              isCompleted ? 'text-white' : progress > 50 ? 'text-white' : 'text-gray-600'
            }`}
          >
            {isCompleted ? completedText : text}
          </span>
        </div>

        {/* Swipe thumb */}
        <div
          ref={thumbRef}
          className={`absolute top-2 left-2 h-12 w-16 rounded-full shadow-lg flex items-center justify-center transition-colors ${
            isCompleted ? 'bg-white' : 'bg-white'
          }`}
          style={{
            transform: `translateX(${position}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {isCompleted ? (
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <ChevronRight className="w-8 h-8 text-gray-600" />
          )}
        </div>
      </div>

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={handleConfirmNo}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-amber-600" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-center text-gray-900 mb-2">確認</h3>
              <p className="text-sm text-gray-600 text-center leading-relaxed whitespace-pre-line">{confirmMessage}</p>
            </div>
            <div className="grid grid-cols-2 border-t border-gray-200">
              <button
                onClick={handleConfirmNo}
                className="py-4 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors border-r border-gray-200 active:scale-[0.98]"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmYes}
                className="py-4 text-sm font-bold text-black hover:bg-gray-50 transition-colors active:scale-[0.98]"
              >
                このまま完了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useRef } from 'react';
import { Upload, Check, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { useAuth } from '@/app/context/AuthContext';
import { toast } from 'sonner';

interface ImageGalleryProps {
  selectedImage: string | null;
  onSelectImage: (url: string) => void;
  onClose: () => void;
}

const defaultImages = [
  'https://images.unsplash.com/photo-1546470427-e26264be0580?w=400',
  'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=400',
  'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=400',
  'https://images.unsplash.com/photo-1606162537842-f80f6b891831?w=400',
  'https://images.unsplash.com/photo-1589927986089-35812378d7f2?w=400',
  'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=400',
  'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400',
  'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function ImageGallery({ selectedImage, onSelectImage, onClose }: ImageGalleryProps) {
  const [selected, setSelected] = useState<string | null>(selectedImage);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useAuth(); // 認証コンテキストを使用

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('対応していないファイル形式です。JPEG, PNG, WebP, GIF のみ対応しています。');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('ファイルサイズが大きすぎます（最大5MB）');
      return;
    }

    setIsUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setUploadedImages(prev => [dataUrl, ...prev]);
      setSelected(dataUrl);
      toast.success('画像をアップロードしました');
    } catch {
      toast.error('画像の読み込みに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirm = () => {
    if (selected) onSelectImage(selected);
    onClose();
  };

  const allImages = [...uploadedImages, ...defaultImages];

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end z-50" onClick={onClose}>
      <div className="bg-white w-full rounded-t-2xl p-6 h-[65vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4 text-black">画像を選択</h3>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
        <Button onClick={handleUploadClick} variant="outline" className="w-full mb-4 border-2 border-dashed border-gray-300 py-8" disabled={isUploading}>
          {isUploading ? <><Loader2 className="w-6 h-6 mr-2 animate-spin" />アップロード中...</> : <><Upload className="w-6 h-6 mr-2" />新しい画像をアップロード</>}
        </Button>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {allImages.map((url, index) => (
            <button key={`${url}-${index}`} onClick={() => setSelected(url)} className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selected === url ? 'border-black' : 'border-gray-200'}`}>
              <ImageWithFallback src={url} alt={`画像 ${index + 1}`} className="w-full h-full object-cover" />
              {selected === url && <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Check className="w-8 h-8 text-white" /></div>}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <Button onClick={onClose} variant="outline" className="flex-1">キャンセル</Button>
          <Button onClick={handleConfirm} disabled={!selected} className="flex-1 bg-black text-white">選択</Button>
        </div>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

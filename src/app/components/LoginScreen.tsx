import { useState } from 'react';
import { Store, Sprout, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useAuth } from '@/app/context/AuthContext';

const logoImage = '/logo.svg';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await signIn(email, password);
    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません');
    }
    setLoading(false);
  };

  const fillDemo = (type: 'farmer' | 'restaurant' | 'admin') => {
    const demos: Record<string, { email: string; password: string }> = {
      farmer: { email: 'farmer@meguru.com', password: 'meguru123' },
      restaurant: { email: 'restaurant@meguru.com', password: 'meguru123' },
      admin: { email: 'admin@meguru.com', password: 'meguru123' },
    };
    setEmail(demos[type].email);
    setPassword(demos[type].password);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ロゴエリア */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="mb-1">
          <img src={logoImage} alt="メグル" className="w-40 h-40 object-contain" />
        </div>
        <p className="text-lg text-gray-600 text-center mb-8">農家と飲食店をつなぐ</p>

        {/* ログインフォーム */}
        <div className="w-full max-w-md space-y-4">
          <div>
            <Input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-12 rounded-xl border-2 text-base"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="パスワード"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-12 rounded-xl border-2 text-base pr-12"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-black text-white hover:bg-gray-800 h-12 rounded-xl text-base font-bold"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ログイン'}
          </Button>
        </div>
      </div>

      {/* デモ用ボタン */}
      <div className="px-6 pb-10 space-y-3 w-full max-w-md mx-auto">
        <p className="text-center text-xs text-gray-400 font-bold">── デモアカウント ──</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => fillDemo('farmer')}
            className="flex flex-col items-center gap-1 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
          >
            <Sprout className="w-5 h-5 text-green-600" />
            <span className="text-xs font-bold text-gray-700">農家</span>
          </button>
          <button
            onClick={() => fillDemo('restaurant')}
            className="flex flex-col items-center gap-1 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
          >
            <Store className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-bold text-gray-700">飲食店</span>
          </button>
          <button
            onClick={() => fillDemo('admin')}
            className="flex flex-col items-center gap-1 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
          >
            <span className="text-lg">⚙️</span>
            <span className="text-xs font-bold text-gray-700">管理者</span>
          </button>
        </div>
        <p className="text-center text-xs text-gray-400">
          ボタンを押すと入力欄に自動入力されます
        </p>
      </div>
    </div>
  );
}

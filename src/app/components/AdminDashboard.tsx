import { useState } from 'react';
import { UserPlus, TrendingUp, Search, LogOut } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';

interface AdminDashboardProps {
  onLogout: () => void;
}

type AdminTab = 'users' | 'revenue';
type UserType = 'farmer' | 'restaurant';

interface User {
  id: string;
  type: UserType;
  shopName: string;
  representativeName: string;
  email: string;
  address: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  date: string;
  restaurantName: string;
  farmerName: string;
  productName: string;
  amount: number;
  platformFee: number;
  paymentFee: number;
  netProfit: number;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [userType, setUserType] = useState<UserType>('restaurant');
  const [searchQuery, setSearchQuery] = useState('');

  // 新規ユーザー登録フォーム
  const [shopName, setShopName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');

  // ダミーデータ
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      type: 'restaurant',
      shopName: 'レストラン山田',
      representativeName: '山田太郎',
      email: 'yamada@restaurant.com',
      address: '東京都渋谷区1-2-3',
      createdAt: '2024-01-15',
    },
    {
      id: '2',
      type: 'farmer',
      shopName: '鈴木農園',
      representativeName: '鈴木花子',
      email: 'suzuki@farmer.com',
      address: '千葉県成田市4-5-6',
      createdAt: '2024-01-20',
    },
  ]);

  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: '1',
      date: '2024-02-05',
      restaurantName: 'レストラン山田',
      farmerName: '鈴木農園',
      productName: 'トマト 5kg',
      amount: 3000,
      platformFee: 300,
      paymentFee: 105,
      netProfit: 195,
    },
    {
      id: '2',
      date: '2024-02-06',
      restaurantName: 'レストラン山田',
      farmerName: '鈴木農園',
      productName: 'きゅうり 3kg',
      amount: 2000,
      platformFee: 200,
      paymentFee: 70,
      netProfit: 130,
    },
  ]);

  const handleCreateUser = () => {
    if (!shopName || !representativeName || !email || !password || !address) {
      alert('すべての項目を入力してください');
      return;
    }

    const newUser: User = {
      id: Date.now().toString(),
      type: userType,
      shopName,
      representativeName,
      email,
      address,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setUsers([...users, newUser]);

    // フォームをリセット
    setShopName('');
    setRepresentativeName('');
    setEmail('');
    setPassword('');
    setAddress('');

    alert('ユーザーを登録しました');
  };

  const filteredUsers = users.filter(
    (user) =>
      user.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.representativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
  const totalPlatformFee = transactions.reduce((sum, t) => sum + t.platformFee, 0);
  const totalPaymentFee = transactions.reduce((sum, t) => sum + t.paymentFee, 0);
  const totalNetProfit = transactions.reduce((sum, t) => sum + t.netProfit, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-black">管理画面</h1>
          <button
            onClick={onLogout}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </header>

      {/* タブナビゲーション */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-4 text-base font-bold border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500'
            }`}
          >
            <UserPlus className="w-5 h-5 inline mr-2" />
            新規ユーザー発行
          </button>
          <button
            onClick={() => setActiveTab('revenue')}
            className={`flex-1 py-4 text-base font-bold border-b-2 transition-colors ${
              activeTab === 'revenue'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500'
            }`}
          >
            <TrendingUp className="w-5 h-5 inline mr-2" />
            売上管理
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="pb-6">
        {activeTab === 'users' && (
          <div className="p-4 space-y-6">
            {/* ユーザー種別タブ */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="text-lg font-bold text-black mb-4">ユーザー種別</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setUserType('restaurant')}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    userType === 'restaurant'
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  飲食店
                </button>
                <button
                  onClick={() => setUserType('farmer')}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                    userType === 'farmer'
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  農家
                </button>
              </div>
            </div>

            {/* 入力フォーム */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-black">新規登録</h2>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  {userType === 'restaurant' ? '店舗名' : '農園名'}
                </label>
                <Input
                  type="text"
                  placeholder={userType === 'restaurant' ? '例: レストラン山田' : '例: 鈴木農園'}
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-black"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  代表者名
                </label>
                <Input
                  type="text"
                  placeholder="例: 山田太郎"
                  value={representativeName}
                  onChange={(e) => setRepresentativeName(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-black"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  メールアドレス
                </label>
                <Input
                  type="email"
                  inputMode="email"
                  placeholder="example@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-black"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  初期パスワード
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-black"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  拠点住所
                </label>
                <Input
                  type="text"
                  placeholder="例: 東京都渋谷区1-2-3"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-black"
                />
              </div>

              <Button
                onClick={handleCreateUser}
                className="w-full bg-black text-white hover:bg-gray-800 p-4 rounded-xl text-base font-bold"
              >
                ユーザーを登録
              </Button>
            </div>

            {/* ユーザー名簿リスト */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="text-lg font-bold text-black mb-4">ユーザー名簿リスト</h2>

              {/* 検索バー */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="名前、店舗名、メールで検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 p-3 border-2 border-gray-300 rounded-xl focus:border-black"
                />
              </div>

              {/* ユーザーリスト */}
              <div className="space-y-3">
                {filteredUsers.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    該当するユーザーが見つかりません
                  </p>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="border-2 border-gray-200 rounded-xl p-4 hover:border-gray-400 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-2 ${
                              user.type === 'restaurant'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {user.type === 'restaurant' ? '飲食店' : '農家'}
                          </span>
                          <h3 className="text-base font-bold text-black">{user.shopName}</h3>
                        </div>
                        <span className="text-xs text-gray-500">{user.createdAt}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">代表者: {user.representativeName}</p>
                      <p className="text-sm text-gray-700 mb-1">{user.email}</p>
                      <p className="text-sm text-gray-600">{user.address}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="p-4 space-y-6">
            {/* サマリーカード */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-600 mb-1">総取引額</p>
                <p className="text-2xl font-bold text-black">¥{totalRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-600 mb-1">手数料(10%)</p>
                <p className="text-2xl font-bold text-black">¥{totalPlatformFee.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-600 mb-1">決済手数料(3.5%)</p>
                <p className="text-2xl font-bold text-red-600">-¥{totalPaymentFee.toLocaleString()}</p>
              </div>
              <div className="bg-black rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-300 mb-1">純利益(6.5%)</p>
                <p className="text-2xl font-bold text-white">¥{totalNetProfit.toLocaleString()}</p>
              </div>
            </div>

            {/* 取引タイムライン */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="text-lg font-bold text-black mb-4">取引タイムライン</h2>

              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">取引履歴がありません</p>
                ) : (
                  transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="border-2 border-gray-200 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">{transaction.date}</p>
                          <p className="text-base font-bold text-black">{transaction.productName}</p>
                        </div>
                        <p className="text-xl font-bold text-black">
                          ¥{transaction.amount.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3 space-y-2 mb-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">飲食店:</span>
                          <span className="font-bold text-gray-800">{transaction.restaurantName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">農家:</span>
                          <span className="font-bold text-gray-800">{transaction.farmerName}</span>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 pt-3 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">手数料 (10%)</span>
                          <span className="font-bold text-blue-600">
                            ¥{transaction.platformFee.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">決済手数料 (3.5%)</span>
                          <span className="font-bold text-red-600">
                            -¥{transaction.paymentFee.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                          <span className="text-gray-800 font-bold">純利益 (6.5%)</span>
                          <span className="font-bold text-green-600">
                            ¥{transaction.netProfit.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

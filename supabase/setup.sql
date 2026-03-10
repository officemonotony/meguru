-- ============================================================
-- メグル - Supabase データベースセットアップ
-- Supabase SQL Editorで実行してください
-- ============================================================

-- 1. プロフィールテーブル（ユーザーのロールと情報）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('farmer', 'restaurant', 'admin')),
  shop_name TEXT NOT NULL,
  representative_name TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 商品テーブル
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '野菜',
  price INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  stock INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 注文テーブル
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES profiles(id),
  farmer_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'approved', 'delivered', 'paid')),
  total_amount INTEGER NOT NULL DEFAULT 0,
  delivery_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 注文明細テーブル
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL,
  price INTEGER NOT NULL
);

-- 5. 継続契約テーブル
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES profiles(id),
  farmer_id UUID REFERENCES profiles(id),
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('twice_weekly', 'weekly', 'biweekly', 'monthly')),
  delivery_day TEXT NOT NULL,
  price_per_delivery INTEGER NOT NULL,
  total_deliveries INTEGER NOT NULL DEFAULT 12,
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. チャットルームテーブル
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES profiles(id),
  restaurant_id UUID REFERENCES profiles(id),
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  farmer_unread INTEGER DEFAULT 0,
  restaurant_unread INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(farmer_id, restaurant_id)
);

-- 7. メッセージテーブル
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('farmer', 'restaurant')),
  text TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'proposal', 'counterProposal', 'deliveryRequest', 'orderApproval')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS（行レベルセキュリティ）設定
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- プロフィール: 自分のみ更新可、全員読み取り可
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 商品: 農家のみ登録・更新、全員読み取り可
CREATE POLICY "products_read" ON products FOR SELECT USING (true);
CREATE POLICY "products_insert_farmer" ON products FOR INSERT WITH CHECK (auth.uid() = farmer_id);
CREATE POLICY "products_update_farmer" ON products FOR UPDATE USING (auth.uid() = farmer_id);
CREATE POLICY "products_delete_farmer" ON products FOR DELETE USING (auth.uid() = farmer_id);

-- 注文: 関係する農家・飲食店のみ
CREATE POLICY "orders_read" ON orders FOR SELECT USING (
  auth.uid() = restaurant_id OR auth.uid() = farmer_id
);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (auth.uid() = restaurant_id);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (
  auth.uid() = restaurant_id OR auth.uid() = farmer_id
);

-- 注文明細: 関連注文へのアクセス権がある場合
CREATE POLICY "order_items_read" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE id = order_id AND (restaurant_id = auth.uid() OR farmer_id = auth.uid()))
);
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE id = order_id AND restaurant_id = auth.uid())
);

-- 継続契約: 関係する農家・飲食店のみ
CREATE POLICY "subscriptions_read" ON subscriptions FOR SELECT USING (
  auth.uid() = restaurant_id OR auth.uid() = farmer_id
);
CREATE POLICY "subscriptions_insert" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = restaurant_id);
CREATE POLICY "subscriptions_update" ON subscriptions FOR UPDATE USING (
  auth.uid() = restaurant_id OR auth.uid() = farmer_id
);

-- チャット: 関係するユーザーのみ
CREATE POLICY "chat_rooms_read" ON chat_rooms FOR SELECT USING (
  auth.uid() = farmer_id OR auth.uid() = restaurant_id
);
CREATE POLICY "chat_rooms_insert" ON chat_rooms FOR INSERT WITH CHECK (
  auth.uid() = farmer_id OR auth.uid() = restaurant_id
);
CREATE POLICY "chat_rooms_update" ON chat_rooms FOR UPDATE USING (
  auth.uid() = farmer_id OR auth.uid() = restaurant_id
);

-- メッセージ: チャットルームのメンバーのみ
CREATE POLICY "messages_read" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_rooms WHERE id = chat_room_id AND (farmer_id = auth.uid() OR restaurant_id = auth.uid()))
);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ============================================================
-- トリガー: 新規ユーザー登録時にprofileを自動作成
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- メタデータからrole, shop_nameを取得（管理者がAdminダッシュから作成する想定）
  INSERT INTO profiles (id, email, role, shop_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'restaurant'),
    COALESCE(NEW.raw_user_meta_data->>'shop_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- デモユーザーのprofileを手動で挿入（auth.usersはSupabaseダッシュから作成後）
-- auth.usersのUUIDを確認してから実行してください
-- ============================================================
-- 例:
-- INSERT INTO profiles (id, email, role, shop_name) VALUES
--   ('UUID_OF_FARMER_USER', 'farmer@meguru.com', 'farmer', '龍ノ傘'),
--   ('UUID_OF_RESTAURANT_USER', 'restaurant@meguru.com', 'restaurant', 'レストラン山田'),
--   ('UUID_OF_ADMIN_USER', 'admin@meguru.com', 'admin', 'メグル管理');

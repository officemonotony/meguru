# メグル - 農家と飲食店をつなぐプラットフォーム

## セットアップ手順

### 1. Supabase設定

#### 1-1. データベース作成
Supabaseダッシュボード → SQL Editor で `supabase/setup.sql` の内容を実行

#### 1-2. デモユーザー作成
Supabaseダッシュボード → Authentication → Users → "Add user" から3人作成：
| Email | Password | 用途 |
|-------|----------|------|
| farmer@meguru.com | meguru123 | 農家デモ |
| restaurant@meguru.com | meguru123 | 飲食店デモ |
| admin@meguru.com | meguru123 | 管理者デモ |

作成後、各ユーザーのUUIDをコピーして `setup.sql` の末尾のINSERT文を実行

#### 1-3. 環境変数設定
`.env` ファイルを編集：
```
VITE_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```
（SupabaseダッシュボードのSettings → API から取得）

### 2. ローカル起動
```bash
npm install
npm run dev
```

### 3. Vercelデプロイ
```bash
npm install -g vercel
vercel
```
環境変数 `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` をVercelダッシュボードにも設定

## 技術スタック
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (認証 + DB)
- Vercel (ホスティング)

## ユーザーロール
- **農家**: 商品管理、注文対応、配送スケジュール管理、チャット
- **飲食店**: 商品閲覧・注文、継続提案、注文履歴、チャット  
- **管理者**: ユーザー管理、売上管理

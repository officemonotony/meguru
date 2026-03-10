import { useState } from 'react';
import { Calendar, CheckCircle, XCircle, Package, User, Clock } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { SubscriptionProposal } from '@/app/components/ProposalForm';
import { useData } from '@/app/context/DataContext';

interface ProposalListProps {
  onOpenChat?: (restaurantId: string, restaurantName: string) => void;
}

export function ProposalList({ onOpenChat }: ProposalListProps) {
  const { proposals, updateProposal, addActiveSubscription } = useData();
  const [filter, setFilter] = useState<'pending' | 'accepted' | 'rejected'>('pending');

  const filteredProposals = proposals.filter(
    (proposal) => proposal.status === filter
  );

  const handleAccept = (proposalId: string) => {
    updateProposal(proposalId, 'accepted');
    // 提案を承認したら、アクティブな契約として登録
    addActiveSubscription(proposalId);
  };

  const handleReject = (proposalId: string) => {
    if (confirm('この提案を却下してもよろしいですか？')) {
      updateProposal(proposalId, 'rejected');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 -mx-4 -mt-4 mb-4">
        <h2 className="text-lg font-bold text-black mb-1">継続の提案</h2>
        <p className="text-xs text-gray-500">
          飲食店からの継続の提案を確認して、承認または却下できます
        </p>
      </div>

      {/* フィルター */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-all ${
            filter === 'pending'
              ? 'bg-black text-white'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400'
          }`}
        >
          未承認 ({proposals.filter((p) => p.status === 'pending').length})
        </button>
        <button
          onClick={() => setFilter('accepted')}
          className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-all ${
            filter === 'accepted'
              ? 'bg-black text-white'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400'
          }`}
        >
          承認済 ({proposals.filter((p) => p.status === 'accepted').length})
        </button>
      </div>

      {/* 提案一覧 */}
      <div className="space-y-4">
        {filteredProposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            onAccept={handleAccept}
            onReject={handleReject}
            onOpenChat={onOpenChat}
          />
        ))}
      </div>

      {/* 空状態 */}
      {filteredProposals.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh]">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl text-gray-600 font-bold mb-2">
            {filter === 'pending'
              ? '未承認の提案はありません'
              : '承認済みの提案はありません'}
          </p>
          <p className="text-base text-gray-600 mb-6">
            {filter === 'pending'
              ? '飲食店から継続お届けの提案が届くとここに表示されます'
              : '提案を承認すると「契約中」タブに反映されます'}
          </p>
          {filter === 'pending' && (
            <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-5 max-w-sm mx-auto">
              <p className="text-xs font-bold text-gray-700 mb-3">継続お届けの仕組み</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-gray-600 text-left">飲食店が定期的な配送を提案</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-gray-600 text-left">内容を確認して承認または却下</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-black text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-gray-600 text-left">承認すると自動でお届けスケジュールが作成されます</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ProposalCardProps {
  proposal: SubscriptionProposal;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onOpenChat?: (restaurantId: string, restaurantName: string) => void;
}

function ProposalCard({ proposal, onAccept, onReject, onOpenChat }: ProposalCardProps) {
  const statusConfig = {
    pending: { 
      bg: 'bg-yellow-50', 
      border: 'border-yellow-300', 
      text: '承認待ち', 
      textColor: 'text-yellow-700',
      icon: Clock,
    },
    accepted: { 
      bg: 'bg-green-50', 
      border: 'border-green-300', 
      text: '承認済み', 
      textColor: 'text-green-700',
      icon: CheckCircle,
    },
    rejected: { 
      bg: 'bg-gray-50', 
      border: 'border-gray-300', 
      text: '却下', 
      textColor: 'text-gray-700',
      icon: XCircle,
    },
  };

  const config = statusConfig[proposal.status];
  const StatusIcon = config.icon;

  return (
    <div className={`bg-white border-2 ${config.border} rounded-2xl overflow-hidden hover:shadow-lg transition-shadow`}>
      {/* ステータスバー */}
      <div className={`${config.bg} px-5 py-3 border-b-2 ${config.border} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-5 h-5 ${config.textColor}`} />
          <span className={`font-bold ${config.textColor}`}>{config.text}</span>
        </div>
        <span className="text-sm text-gray-600">{proposal.createdAt}</span>
      </div>

      {/* 内容 */}
      <div className="p-4">
        {/* レストラン情報 */}
        <div className="flex items-center gap-3 mb-3 pb-3 border-b-2 border-gray-200">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-black">{proposal.restaurantName}</h3>
            <p className="text-xs text-gray-500">ID: {proposal.restaurantId}</p>
          </div>
          {onOpenChat && proposal.restaurantId && proposal.restaurantName && (
            <Button
              onClick={() => onOpenChat(proposal.restaurantId!, proposal.restaurantName!)}
              variant="outline"
              className="border-2 border-gray-300 rounded-lg px-3 h-9 text-xs font-bold"
            >
              チャットを開く
            </Button>
          )}
        </div>

        {/* 商品情報 */}
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-gray-600" />
            <h4 className="text-base font-bold text-black">{proposal.productName}</h4>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">配送量:</span>
              <span className="font-bold text-black ml-2">
                {proposal.quantity}{proposal.unit} / 回
              </span>
            </div>
            <div>
              <span className="text-gray-600">開始日:</span>
              <span className="font-bold text-black ml-2">
                {proposal.startDate
                  ? new Date(proposal.startDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">終了日:</span>
              <span className="font-bold text-black ml-2">
                {proposal.endDate 
                  ? new Date(proposal.endDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
                  : `${proposal.totalDeliveries}回（${proposal.period}）`}
              </span>
            </div>
            <div>
              <span className="text-gray-600">配送頻度:</span>
              <span className="font-bold text-black ml-2">
                {{ twice_weekly: '週2回', weekly: '週1回', biweekly: '隔週', monthly: '月1回' }[proposal.frequency] || proposal.frequency}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">配送曜日:</span>
              <span className="font-bold text-black ml-2">{proposal.deliveryDay}</span>
            </div>
          </div>
        </div>

        {/* 価格情報 */}
        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3 mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-blue-700">1回あたり:</span>
            <span className="text-lg font-bold text-blue-900">
              {proposal.pricePerDelivery.toLocaleString()}円
            </span>
          </div>
          <div className="flex justify-between items-center border-t-2 border-blue-300 pt-2">
            <span className="text-sm font-bold text-blue-700">合計見積:</span>
            <span className="text-xl font-bold text-blue-900">
              {(proposal.totalAmount ?? 0).toLocaleString()}円
            </span>
          </div>
        </div>

        {/* メッセージ */}
        {proposal.message && (
          <div className="bg-gray-50 rounded-xl p-3 mb-3">
            <p className="text-sm font-bold text-gray-700 mb-2">メッセージ:</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{proposal.message}</p>
          </div>
        )}

        {/* アクションボタン */}
        {proposal.status === 'pending' && (
          <div className="flex gap-3">
            <Button
              onClick={() => onReject(proposal.id)}
              variant="outline"
              className="flex-1 border-2 border-gray-300 rounded-xl h-11 text-sm font-bold hover:bg-gray-50"
            >
              <XCircle className="w-4 h-4 mr-1" />
              却下
            </Button>
            <Button
              onClick={() => onAccept(proposal.id)}
              className="flex-1 bg-green-600 text-white hover:bg-green-700 rounded-xl h-11 text-sm font-bold"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              承認
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
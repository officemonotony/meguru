import { useMemo } from 'react';
import { Truck, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ProductBrowser } from '@/app/components/ProductBrowser';
import { SubscriptionProposal } from '@/app/components/ProposalForm';
import { useData } from '@/app/context/DataContext';

interface DeliveryRequest {
  farmerId: string;
  farmerName: string;
  items: any[];
  deliveryDate: string;
  totalAmount: number;
}

interface OrderTabProps {
  onProposalSubmit?: (proposal: Omit<SubscriptionProposal, 'id' | 'status' | 'createdAt'>) => void;
  onDeliveryRequest?: (request: DeliveryRequest) => void;
}

export function OrderTab({ onProposalSubmit, onDeliveryRequest }: OrderTabProps) {
  const { deliverySchedules } = useData();

  // E: 今日のお届け予定を取得
  const todayStr = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  const todayDeliveries = useMemo(() => {
    return deliverySchedules.filter(
      (d) => d.deliveryDate === todayStr && (d.status === 'approved' || d.status === 'delivered')
    );
  }, [deliverySchedules, todayStr]);

  const handleProposalSubmit = (proposal: Omit<SubscriptionProposal, 'id' | 'status' | 'createdAt'>) => {
    toast.success(`${proposal.farmerName}さんに継続の提案を送信しました`, {
      description: 'チャットで打ち合わせを進めてください',
    });
    if (onProposalSubmit) {
      onProposalSubmit(proposal);
    }
  };

  const handleDeliveryRequest = (request: DeliveryRequest) => {
    if (onDeliveryRequest) {
      onDeliveryRequest(request);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {/* E: 本日のお届け予定カード */}
        {todayDeliveries.length > 0 && (
          <div className="p-4 pb-0">
            <div className="bg-gradient-to-br from-black to-gray-800 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-5 h-5" />
                <h3 className="font-bold text-base">本日のお届け予定</h3>
                <span className="bg-white text-black text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                  {todayDeliveries.length}件
                </span>
              </div>
              <div className="space-y-2">
                {todayDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="bg-white/10 rounded-xl px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{delivery.productName}</p>
                      <p className="text-xs text-gray-300">
                        {delivery.farmerName} ・ {delivery.quantity}{delivery.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                      {delivery.status === 'approved' ? (
                        <>
                          <Clock className="w-3.5 h-3.5 text-blue-300" />
                          <span className="text-xs text-blue-300 font-bold">配達待ち</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-green-300" />
                          <span className="text-xs text-green-300 font-bold">配達済み</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <ProductBrowser
          onProposalSubmit={handleProposalSubmit}
          onDeliveryRequest={handleDeliveryRequest}
        />
      </div>
    </div>
  );
}
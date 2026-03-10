import { FarmerOrdersCalendar } from '@/app/components/FarmerOrdersCalendar';

interface FarmerOrdersProps {
  onOpenChat?: (restaurantId: string, restaurantName: string) => void;
  initialTab?: 'ordered' | 'approved' | 'delivered' | 'paid';
}

export function FarmerOrders({ onOpenChat, initialTab }: FarmerOrdersProps) {
  return <FarmerOrdersCalendar onOpenChat={onOpenChat} initialTab={initialTab} />;
}
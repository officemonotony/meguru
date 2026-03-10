export interface CartItem {
  productId: string
  name: string
  farmerName: string
  farmerId?: string
  unit: string
  price: number
  quantity: number
  deliveryDate: string
  imageUrl?: string
}
export interface SubscriptionProposal {
  id?: string
  restaurantId: string
  restaurantName: string
  farmerId: string
  farmerName: string
  productId: string
  productName: string
  quantity: number
  unit: string
  frequency: 'twice_weekly' | 'weekly' | 'biweekly' | 'monthly'
  deliveryDay: string
  pricePerDelivery: number
  totalDeliveries: number
  startDate: string
  period?: string
  status?: string
  createdAt?: string
  endDate?: string
  totalAmount?: number
  message?: string
}
export interface Message {
  id: string
  text?: string
  sender: 'farmer' | 'restaurant'
  timestamp: string
  type?: string
}
// Re-export ChatMessage fields via Message alias
export interface ProposalData {
  farmerId: string
  farmerName: string
  restaurantId: string
  restaurantName: string
  productId: string
  productName: string
  quantity: number
  unit: string
  frequency: 'twice_weekly' | 'weekly' | 'biweekly' | 'monthly'
  deliveryDay: string
  pricePerDelivery: number
  totalDeliveries: number
  startDate: string
  period?: string
  items?: Array<{ productId: string; productName: string; quantity: number; unit: string; unitPrice: number }>
  deliveryDate?: string
  totalAmount?: number
}
export interface CounterProposalDataFull {
  originalMessageId: string
  items: Array<{ productName: string; originalQuantity: number; proposedQuantity: number; unit: string; unitPrice: number }>
  originalDate: string
  proposedDate: string
  originalAmount: number
  proposedAmount: number
  reason: string
}
export interface SubscriptionCounterData {
  originalProposalId: string
  productName: string
  quantity: { original: number; proposed: number }
  unit: string
  pricePerDelivery: { original: number; proposed: number }
  frequency: string
  deliveryDay: string
  startDate: string
  endDate: string
  totalDeliveries: number
  totalAmount: { original: number; proposed: number }
  reason: string
}

export interface CounterProposalData {
  originalMessageId: string
  items?: Array<{ productName: string; originalQuantity: number; proposedQuantity: number; unit: string; unitPrice: number }>
  originalDate?: string
  proposedDate?: string
  originalAmount?: number
  proposedAmount?: number
  reason?: string
  message?: string
}

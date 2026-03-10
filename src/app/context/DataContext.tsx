import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/context/AuthContext'

// ========== 型定義 ==========
export interface SeasonPeriod {
  month: number
  period: 'early' | 'mid' | 'late'
}

export interface Product {
  id: string
  farmerId: string
  farmerName: string
  name: string
  category: string
  price: number
  unit: string
  stock: number
  description?: string
  imageUrl?: string
  isAvailable: boolean
  isPublished?: boolean
  visibility?: 'public' | 'private'
  visibleTo?: string[]
  seasonStart?: SeasonPeriod
  seasonEnd?: SeasonPeriod
  cropId?: string
  quantityPerUnit?: number
  createdAt?: string
}

export interface DeliverySchedule {
  id: string
  restaurantId: string
  restaurantName: string
  farmerId: string
  farmerName: string
  items: { productName: string; quantity: number; unit: string; price: number }[]
  totalAmount: number
  productName?: string
  quantity?: number
  unit?: string
  price?: number
  orderDate?: string
  deliveryDate: string
  status: 'ordered' | 'approved' | 'delivered' | 'paid'
  createdAt: string
  isSubscription?: boolean
  subscriptionId?: string
}

export interface Proposal {
  id: string
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
  endDate?: string
  period?: string
  totalAmount?: number
  message?: string
  status: 'pending' | 'active' | 'rejected' | 'accepted'
  createdAt: string
}

export interface ActiveSubscription {
  id: string
  restaurantId: string
  restaurantName: string
  farmerId: string
  farmerName: string
  productName: string
  quantity: number
  unit: string
  frequency: string
  deliveryDay: string
  pricePerDelivery: number
  totalDeliveries: number
  startDate: string
  status: 'active' | 'paused' | 'completed'
}

export interface ChatMessage {
  id: string
  text?: string
  sender: 'farmer' | 'restaurant'
  timestamp: string
  type?: 'text' | 'proposal' | 'counterProposal' | 'deliveryRequest' | 'orderApproval' | 'subscriptionCounter'
  proposalData?: Partial<Proposal>
  proposalStatus?: string
  counterProposalData?: {
    originalMessageId: string
    items?: Array<{ productName: string; originalQuantity: number; proposedQuantity: number; unit: string; unitPrice: number }>
    originalDate?: string
    proposedDate?: string
    originalAmount?: number
    proposedAmount?: number
    reason?: string
    message?: string
  }
  subscriptionCounterData?: {
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
}

export interface Chat {
  id: string
  name: string
  lastMessage: string
  timestamp: string
  unread: number
  avatarUrl?: string
  farmerId?: string
  restaurantId?: string
}

export interface Crop {
  id: string
  name: string
  totalStock: number
  unit: string
  imageUrl?: string
}

export const RESTAURANT_INFO = {
  id: '',
  name: '',
  avatarUrl: '',
}

export const REGISTERED_RESTAURANTS: { id: string; name: string }[] = []

export interface DataContextType {
  products: Product[]
  chats: Chat[]
  messages: Record<string, ChatMessage[]>
  deliverySchedules: DeliverySchedule[]
  proposals: Proposal[]
  activeSubscriptions: ActiveSubscription[]
  unreadCounts: Record<string, { farmer: number; restaurant: number }>
  crops: Crop[]
  loading: boolean

  addProduct: (product: Omit<Product, 'id'>) => Promise<void>
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  refreshProducts: () => Promise<void>

  addChat: (chat: Chat) => void
  addMessage: (chatId: string, message: ChatMessage) => void
  markChatAsRead: (chatId: string, role: 'farmer' | 'restaurant') => void
  getTotalUnread: (role: 'farmer' | 'restaurant') => number

  addDeliverySchedule: (schedule: DeliverySchedule) => void
  updateDeliverySchedule: (id: string, updates: Partial<DeliverySchedule>) => void

  addProposal: (proposal: Proposal) => void
  updateProposal: (id: string, status: 'active' | 'accepted' | 'rejected') => void
  addActiveSubscription: (sub: ActiveSubscription | string) => void
  addSubscription: (sub: ActiveSubscription) => void

  getCropRemainingStock: (cropId: string) => number
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [deliverySchedules, setDeliverySchedules] = useState<DeliverySchedule[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [activeSubscriptions, setActiveSubscriptions] = useState<ActiveSubscription[]>([])
  const [crops] = useState<Crop[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, { farmer: number; restaurant: number }>>({})
  const [loading, setLoading] = useState(false)

  // ========== 商品をSupabaseから取得 ==========
  const fetchProducts = async () => {
    if (!user) return
    setLoading(true)
    try {
      let query = supabase
        .from('products')
        .select(`*, profiles!farmer_id(shop_name)`)
        .order('created_at', { ascending: false })

      // 農家は自分の商品のみ
      if (profile?.role === 'farmer') {
        query = query.eq('farmer_id', user.id)
      }

      const { data, error } = await query
      if (error) throw error

      setProducts((data || []).map((p: any) => ({
        id: p.id,
        farmerId: p.farmer_id,
        farmerName: p.profiles?.shop_name || '',
        name: p.name,
        category: p.category,
        price: p.price,
        unit: p.unit,
        stock: p.stock,
        description: p.description,
        imageUrl: p.image_url,
        isAvailable: p.is_available,
        isPublished: p.is_available,
        visibility: 'public' as const,
        createdAt: p.created_at,
      })))
    } catch (e) {
      console.error('商品取得エラー:', e)
    } finally {
      setLoading(false)
    }
  }

  // ========== チャットルームをSupabaseから取得 ==========
  const fetchChats = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`*, farmer:profiles!farmer_id(shop_name), restaurant:profiles!restaurant_id(shop_name)`)
        .or(`farmer_id.eq.${user.id},restaurant_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })

      if (error) throw error

      setChats((data || []).map((c: any) => {
        const isFarmer = profile?.role === 'farmer'
        const otherName = isFarmer ? c.restaurant?.shop_name : c.farmer?.shop_name
        const unread = isFarmer ? c.farmer_unread : c.restaurant_unread
        return {
          id: c.id,
          name: otherName || '不明',
          lastMessage: c.last_message || '',
          timestamp: c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '',
          unread: unread || 0,
          farmerId: c.farmer_id,
          restaurantId: c.restaurant_id,
        }
      }))

      // 未読カウント
      const counts: Record<string, { farmer: number; restaurant: number }> = {}
      ;(data || []).forEach((c: any) => {
        counts[c.id] = { farmer: c.farmer_unread || 0, restaurant: c.restaurant_unread || 0 }
      })
      setUnreadCounts(counts)
    } catch (e) {
      console.error('チャット取得エラー:', e)
    }
  }

  // ========== 注文をSupabaseから取得 ==========
  const fetchOrders = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items(*), restaurant:profiles!restaurant_id(shop_name), farmer:profiles!farmer_id(shop_name)`)
        .or(`restaurant_id.eq.${user.id},farmer_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error

      setDeliverySchedules((data || []).map((o: any) => ({
        id: o.id,
        restaurantId: o.restaurant_id,
        restaurantName: o.restaurant?.shop_name || '',
        farmerId: o.farmer_id,
        farmerName: o.farmer?.shop_name || '',
        items: (o.order_items || []).map((i: any) => ({
          productName: i.product_name,
          quantity: i.quantity,
          unit: i.unit,
          price: i.price,
        })),
        totalAmount: o.total_amount,
        productName: (o.order_items || [])[0]?.product_name,
        quantity: (o.order_items || [])[0]?.quantity,
        unit: (o.order_items || [])[0]?.unit,
        price: o.total_amount,
        deliveryDate: o.delivery_date || '',
        status: o.status,
        createdAt: o.created_at,
      })))
    } catch (e) {
      console.error('注文取得エラー:', e)
    }
  }

  // ========== 継続契約をSupabaseから取得 ==========
  const fetchSubscriptions = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`*, restaurant:profiles!restaurant_id(shop_name), farmer:profiles!farmer_id(shop_name)`)
        .or(`restaurant_id.eq.${user.id},farmer_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error

      const subs = data || []
      // pending → proposals, active → activeSubscriptions
      setProposals(subs.filter((s: any) => s.status === 'pending').map((s: any) => ({
        id: s.id,
        restaurantId: s.restaurant_id,
        restaurantName: s.restaurant?.shop_name || '',
        farmerId: s.farmer_id,
        farmerName: s.farmer?.shop_name || '',
        productId: s.product_id || '',
        productName: s.product_name,
        quantity: s.quantity,
        unit: s.unit,
        frequency: s.frequency,
        deliveryDay: s.delivery_day,
        pricePerDelivery: s.price_per_delivery,
        totalDeliveries: s.total_deliveries,
        startDate: s.start_date,
        status: 'pending' as const,
        createdAt: s.created_at,
      })))

      setActiveSubscriptions(subs.filter((s: any) => s.status === 'active').map((s: any) => ({
        id: s.id,
        restaurantId: s.restaurant_id,
        restaurantName: s.restaurant?.shop_name || '',
        farmerId: s.farmer_id,
        farmerName: s.farmer?.shop_name || '',
        productName: s.product_name,
        quantity: s.quantity,
        unit: s.unit,
        frequency: s.frequency,
        deliveryDay: s.delivery_day,
        pricePerDelivery: s.price_per_delivery,
        totalDeliveries: s.total_deliveries,
        startDate: s.start_date,
        status: 'active' as const,
      })))
    } catch (e) {
      console.error('継続契約取得エラー:', e)
    }
  }

  useEffect(() => {
    if (user && profile) {
      fetchProducts()
      fetchChats()
      fetchOrders()
      fetchSubscriptions()
    } else {
      setProducts([])
      setChats([])
      setMessages({})
      setDeliverySchedules([])
      setProposals([])
      setActiveSubscriptions([])
    }
  }, [user, profile])

  // ========== 商品CRUD ==========
  const addProduct = async (product: Omit<Product, 'id'>) => {
    if (!user) return
    const { error } = await supabase.from('products').insert({
      farmer_id: user.id,
      name: product.name,
      category: product.category,
      price: product.price,
      unit: product.unit,
      stock: product.stock,
      description: product.description,
      image_url: product.imageUrl,
      is_available: product.isAvailable,
    })
    if (error) { console.error(error); return }
    await fetchProducts()
  }

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const { error } = await supabase.from('products').update({
      name: updates.name,
      category: updates.category,
      price: updates.price,
      unit: updates.unit,
      stock: updates.stock,
      description: updates.description,
      image_url: updates.imageUrl,
      is_available: updates.isAvailable,
    }).eq('id', id)
    if (error) { console.error(error); return }
    await fetchProducts()
  }

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { console.error(error); return }
    await fetchProducts()
  }

  const refreshProducts = fetchProducts

  // ========== チャット（ローカル状態管理）==========
  const addChat = (chat: Chat) => {
    setChats(prev => {
      const exists = prev.find(c => c.id === chat.id)
      if (exists) return prev.map(c => c.id === chat.id ? { ...c, ...chat } : c)
      return [...prev, chat]
    })
  }

  const addMessage = (chatId: string, message: ChatMessage) => {
    setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] || []), message] }))
    const receiverRole = message.sender === 'farmer' ? 'restaurant' : 'farmer'
    setUnreadCounts(prev => ({
      ...prev,
      [chatId]: {
        farmer: prev[chatId]?.farmer || 0,
        restaurant: prev[chatId]?.restaurant || 0,
        [receiverRole]: (prev[chatId]?.[receiverRole] || 0) + 1,
      }
    }))
    setChats(prev => prev.map(c => c.id === chatId ? {
      ...c, lastMessage: message.text || '（メッセージ）', timestamp: message.timestamp,
    } : c))
  }

  const markChatAsRead = (chatId: string, role: 'farmer' | 'restaurant') => {
    setUnreadCounts(prev => ({ ...prev, [chatId]: { ...prev[chatId], [role]: 0 } }))
  }

  const getTotalUnread = (role: 'farmer' | 'restaurant') => {
    return Object.values(unreadCounts).reduce((sum, counts) => sum + (counts[role] || 0), 0)
  }

  // ========== 注文（ローカル）==========
  const addDeliverySchedule = (schedule: DeliverySchedule) => {
    setDeliverySchedules(prev => [...prev, schedule])
  }
  const updateDeliverySchedule = (id: string, updates: Partial<DeliverySchedule>) => {
    setDeliverySchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  // ========== 提案（ローカル）==========
  const addProposal = (proposal: Proposal) => {
    setProposals(prev => [...prev, proposal])
  }

  const updateProposal = (id: string, status: 'active' | 'accepted' | 'rejected') => {
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    if (status === 'active' || status === 'accepted') {
      const proposal = proposals.find(p => p.id === id)
      if (proposal) {
        setActiveSubscriptions(prev => [...prev, {
          id: `sub-${id}`,
          restaurantId: proposal.restaurantId,
          restaurantName: proposal.restaurantName,
          farmerId: proposal.farmerId,
          farmerName: proposal.farmerName,
          productName: proposal.productName,
          quantity: proposal.quantity,
          unit: proposal.unit,
          frequency: proposal.frequency,
          deliveryDay: proposal.deliveryDay,
          pricePerDelivery: proposal.pricePerDelivery,
          totalDeliveries: proposal.totalDeliveries,
          startDate: proposal.startDate,
          status: 'active',
        }])
      }
    }
  }

  const addActiveSubscription = (sub: ActiveSubscription | string) => {
    if (typeof sub === 'string') {
      const proposal = proposals.find(p => p.id === sub)
      if (proposal) {
        setActiveSubscriptions(prev => [...prev, {
          id: `sub-${sub}`,
          restaurantId: proposal.restaurantId,
          restaurantName: proposal.restaurantName,
          farmerId: proposal.farmerId,
          farmerName: proposal.farmerName,
          productName: proposal.productName,
          quantity: proposal.quantity,
          unit: proposal.unit,
          frequency: proposal.frequency,
          deliveryDay: proposal.deliveryDay,
          pricePerDelivery: proposal.pricePerDelivery,
          totalDeliveries: proposal.totalDeliveries,
          startDate: proposal.startDate,
          status: 'active',
        }])
      }
    } else {
      setActiveSubscriptions(prev => [...prev, sub])
    }
  }

  const getCropRemainingStock = (cropId: string): number => {
    const crop = crops.find(c => c.id === cropId)
    if (!crop) return 0
    const allocated = products
      .filter(p => p.cropId === cropId)
      .reduce((sum, p) => sum + p.stock * (p.quantityPerUnit || 1), 0)
    return crop.totalStock - allocated
  }

  return (
    <DataContext.Provider value={{
      products, chats, messages, deliverySchedules, proposals, activeSubscriptions, unreadCounts, crops, loading,
      addProduct, updateProduct, deleteProduct, refreshProducts,
      addChat, addMessage, markChatAsRead, getTotalUnread,
      addDeliverySchedule, updateDeliverySchedule,
      addProposal, updateProposal,
      addActiveSubscription,
      addSubscription: (sub: ActiveSubscription) => addActiveSubscription(sub),
      getCropRemainingStock,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used within DataProvider')
  return context
}

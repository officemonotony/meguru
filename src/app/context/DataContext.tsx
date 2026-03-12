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

export interface HarvestLog {
  id: string
  type: 'initial' | 'additional'
  quantity: number
  memo?: string
  createdAt: string
}

export interface Crop {
  id: string
  name: string
  totalStock: number
  unit: string
  imageUrl?: string
  memo?: string
  harvestLogs: HarvestLog[]
  createdAt: string
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

  addChat: (chat: Chat) => Promise<string | null>
  addMessage: (chatId: string, message: ChatMessage) => Promise<void>
  fetchMessages: (chatId: string) => Promise<void>
  markChatAsRead: (chatId: string, role: 'farmer' | 'restaurant') => void
  getTotalUnread: (role: 'farmer' | 'restaurant') => number

  addDeliverySchedule: (schedule: DeliverySchedule) => Promise<void>
  updateDeliverySchedule: (id: string, updates: Partial<DeliverySchedule>) => Promise<void>

  addProposal: (proposal: Proposal) => void
  updateProposal: (id: string, status: 'active' | 'accepted' | 'rejected') => void
  addActiveSubscription: (sub: ActiveSubscription | string) => void
  addSubscription: (sub: ActiveSubscription) => void

  getCropRemainingStock: (cropId: string) => number
  addCrop: (crop: Omit<Crop, 'id' | 'harvestLogs' | 'createdAt'>) => Promise<void>
  updateCrop: (id: string, updates: Partial<Crop>) => Promise<void>
  deleteCrop: (id: string) => Promise<void>
  addHarvestLog: (cropId: string, quantity: number, memo?: string) => Promise<void>
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
  const [crops, setCrops] = useState<Crop[]>([])
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

  // ========== 収穫データをSupabaseから取得 ==========
  const fetchCrops = async () => {
    if (!user) return
    try {
      const { data: cropsData, error: cropsError } = await supabase
        .from('crops')
        .select('*, harvest_logs(*)')
        .eq('farmer_id', user.id)
        .order('created_at', { ascending: false })

      if (cropsError) throw cropsError

      setCrops((cropsData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        totalStock: c.total_stock,
        unit: c.unit,
        imageUrl: c.image_url,
        memo: c.memo,
        createdAt: c.created_at,
        harvestLogs: (c.harvest_logs || []).map((l: any) => ({
          id: l.id,
          type: l.type,
          quantity: l.quantity,
          memo: l.memo,
          createdAt: l.created_at,
        })),
      })))
    } catch (e) {
      console.error('収穫データ取得エラー:', e)
    }
  }

  // ========== メッセージをSupabaseから取得 ==========
  const fetchMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_room_id', chatId)
        .order('created_at', { ascending: true })

      if (error) throw error

      const mapped: ChatMessage[] = (data || []).map((m: any) => ({
        id: m.id,
        text: m.text,
        sender: m.sender_role as 'farmer' | 'restaurant',
        timestamp: new Date(m.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        type: m.type,
        proposalData: m.metadata?.proposalData,
        proposalStatus: m.metadata?.proposalStatus,
        counterProposalData: m.metadata?.counterProposalData,
        subscriptionCounterData: m.metadata?.subscriptionCounterData,
      }))
      setMessages(prev => ({ ...prev, [chatId]: mapped }))
    } catch (e) {
      console.error('メッセージ取得エラー:', e)
    }
  }

  useEffect(() => {
    if (user && profile) {
      fetchProducts()
      fetchChats()
      fetchOrders()
      fetchSubscriptions()
      if (profile.role === 'farmer') fetchCrops()
    } else {
      setProducts([])
      setChats([])
      setMessages({})
      setDeliverySchedules([])
      setProposals([])
      setActiveSubscriptions([])
      setCrops([])
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

  // ========== チャット（Supabase連携）==========
  const addChat = async (chat: Chat): Promise<string | null> => {
    if (user && chat.farmerId && chat.restaurantId) {
      // 既存チャットルームを確認
      const { data: existing } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('farmer_id', chat.farmerId)
        .eq('restaurant_id', chat.restaurantId)
        .single()

      if (existing) {
        setChats(prev => {
          const exists = prev.find(c => c.id === existing.id)
          if (exists) return prev
          return [...prev, { ...chat, id: existing.id }]
        })
        return existing.id
      }

      const { data, error } = await supabase.from('chat_rooms').insert({
        farmer_id: chat.farmerId,
        restaurant_id: chat.restaurantId,
        last_message: chat.lastMessage,
        last_message_at: new Date().toISOString(),
      }).select().single()

      if (error) { console.error('チャット作成エラー:', error); return null }

      const realId = data.id
      setChats(prev => [...prev, { ...chat, id: realId }])
      return realId
    }

    // ローカルのみ（farmerId/restaurantIdがない場合）
    setChats(prev => {
      const exists = prev.find(c => c.id === chat.id)
      if (exists) return prev
      return [...prev, chat]
    })
    return chat.id
  }

  const addMessage = async (chatId: string, message: ChatMessage) => {
    // 楽観的ローカル更新
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
    const lastMsg = message.text || '（メッセージ）'
    setChats(prev => prev.map(c => c.id === chatId ? {
      ...c, lastMessage: lastMsg, timestamp: message.timestamp,
    } : c))

    // Supabase書き込み（chatIdがUUIDの場合のみ有効）
    if (user) {
      const validTypes = ['text', 'proposal', 'counterProposal', 'deliveryRequest', 'orderApproval', 'subscriptionCounter']
      const msgType = validTypes.includes(message.type || '') ? message.type : 'text'
      const { error } = await supabase.from('messages').insert({
        chat_room_id: chatId,
        sender_id: user.id,
        sender_role: message.sender,
        text: message.text,
        type: msgType,
        metadata: {
          proposalData: message.proposalData,
          proposalStatus: message.proposalStatus,
          counterProposalData: message.counterProposalData,
          subscriptionCounterData: message.subscriptionCounterData,
        },
      })
      if (error) console.error('メッセージ保存エラー:', error)
      else {
        const unreadField = receiverRole === 'farmer' ? 'farmer_unread' : 'restaurant_unread'
        const newCount = (unreadCounts[chatId]?.[receiverRole] || 0) + 1
        await supabase.from('chat_rooms').update({
          last_message: lastMsg,
          last_message_at: new Date().toISOString(),
          [unreadField]: newCount,
        }).eq('id', chatId)
      }
    }
  }

  const markChatAsRead = (chatId: string, role: 'farmer' | 'restaurant') => {
    setUnreadCounts(prev => ({ ...prev, [chatId]: { ...prev[chatId], [role]: 0 } }))
    if (user) {
      const unreadField = role === 'farmer' ? 'farmer_unread' : 'restaurant_unread'
      supabase.from('chat_rooms').update({ [unreadField]: 0 }).eq('id', chatId)
        .then(({ error }) => { if (error) console.error('既読更新エラー:', error) })
    }
  }

  const getTotalUnread = (role: 'farmer' | 'restaurant') => {
    return Object.values(unreadCounts).reduce((sum, counts) => sum + (counts[role] || 0), 0)
  }

  // ========== 注文（Supabase連携）==========
  const addDeliverySchedule = async (schedule: DeliverySchedule) => {
    setDeliverySchedules(prev => [...prev, schedule])
    if (!user) return
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          restaurant_id: schedule.restaurantId || user.id,
          farmer_id: schedule.farmerId,
          status: schedule.status,
          total_amount: schedule.totalAmount || schedule.price || 0,
          delivery_date: schedule.deliveryDate || null,
        })
        .select()
        .single()
      if (orderError) { console.error('注文保存エラー:', orderError); return }

      const items = schedule.items?.length
        ? schedule.items
        : [{ productName: schedule.productName || '', quantity: schedule.quantity || 0, unit: schedule.unit || '', price: schedule.price || 0 }]

      const { error: itemsError } = await supabase.from('order_items').insert(
        items.map(item => ({
          order_id: orderData.id,
          product_name: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
        }))
      )
      if (itemsError) console.error('注文明細保存エラー:', itemsError)
      else {
        // ローカルIDをSupabaseのUUIDで更新
        setDeliverySchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, id: orderData.id } : s))
      }
    } catch (e) {
      console.error('注文保存エラー:', e)
    }
  }

  const updateDeliverySchedule = async (id: string, updates: Partial<DeliverySchedule>) => {
    setDeliverySchedules(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    if (!user) return
    const { error } = await supabase.from('orders').update({
      status: updates.status,
      delivery_date: updates.deliveryDate,
      total_amount: updates.totalAmount,
    }).eq('id', id)
    if (error) console.error('注文更新エラー:', error)
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

  const addCrop = async (cropData: Omit<Crop, 'id' | 'harvestLogs' | 'createdAt'>) => {
    if (!user) return
    const { data: cropRow, error: cropError } = await supabase
      .from('crops')
      .insert({
        farmer_id: user.id,
        name: cropData.name,
        total_stock: cropData.totalStock,
        unit: cropData.unit,
        image_url: cropData.imageUrl,
        memo: cropData.memo,
      })
      .select()
      .single()
    if (cropError) { console.error('収穫データ保存エラー:', cropError); return }

    const { data: logRow, error: logError } = await supabase
      .from('harvest_logs')
      .insert({
        crop_id: cropRow.id,
        farmer_id: user.id,
        type: 'initial',
        quantity: cropData.totalStock,
        memo: cropData.memo,
      })
      .select()
      .single()
    if (logError) console.error('収穫ログ保存エラー:', logError)

    const newCrop: Crop = {
      ...cropData,
      id: cropRow.id,
      harvestLogs: logRow ? [{
        id: logRow.id,
        type: 'initial',
        quantity: cropData.totalStock,
        memo: cropData.memo,
        createdAt: logRow.created_at,
      }] : [],
      createdAt: cropRow.created_at,
    }
    setCrops(prev => [newCrop, ...prev])
  }

  const updateCrop = async (id: string, updates: Partial<Crop>) => {
    setCrops(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    if (!user) return
    const { error } = await supabase.from('crops').update({
      name: updates.name,
      total_stock: updates.totalStock,
      unit: updates.unit,
      image_url: updates.imageUrl,
      memo: updates.memo,
    }).eq('id', id)
    if (error) console.error('収穫データ更新エラー:', error)
  }

  const deleteCrop = async (id: string) => {
    const linked = products.some(p => p.cropId === id)
    if (linked) throw new Error('この作物に紐づく商品があります')
    setCrops(prev => prev.filter(c => c.id !== id))
    if (!user) return
    const { error } = await supabase.from('crops').delete().eq('id', id)
    if (error) console.error('収穫データ削除エラー:', error)
  }

  const addHarvestLog = async (cropId: string, quantity: number, memo?: string) => {
    const now = new Date().toISOString()
    // 楽観的ローカル更新
    const tempLog: HarvestLog = {
      id: `log-${Date.now()}`,
      type: 'additional',
      quantity,
      memo,
      createdAt: now,
    }
    setCrops(prev => prev.map(c => c.id === cropId ? {
      ...c,
      totalStock: c.totalStock + quantity,
      harvestLogs: [...c.harvestLogs, tempLog],
    } : c))

    if (!user) return
    const newTotal = (crops.find(c => c.id === cropId)?.totalStock || 0) + quantity
    const { data: logRow, error: logError } = await supabase
      .from('harvest_logs')
      .insert({ crop_id: cropId, farmer_id: user.id, type: 'additional', quantity, memo })
      .select()
      .single()
    if (logError) { console.error('収穫ログ保存エラー:', logError); return }

    const { error: cropError } = await supabase
      .from('crops')
      .update({ total_stock: newTotal })
      .eq('id', cropId)
    if (cropError) { console.error('収穫量更新エラー:', cropError); return }

    // tempIDをSupabase UUIDで置き換え
    setCrops(prev => prev.map(c => c.id === cropId ? {
      ...c,
      harvestLogs: c.harvestLogs.map(l => l.id === tempLog.id ? { ...l, id: logRow.id, createdAt: logRow.created_at } : l),
    } : c))
  }

  return (
    <DataContext.Provider value={{
      products, chats, messages, deliverySchedules, proposals, activeSubscriptions, unreadCounts, crops, loading,
      addProduct, updateProduct, deleteProduct, refreshProducts,
      addChat, addMessage, fetchMessages, markChatAsRead, getTotalUnread,
      addDeliverySchedule, updateDeliverySchedule,
      addProposal, updateProposal,
      addActiveSubscription,
      addSubscription: (sub: ActiveSubscription) => addActiveSubscription(sub),
      getCropRemainingStock, addCrop, updateCrop, deleteCrop, addHarvestLog,
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

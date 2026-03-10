import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          role: 'farmer' | 'restaurant' | 'admin'
          shop_name: string
          representative_name: string | null
          address: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      products: {
        Row: {
          id: string
          farmer_id: string
          name: string
          category: string
          price: number
          unit: string
          stock: number
          description: string | null
          image_url: string | null
          is_available: boolean
          created_at: string
        }
      }
      orders: {
        Row: {
          id: string
          restaurant_id: string
          farmer_id: string
          status: 'ordered' | 'approved' | 'delivered' | 'paid'
          total_amount: number
          delivery_date: string | null
          created_at: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit: string
          price: number
        }
      }
      subscriptions: {
        Row: {
          id: string
          restaurant_id: string
          farmer_id: string
          product_id: string
          product_name: string
          quantity: number
          unit: string
          frequency: 'twice_weekly' | 'weekly' | 'biweekly' | 'monthly'
          delivery_day: string
          price_per_delivery: number
          total_deliveries: number
          start_date: string
          status: 'pending' | 'active' | 'paused' | 'completed' | 'rejected'
          created_at: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string
          sender_role: 'farmer' | 'restaurant'
          text: string | null
          type: 'text' | 'proposal' | 'counterProposal' | 'deliveryRequest' | 'orderApproval'
          metadata: Record<string, unknown> | null
          read_by_farmer: boolean
          read_by_restaurant: boolean
          created_at: string
        }
      }
    }
  }
}

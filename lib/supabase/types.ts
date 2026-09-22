export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      catalog_products: {
        Row: {
          id: string;
          slug: string;
          brand: string;
          name: string;
          category: string;
          short_description: string | null;
          is_published: boolean;
          sort_order: number;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      catalog_skus: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          name: string;
          category_label: string;
          public_reference_price_idr: number | null;
          shade_code: string | null;
          tone: string;
          badge: string | null;
          is_active: boolean;
          sort_order: number;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      pricing_tiers: {
        Row: {
          id: string;
          code: string;
          name: string;
          minimum_lifetime_spend_idr: number;
          minimum_paid_order_count: number;
          price_visibility: 'standard' | 'premium_b2b';
          is_active: boolean;
          sort_order: number;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      catalog_sku_prices: {
        Row: {
          id: string;
          sku_id: string;
          pricing_tier_id: string;
          unit_price_idr: number;
          effective_from: string;
          effective_until: string | null;
          is_active: boolean;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      customer_profiles: {
        Row: {
          id: string;
          pricing_tier_id: string | null;
          lifetime_paid_amount_idr: number;
          paid_order_count: number;
          status: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      admin_memberships: {
        Row: {
          user_id: string;
          role: 'owner' | 'catalog_manager' | 'orders_manager' | 'support';
          is_active: boolean;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      commerce_orders: {
        Row: {
          id: string;
          customer_id: string | null;
          account_id: string | null;
          source_channel: string;
          status: string;
          payment_status: string;
          fulfillment_status: string;
          total_idr: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      admin_notifications: {
        Row: {
          id: string;
          notification_type: string;
          title: string;
          body: string;
          order_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

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
          display_name: string | null;
          business_name: string | null;
          business_type: string | null;
          whatsapp: string | null;
          phone: string | null;
          address: string | null;
          studio_type: string | null;
          additional_info: string | null;
          avatar_url: string | null;
          pricing_tier_id: string | null;
          lifetime_paid_amount_idr: number;
          paid_order_count: number;
          status: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      commerce_promotions: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          promotion_type: 'new_user' | 'repeat_order' | 'bundle' | 'seasonal' | 'custom_voucher';
          audience_type: 'all' | 'new_user' | 'repeat_customer' | 'pricing_tier' | 'custom_customer';
          discount_type: 'percentage' | 'fixed_amount' | 'fixed_price' | 'free_shipping';
          discount_value: number;
          bundle_price_idr: number | null;
          minimum_order_amount_idr: number;
          minimum_item_quantity: number;
          repeat_order_min_count: number;
          voucher_code: string | null;
          usage_limit: number | null;
          usage_limit_per_customer: number | null;
          usage_count: number;
          starts_at: string;
          ends_at: string | null;
          status: 'draft' | 'scheduled' | 'active' | 'paused' | 'expired';
          is_stackable: boolean;
          is_active: boolean;
          metadata: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      promotion_eligible_customers: {
        Row: { promotion_id: string; customer_id: string; usage_limit: number | null; usage_count: number; created_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      catalog_brands: {
        Row: { id: string; slug: string; name: string; tagline: string | null; description: string | null; visual_tone: 'clay' | 'ivory' | 'plum' | 'champagne'; is_published: boolean; sort_order: number; created_at: string; updated_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      commerce_packages: {
        Row: { id: string; brand_id: string; slug: string; title: string; audience: 'home-studio' | 'salon' | 'restock'; description: string; long_description: string | null; price_idr: number; compare_at_price_idr: number | null; badge: string | null; visual_tone: 'clay' | 'ivory' | 'plum'; delivery_note: string | null; status: 'draft' | 'published' | 'archived'; sort_order: number; created_at: string; updated_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      commerce_package_items: {
        Row: { id: string; package_id: string; sku_id: string; item_name_snapshot: string; item_note: string | null; quantity: number; sort_order: number; created_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      commerce_package_prices: {
        Row: { id: string; package_id: string; pricing_tier_id: string; unit_price_idr: number; effective_from: string; effective_until: string | null; is_active: boolean; created_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      inventory_locations: {
        Row: { id: string; code: string; name: string; is_active: boolean; created_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      inventory_stock: {
        Row: { id: string; location_id: string; sku_id: string; on_hand_quantity: number; reserved_quantity: number; reorder_point: number; updated_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      inventory_movements: {
        Row: { id: string; location_id: string; sku_id: string; movement_type: 'receiving' | 'adjustment' | 'reservation' | 'release' | 'fulfillment' | 'return'; quantity_delta: number; reason: string | null; order_id: string | null; created_by: string | null; created_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      commerce_store_settings: {
        Row: { key: 'whatsapp'; value: Json; is_public: boolean; updated_by: string | null; updated_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      loyalty_program_settings: {
        Row: { key: 'default'; standard_rate_bps: number; premium_rate_bps: number; reward_type: 'free_product'; cash_out_allowed: boolean; order_discount_allowed: boolean; is_active: boolean; updated_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      loyalty_accounts: {
        Row: { customer_id: string; pricing_tier_id: string | null; tier_code: string; cashback_rate_bps: number; available_points: number; lifetime_earned_points: number; lifetime_redeemed_points: number; updated_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      loyalty_redemptions: {
        Row: { id: string; customer_id: string; order_id: string; sku_id: string | null; points_redeemed: number; reward_points_cost: number; status: 'pending' | 'applied' | 'reversed'; created_at: string; applied_at: string | null; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      loyalty_ledger: {
        Row: { id: string; customer_id: string; order_id: string | null; redemption_id: string | null; entry_type: 'earn' | 'redeem' | 'reversal' | 'adjustment' | 'expire'; points_delta: number; points_type: 'free_product'; description: string; created_at: string; };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      admin_memberships: {
        Row: {
          user_id: string;
          role: 'owner' | 'catalog_manager' | 'orders_manager' | 'support';
          permissions: Record<string, boolean>;
          created_at: string;
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
      Functions: {
        get_admin_memberships: {
          Args: Record<string, never>;
          Returns: { user_id: string; email: string | null; display_name: string; avatar_url: string | null; role: string; permissions: Json; is_active: boolean; created_at: string; }[];
        };
        upsert_admin_membership_by_email: {
          Args: { p_email: string; p_role: string; p_permissions: Json; };
          Returns: undefined;
        };
        cancel_checkout_order: { Args: { p_order_id: string; }; Returns: Json; };
        create_checkout_order: { Args: { p_package_slug: string; p_quantity: number; p_address_id: string; p_customer_notes?: string | null; p_promotion_code?: string | null; p_shipping_method?: string; p_shipping_provider?: string | null; p_reward_sku_id?: string | null; p_reward_points?: number; p_idempotency_key?: string | null; }; Returns: Json; };
        set_admin_membership_status: {
          Args: { p_user_id: string; p_is_active: boolean; };
          Returns: undefined;
        };
      };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

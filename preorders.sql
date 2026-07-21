-- 1. Preorders Table (บิลสั่งทำล่วงหน้า)
CREATE TABLE preorders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  pickup_date timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Preorder Items (รายการสินค้าในพรีออร์เดอร์)
CREATE TABLE preorder_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  preorder_id uuid REFERENCES preorders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  price_at_time numeric(10,2) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ปิดระบบรักษาความปลอดภัย (RLS) เพื่อให้ทดสอบเพิ่มข้อมูลได้
ALTER TABLE preorders DISABLE ROW LEVEL SECURITY;
ALTER TABLE preorder_items DISABLE ROW LEVEL SECURITY;

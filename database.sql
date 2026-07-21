-- Schema for PinkMilk POS

-- 1. Units Table (หน่วยวัด)
CREATE TABLE units (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ingredients Table (วัตถุดิบ)
CREATE TABLE ingredients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  cost_per_unit numeric(10,2) NOT NULL DEFAULT 0, -- ต้นทุนต่อ 1 หน่วย
  stock_quantity numeric(10,2) NOT NULL DEFAULT 0, -- จำนวนคงเหลือ
  unit_id uuid REFERENCES units(id) ON DELETE RESTRICT,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Products / Cake Menu (เมนูเค้ก)
CREATE TABLE products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  suggested_price numeric(10,2) NOT NULL DEFAULT 0, -- ราคาแนะนำจากต้นทุน
  selling_price numeric(10,2) NOT NULL DEFAULT 0, -- ราคาขายจริง
  image_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Product Ingredients / Recipe (สูตรเค้ก)
CREATE TABLE product_ingredients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_used numeric(10,2) NOT NULL, -- จำนวนที่ใช้ต่อการทำ 1 ชิ้น
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(product_id, ingredient_id)
);

-- 5. Sales (การขาย)
CREATE TABLE sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Sale Items (รายการขาย)
CREATE TABLE sale_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  price_at_time numeric(10,2) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Transactions (รายรับ-รายจ่าย)
CREATE TABLE transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount numeric(10,2) NOT NULL,
  description text,
  reference_id uuid, -- สามารถโยงกับ sale_id หรืออย่างอื่นได้
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert Default Units
INSERT INTO units (name) VALUES 
('กรัม (g)'),
('มิลลิกรัม (mg)'),
('กิโลกรัม (kg)'),
('มิลลิลิตร (ml)'),
('ลิตร (l)'),
('ชิ้น'),
('ฟอง');

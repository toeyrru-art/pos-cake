-- 1. เพิ่มคอลัมน์ slip_url ในตาราง preorders
ALTER TABLE preorders ADD COLUMN IF NOT EXISTS slip_url text;

-- 2. สร้าง Storage Bucket ชื่อ 'slips' สำหรับเก็บรูปสลิป
INSERT INTO storage.buckets (id, name, public) 
VALUES ('slips', 'slips', true)
ON CONFLICT (id) DO NOTHING;

-- 3. เปิดสิทธิ์ให้ทุกคนสามารถอัปโหลดรูปและดูรูปได้ (สำหรับ Prototype)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'slips' );

CREATE POLICY "Public Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'slips' );

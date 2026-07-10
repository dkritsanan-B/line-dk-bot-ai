-- ============================================================
-- Agency OS — โครงตารางฐานข้อมูล (Supabase / Postgres)
-- ร้านดีเค สตีลแอนด์ทูลส์
-- วิธีใช้: ก๊อปทั้งไฟล์ไปวางใน Supabase → SQL Editor → กด Run
-- ============================================================

-- ---------- 1) ตารางสินค้า ----------
create table if not exists products (
  id           bigint generated always as identity primary key,
  category     text not null,              -- หมวด: เหล็ก / เมทัลชีท / เครื่องมือช่าง ฯลฯ
  name         text not null,              -- ชื่อสินค้า
  unit         text,                       -- หน่วย: เส้น / แผ่น / ตัว / เมตร
  price        numeric,                    -- ราคาปกติ (ว่างได้ ถ้าไม่ลงราคา)
  sale_price   numeric,                    -- ราคาโปร (ใส่เฉพาะช่วงโปร)
  is_focus     boolean default false,      -- ⭐ สินค้าที่อยากดันเป็นพิเศษ
  selling_point text,                      -- จุดขาย
  target       text,                       -- กลุ่มลูกค้าหลัก
  in_stock     boolean default true,       -- มีของไหม
  image_url    text,                       -- ลิงก์รูป (จาก Backblaze B2)
  notes        text,
  updated_at   timestamptz default now()
);

-- ---------- 2) ตารางโปรโมชัน ----------
create table if not exists promotions (
  id          bigint generated always as identity primary key,
  title       text not null,               -- ชื่อโปร
  detail      text,                        -- รายละเอียด/ของแถม
  duration    text,                        -- 1 วัน / 3 วัน / 7 วัน
  start_date  date,
  end_date    date,
  theme       text,                        -- ธีม: หน้าฝน / รับเหมา ฯลฯ
  result_note text,                        -- ผลตอบรับ (เติมหลังจบโปร)
  created_at  timestamptz default now()
);

-- ---------- 3) ข้อมูลติดต่อ (แถวเดียว) ----------
create table if not exists contact_info (
  id           bigint generated always as identity primary key,
  line_id      text,
  line_url     text,
  facebook_url text,
  phone        text,
  address      text,
  hours        text,
  logo_url     text,
  updated_at   timestamptz default now()
);

-- ============================================================
-- ข้อมูลเริ่มต้น (seed) — สินค้าที่เราคุยกันไว้
-- ============================================================
insert into products (category, name, unit, is_focus, selling_point, target) values
  ('เหล็ก', 'เหล็กเส้น',                'เส้น',  true,  'ครบทุกขนาด สต๊อกเยอะ ราคาส่ง', 'ผู้รับเหมา, โรงงาน'),
  ('เหล็ก', 'เหล็กรูปพรรณ',            'เส้น',  true,  'โครงสร้างงานใหญ่',             'ผู้รับเหมา, โรงงาน'),
  ('เหล็ก', 'เหล็กกล่องชุบกัลวาไนซ์',  'เส้น',  true,  'ทนสนิม เหมาะงานกลางแจ้ง',      'ผู้รับเหมา, เจ้าของบ้าน'),
  ('เหล็ก', 'เหล็กแผ่น',                'แผ่น',  true,  null,                           'โรงงาน, ช่าง'),
  ('เหล็ก', 'เหล็กฉาก',                'เส้น',  true,  'งานโครง งาน DIY',              'ช่าง, เจ้าของบ้าน'),
  ('เหล็ก', 'เหล็กรางน้ำ',             'เส้น',  true,  null,                           'ผู้รับเหมา'),
  ('เมทัลชีท', 'แผ่นหลังคาเมทัลชีท',   'แผ่น',  true,  'ตัดตามขนาด สีให้เลือก',        'เจ้าของบ้าน, ผู้รับเหมา'),
  ('เมทัลชีท', 'ตะแกรงเทพื้น',         'แผ่น',  false, 'งานพื้นคอนกรีต',               'ผู้รับเหมา'),
  ('เครื่องมือช่าง', 'เครื่องเจียร์',   'ตัว',   true,  'แบรนด์ให้เลือก',               'ช่าง'),
  ('เครื่องมือช่าง', 'สว่าน',           'ตัว',   true,  null,                           'ช่าง'),
  ('เครื่องมือช่าง', 'แท่นตัดไฟเบอร์',  'ตัว',   true,  null,                           'ช่าง'),
  ('เครื่องมือช่าง', 'ตู้เชื่อม',       'ตัว',   true,  null,                           'ช่าง'),
  ('ไฟฟ้า/ปั๊ม', 'ปั๊มน้ำ',            'ตัว',   false, null,                           'เจ้าของบ้าน'),
  ('ไฟฟ้า/ปั๊ม', 'มอเตอร์',            'ตัว',   false, null,                           'โรงงาน, ช่าง'),
  ('งานไม้/ประตู', 'ไม้ฝาเฌอร่า',      'แผ่น',  false, null,                           'เจ้าของบ้าน'),
  ('งานไม้/ประตู', 'เฌอร่าบอร์ด',      'แผ่น',  false, null,                           'เจ้าของบ้าน');

-- ข้อมูลติดต่อ (แถวเปล่า ไว้ให้กรอกทีหลังใน Table Editor)
insert into contact_info (line_id, line_url, facebook_url, phone, address, hours)
values (null, null, null, null, 'นาโพธิ์', null);

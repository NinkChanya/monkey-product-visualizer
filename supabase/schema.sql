create extension if not exists pgcrypto;
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(), sku text unique not null, name text not null, category text not null,
  description text, color text, texture text, image_url text, price numeric(12,2), lead_time_days integer,
  tags text[] default '{}', is_active boolean default true, created_at timestamptz default now()
);
alter table public.materials enable row level security;
insert into public.materials (sku,name,category,description,color,texture,price,lead_time_days,tags) values
('MAT-OAK-001','Natural Oak Veneer','พื้น / เฟอร์นิเจอร์','ไม้โอ๊คอ่อนสำหรับโต๊ะและชั้นวาง','Light Oak','ไม้เสี้ยนธรรมชาติ',850,21,array['oak','wood','warm','natural']),
('MAT-WHT-001','Warm White Matte','ผนัง','สีทาผนังขาวอุ่น ผิวด้าน','Warm White','matte paint',320,7,array['white','cream','wall','matte']),
('MAT-SAGE-001','Sage Green Fabric','Accent','ผ้าบุหรือฉากตกแต่งโทนเขียวหม่น','Sage Green','fabric',620,14,array['green','sage','fabric','soft']),
('MAT-KRF-001','Natural Kraft Board','บรรจุภัณฑ์','กระดาษคราฟต์สำหรับกล่องสินค้า','Kraft Brown','paper fiber',180,10,array['kraft','paper','box','brown'])
on conflict (sku) do nothing;

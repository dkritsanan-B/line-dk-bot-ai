# 🔌 แหล่งข้อมูลสด (Live Data Source)

> **สำคัญ:** ข้อมูลสินค้า/ราคา/โปร/ช่องทางติดต่อ **ของจริง** ไม่ได้อยู่ในไฟล์ markdown อีกต่อไป
> แต่อยู่ใน **Supabase** และดึงผ่าน API ด้านล่าง — ทุกแผนกต้อง **ดึงข้อมูลสดก่อนทำงานเสมอ**

## 🌐 Endpoint
| สภาพแวดล้อม | URL |
|-------------|-----|
| ทดสอบในเครื่อง (dev) | `http://localhost:3000/api/catalog` |
| ใช้งานจริง (Vercel) | `https://<โดเมน-vercel-ของคุณ>/api/catalog` *(เติมเมื่อ deploy)* |

## 📦 ข้อมูลที่ได้ (JSON)
```
{
  "products":   [ { id, category, name, unit, price, sale_price,
                    is_focus, selling_point, target, in_stock, image_url } ],
  "promotions": [ { id, title, detail, duration, start_date, end_date, theme } ],
  "contact":    { line_id, line_url, facebook_url, phone, address, hours, logo_url },
  "count":      { products, promotions }
}
```

## 📋 กติกาการใช้
1. **ดึงข้อมูลสดทุกครั้ง** ก่อนวางกลยุทธ์/ทำคอนเทนต์ — อย่าเดาราคา/สินค้าเอง
2. `image_url` = **ลิงก์ชั่วคราว (หมดอายุใน 7 วัน)** — ใช้ทันที ไม่ต้องเก็บถาวร ถ้าจะใช้ซ้ำให้ดึงใหม่
3. `is_focus: true` = สินค้าที่อยากดันเป็นพิเศษ (⭐ เหล็ก/เมทัลชีท/เครื่องมือช่าง) — ให้ความสำคัญก่อน
4. `price` ว่าง = ยังไม่ลงราคา → อย่าเดาราคาเอง ให้ลูกค้าทัก LINE ถามแทน
5. `sale_price` มีค่า = สินค้ากำลังจัดโปร

## 🖼️ วิธีจัดการรูป
- อัพรูปสินค้า: เปิดหน้า `/admin/catalog` (ใส่รหัสแอดมิน)
- แก้ข้อมูล/ราคา: Supabase → Table Editor → ตาราง `products`

## ⚠️ สิ่งที่ยังต้องเติม
- [ ] ราคาสินค้าโฟกัส (ในตาราง `products`)
- [ ] ช่องทางติดต่อ LINE/เพจ/เบอร์ (ในตาราง `contact_info`)
- [ ] รูปสินค้าโฟกัสให้ครบ

# Vista Dashboard

ตัวอย่างแดชบอร์ดหน้าเดียวที่แยกส่วน UI, use case และ HTTP adapter เพื่อให้แก้ไขแต่ละส่วนได้โดยไม่ปะปนกัน

## โครงสร้าง

- `src/Vista.Web/` — หน้า HTML, CSS และ JavaScript ของแดชบอร์ด
- `src/Vista.Web/data/products.json` — ข้อมูลสินค้าแบบย่อที่หน้าเว็บอ่าน
- `src/Vista.DataImport/Program.cs` — อ่านคอลัมน์ที่ใช้จาก Excel แล้วสร้าง JSON
- `src/Vista.Server/Application/` — use case สำหรับข้อมูลผู้ใช้ Windows
- `src/Vista.Server/Infrastructure/Http/` — เส้นทาง HTTP, การส่งไฟล์ UI และ API
- `src/Vista.Server/Program.cs` — จุดเริ่มต้น ประกอบส่วนต่าง ๆ และตั้งค่า Windows Authentication
- `run.cmd` — สร้างข้อมูลจาก workbook, คอมไพล์ และเริ่มเว็บเซิร์ฟเวอร์

## ข้อมูลสินค้า

ใช้ `Doc/Product SKUs (68).xlsx` เป็นแหล่งข้อมูล โดย `run.cmd` จะอ่านข้อมูลใหม่ทุกครั้งก่อนเริ่มเว็บ:

- KPI: จำนวน SKU, Product ID ที่ไม่ซ้ำ, Latest SDQ เทียบ Initial SDQ และยอด Latest SSQ/SSQ Estimation
- กราฟ: Latest SSQ แยกตามหมวด, สัดส่วนสถานะการพัฒนา และจำนวน SKU ตามช่วง Launch
- รายการ Top SKU จัดอันดับตาม Latest SSQ

การอ่านข้อมูลและคำนวณยอดรวมอยู่ใน `src/Vista.Web/js/data-service.js`; ส่วน `dashboard.js` รับผิดชอบแสดงผล

## เริ่มใช้งาน

รัน `run.cmd` แล้วเปิด `http://localhost:8000/` หรือ `http://127.0.0.1:8000/` ในเบราว์เซอร์

ตัวอย่างนี้ใช้ Windows Integrated Authentication ผ่าน HTTP บน localhost เท่านั้น ไม่ควรนำการตั้งค่านี้ไปเปิดใช้งานบนเครือข่ายจริงโดยไม่มี HTTPS และการตั้งค่าเซิร์ฟเวอร์ที่เหมาะสม

# BẢN QUY TẮC BẢO TOÀN DỮ LIỆU & QUY TRÌNH TRIỂN KHAI HỆ THỐNG VPS
**Dự án**: T5 Goxo Reels & Image Automation (`t5.goxo.us`)  
**Ngày thiết lập**: 28/10/2026  
**Trạng thái**: Có hiệu lực bắt buộc cho toàn bộ chu trình phát triển & bảo trì  

---

## 1. TÔN CHỈ BẤT BIẾN (CORE SAFETY PRINCIPLES)

1. **BẢO TOÀN DỮ LIỆU SỐNG (ZERO DATA LOSS)**:
   * Toàn bộ dữ liệu đang vận hành trên VPS (tài khoản Facebook, fanpage, bài viết, template, lịch sử crawl, video/image render) là tài sản tối quan trọng.
   * **Tuyệt đối không thực hiện bất kỳ thao tác nào gây xóa, reset, hoặc ghi đè mất mát dữ liệu trên VPS nếu chưa có sự ĐỒNG Ý RÕ RÀNG từ người dùng.**
   * **Tuyệt đối không động chạm đến các dự án khác hoặc máy chủ cũ (như T2, T3).**

2. **QUẢN LÝ MÃ NGUỒN PHÂN TÁCH HOÀN TOÀN**:
   * **Upstream (Gốc)**: `https://github.com/devzota/fb-bm-reel` $\rightarrow$ **CHỈ ĐỌC (READ-ONLY)**.
     * Cấu hình cấm push (`push = DISABLE`) chỉ được thiết lập **cục bộ (locally)** tại riêng thư mục dự án này (`d:\projects\t5.goxo.us`).
     * **HOÀN TOÀN KHÔNG ẢNH HƯỞNG** đến các máy khác hoặc các dự án khác.
   * **Origin (Phát triển chính)**: `https://github.com/trungseodn/t5goxo` $\rightarrow$ Toàn bộ code phát triển, tính năng mới và deploy đều đi qua repo này.

3. **CƠ CHẾ PHÊ DUYỆT (EXPLICIT APPROVAL)**:
   * Mọi can thiệp vào VPS (pull code mới, đổi remote git, chạy migration, rebuild container, sửa cấu hình) đều phải được trình bày trước rõ ràng và CHỈ thực hiện sau khi người dùng gửi yêu cầu hoặc đồng ý.

---

## 2. HƯỚNG DẪN ĐĂNG NHẬP & KẾT NỐI VPS (SSH ACCESS DETAILS)

### 2.1 MÁY CHỦ CHÍNH T5 (`t5.goxo.us`):
* **Tên Server / Hostname**: `vmi3704097`
* **IP Server**: `84.247.128.133` (Port: `22`)
* **Domain trỏ về**: `t5.goxo.us` (SSL HTTPS Let's Encrypt đã cấu hình)
* **User**: `root`
* **Vị trí file SSH Private Key**:
  * Đường dẫn Windows: `C:\Users\OS\.ssh\id_ed25519`
* **Đường dẫn thư mục dự án trên VPS**: `/root/ztreel-app`
* **File Docker Compose**: `docker-compose.t5.yml`

#### Các câu lệnh SSH chuẩn cho T5:
1. **Mở phiên SSH tương tác (Interactive Shell)**:
   ```powershell
   C:\Windows\System32\OpenSSH\ssh.exe -i "C:\Users\OS\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@84.247.128.133
   ```

2. **Chạy lệnh đơn từ PowerShell (One-shot command)**:
   ```powershell
   & C:\Windows\System32\OpenSSH\ssh.exe -i "C:\Users\OS\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@84.247.128.133 '<câu_lệnh_bash>'
   ```

3. **Xem trạng thái các container**:
   ```powershell
   & C:\Windows\System32\OpenSSH\ssh.exe -i "C:\Users\OS\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@84.247.128.133 'docker ps'
   ```

4. **Xem log realtime của API**:
   ```powershell
   & C:\Windows\System32\OpenSSH\ssh.exe -i "C:\Users\OS\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@84.247.128.133 'docker logs -f ztreel_api_prod --tail 100'
   ```

5. **Rebuild & Restart ứng dụng khi có code mới**:
   ```powershell
   & C:\Windows\System32\OpenSSH\ssh.exe -i "C:\Users\OS\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@84.247.128.133 'cd /root/ztreel-app && git pull origin main && docker compose -f docker-compose.t5.yml up -d --build api web'
   ```

---

### 2.2 MÁY CHỦ CŨ T2 (BẢO LƯU ĐỘC LẬP - TUYỆT ĐỐI KHÔNG CAN THIỆP):
* **Tên Server**: `auto-reel-trung-2`
* **IP Server**: `169.58.210.160` (Port: `22`)
* **Domain trỏ về**: `t2.goxo.us` (và `3t.goxo.us`, `t3.goxo.us`)
* **User**: `root`
* **Key**: `C:\Users\OS\.ssh\vps2_t2_t3_may2_key`

---

## 3. HIỆN TRẠNG HỆ THỐNG VPS T5 (SNAPSHOT 28/10/2026)

* **Docker Compose file áp dụng**: `docker-compose.t5.yml` (nằm tại `/root/ztreel-app`)
* **Các container đang hoạt động**:
  * `ztreel_api_prod` (API NestJS - Port 3000)
  * `ztreel_web_prod` (Frontend React - Port 8080)
  * `ztreel_postgres_prod` (PostgreSQL 15 - Port 5432)
  * `ztreel_redis_prod` (Redis 7 - Port 6379)
* **Reverse Proxy & SSL**:
  * Nginx Host trỏ domain `t5.goxo.us` vào `http://127.0.0.1:8080`
  * SSL Certbot tự động gia hạn
* **Docker Volumes chứa dữ liệu (BẮT BUỘC BẢO VỆ)**:
  * `ztreel-app_ztreel_postgres_data`: Chứa Database `ztreel`
  * `ztreel-app_ztreel_storage`: Chứa file tài nguyên render, nhạc nền, audio
  * `ztreel-app_ztreel_uploads`: Chứa file upload của người dùng
  * `ztreel-app_ztreel_redis_data`: Chứa hàng đợi xử lý BullMQ

---

## 4. CÁC ĐIỀU CẤM TUYỆT ĐỐI (STRICT PROHIBITIONS)

❌ **NGHIÊM CẤM** dùng lệnh `docker compose down -v` hoặc `docker-compose down -v` (Cờ `-v` sẽ xóa sạch các Docker Volume dữ liệu!).  
❌ **NGHIÊM CẤM** dùng lệnh `npx prisma db push --force-reset` hoặc `npx prisma migrate reset` (Lệnh này sẽ xóa sạch trắng các bảng và dữ liệu trong Database!).  
❌ **NGHIÊM CẤM** tự ý xóa file `.env` hoặc `apps/api/.env` trên VPS.  
❌ **NGHIÊM CẤM** can thiệp hoặc thay đổi các máy chủ/dự án cũ khác.  
❌ **NGHIÊM CẤM** push code lên repo upstream `devzota/fb-bm-reel`.  

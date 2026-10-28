## Style & UI Guidelines

1. **Consistent UI Components**: Luôn tuân thủ cách thức thiết kế các khung tab, button switch, dropdown menu giống hệt như chuẩn đã làm ở trang `site setting page` (FacebookPageSettings.tsx). Không tự ý sáng tạo layout UI mới cho các component cơ bản này.
2. **Color Palette**: Tuyệt đối sử dụng màu sắc theo cấu hình (theme/color variables) của layout hiện tại. Tuyệt đối KHÔNG sử dụng màu Hồng và Tím.

## VPS Safety & Deployment Guidelines (Bắt buộc tuân thủ)

1. **Zero-Data Loss**: Tuyệt đối KHÔNG chạy các lệnh xóa volume hoặc reset database (`docker compose down -v`, `prisma db push --force-reset`).
2. **Quyền hạn can thiệp**: Mọi thay đổi mã nguồn hoặc cấu hình trên VPS chỉ được phép thực hiện khi người dùng yêu cầu hoặc đồng ý. Tuyệt đối KHÔNG làm ảnh hưởng đến các dự án cũ khác.
3. **Quản lý Git**:
   - `upstream` (Read-only, cục bộ tại thư mục này): `https://github.com/devzota/fb-bm-reel` (tuyệt đối không push). Không ảnh hưởng đến các máy/dự án khác.
   - `origin` (Chính): `https://github.com/trungseodn/t5goxo` (tất cả code đẩy vào đây).
4. **Thông tin & Lệnh SSH đăng nhập VPS T5 (Chính cho dự án t5.goxo.us)**:
   - Server: `vmi3704097` | IP: `84.247.128.133` (Port: `22`) | User: `root`
   - Domain: `t5.goxo.us` (SSL HTTPS đã kích hoạt)
   - Key: `C:\Users\OS\.ssh\id_ed25519`
   - Thư mục dự án trên VPS: `/root/ztreel-app`
   - Docker Compose: `docker-compose.t5.yml`
   - Lệnh SSH chuẩn:
     ```powershell
     C:\Windows\System32\OpenSSH\ssh.exe -i "C:\Users\OS\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@84.247.128.133
     ```
   - Chạy lệnh một lần từ PowerShell:
     ```powershell
     & C:\Windows\System32\OpenSSH\ssh.exe -i "C:\Users\OS\.ssh\id_ed25519" -o StrictHostKeyChecking=no root@84.247.128.133 '<lệnh_bash>'
     ```
5. **Thông tin VPS Cũ (t2.goxo.us - Tuyệt đối không can thiệp)**:
   - Server: `auto-reel-trung-2` | IP: `169.58.210.160` (Port: `22`) | User: `root`
   - Key: `C:\Users\OS\.ssh\vps2_t2_t3_may2_key`
6. **Quy trình chi tiết**: Xem đầy đủ tại file [DEPLOYMENT_RULES.md](file:///d:/projects/t5.goxo.us/DEPLOYMENT_RULES.md).

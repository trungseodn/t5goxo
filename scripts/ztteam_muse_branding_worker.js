/**
 * ZTTeam: Muse.ai RPA Worker Chuyên Vẽ Ảnh Nhận Diện Fanpage (Avatar 1:1 & Ảnh Bìa 16:9)
 * Tự động hóa qua Google Chrome Remote Debugging (Cổng 9222) và máy chủ https://t5.goxo.us
 * Tác giả: ZTTeam (CreatorPro AI)
 */
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (e1) {
  try {
    puppeteer = require('puppeteer');
  } catch (e2) {
    console.error('\n❌ LỖI: Chưa cài đặt thư viện puppeteer-core hoặc puppeteer!');
    console.error('👉 Vui lòng mở CMD tại thư mục này và chạy lệnh:');
    console.error('   npm install puppeteer-core axios form-data\n');
    process.exit(1);
  }
}
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

/** Đọc cấu hình từ dòng lệnh hoặc biến môi trường */
const args = process.argv.slice(2);
const targetArg = args.find(a => a.startsWith('--target='));
const TARGET_URL = (targetArg ? targetArg.split('=')[1] : (process.env.TARGET_URL || 'https://t5.goxo.us')).replace(/\/$/, '');

const chromePortArg = args.find(a => a.startsWith('--chrome-port='));
const CHROME_PORT = chromePortArg ? chromePortArg.split('=')[1] : (process.env.CHROME_PORT || '9222');
const CHROME_DEBUG_URL = `http://127.0.0.1:${CHROME_PORT}`;

const workerNameArg = args.find(a => a.startsWith('--worker-name='));
const WORKER_NAME = workerNameArg ? workerNameArg.split('=')[1] : `Muse-Branding-${CHROME_PORT}`;

const POLL_INTERVAL_MS = 10000; /** 10 giây kiểm tra hàng đợi 1 lần */
const TEMP_DIR = path.resolve(__dirname, `./branding_worker_temp_${CHROME_PORT}`);
const SUCCESS_COOLDOWN_SEC = 15; /** Nghỉ 15 giây sau mỗi ảnh hoàn thành */
const FAILURE_COOLDOWN_SEC = 25; /** Nghỉ 25 giây nếu gặp lỗi */

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

let isProcessing = false;

/** Hàm đếm ngược nghỉ an toàn */
async function ztteam_cooldown(seconds, reason) {
  console.log(`\n⏳ [${WORKER_NAME}] [Nghỉ an toàn] ${reason}.`);
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r   ⏱️ [${WORKER_NAME}] Chờ ${i} giây trước khi kiểm tra job tiếp theo...   `);
    await new Promise(r => setTimeout(r, 1000));
  }
  process.stdout.write('\r                                                                  \r');
}

/** Kiểm tra Chrome port */
async function ztteam_isChromeRunning() {
  try {
    const res = await axios.get(`${CHROME_DEBUG_URL}/json/version`, { timeout: 2500 });
    return res.status === 200;
  } catch {
    return false;
  }
}

/** Xử lý 1 job vẽ ảnh trên Muse.ai */
async function ztteam_processImageJobOnMuse(job) {
  const isAvatar = job.type === 'avatar';
  const label = isAvatar ? 'AVATAR (1:1)' : 'ẢNH BÌA (16:9)';
  const localImagePath = path.join(TEMP_DIR, `muse_${job.type}_${job.pageId}_${Date.now()}.png`);

  console.log(`\n========================================================`);
  console.log(`🎨 [${WORKER_NAME}] BẮT ĐẦU VẼ ẢNH: #${job.id}`);
  console.log(`🌐 Fanpage   : ${job.pageName} (ID: ${job.pageId})`);
  console.log(`🖼️ Thể loại  : ${label}`);
  console.log(`📝 Kích thước: ${job.aspectRatio}`);
  console.log(`========================================================`);

  let browser = null;
  let page = null;

  try {
    /** 1. Kết nối Chrome */
    console.log(`🌐 [${WORKER_NAME}] [1/4] Kết nối tới Chrome (${CHROME_DEBUG_URL})...`);
    browser = await puppeteer.connect({
      browserURL: CHROME_DEBUG_URL,
      defaultViewport: null,
      protocolTimeout: 300000,
    });

    const pages = await browser.pages();
    page = pages.find(p => p.url().includes('muse.ai')) || pages[0];
    if (!page) {
      page = await browser.newPage();
    }
    await page.bringToFront();

    /** 2. Làm mới tab Muse.ai để giải phóng DOM */
    console.log(`🔄 [${WORKER_NAME}] Làm mới tab Muse.ai để dọn dẹp bộ nhớ...`);
    await page.goto('https://muse.ai/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('textarea', { timeout: 25000 });
    await new Promise(r => setTimeout(r, 1500));

    /** Đánh dấu các phần tử cũ */
    await page.evaluate(() => {
      document.querySelectorAll('img, video, button, [data-message-author-role="assistant"]').forEach(el => {
        el.setAttribute('data-ztteam-old', 'true');
      });
    });

    /** 3. Nhập Prompt vào ô chat */
    console.log(`✍️ [${WORKER_NAME}] [2/4] Đang nhập câu lệnh vẽ ảnh cho Muse.ai...`);
    const fullPrompt = `${job.prompt}\n(Aspect Ratio: ${job.aspectRatio}, High Quality Visual Asset)`;

    const textarea = await page.$('textarea');
    if (!textarea) throw new Error('Không tìm thấy khung nhập liệu textarea trên Muse.ai');
    await textarea.click();

    await page.evaluate((text) => {
      const ta = document.querySelector('textarea');
      if (!ta) return;
      ta.focus();
      const proto = Object.getPrototypeOf(ta);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) {
        setter.call(ta, text);
      } else {
        ta.value = text;
      }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }, fullPrompt);
    await new Promise(r => setTimeout(r, 1000));

    /** 4. Bấm Gửi */
    console.log(`🚀 [${WORKER_NAME}] Bấm gửi tin nhắn...`);
    await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const targetBtn = allButtons.find(b => {
        if (b.disabled) return false;
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const title = (b.getAttribute('title') || '').toLowerCase();
        const text = (b.innerText || '').toLowerCase();
        return aria.includes('gửi') || aria.includes('send') || title.includes('gửi') || title.includes('send') || text.includes('gửi') || text.includes('send') || b.querySelector('svg');
      });
      if (targetBtn) targetBtn.click();
    });

    /** Xác nhận gửi bằng Enter nếu cần */
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const val = await page.evaluate(() => document.querySelector('textarea')?.value || '');
      if (!val.trim()) break;
      await page.keyboard.press('Enter');
    }

    /** 5. Chờ Muse.ai vẽ xong ảnh */
    console.log(`⏳ [${WORKER_NAME}] [3/4] Đang chờ Muse.ai vẽ ảnh ${label}... (tối thiểu 15s, tối đa 4 phút)`);
    const timeoutMs = 240000;
    const startTime = Date.now();
    let imageFound = false;
    let base64Data = null;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 3000));
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);

      const check = await page.evaluate((elapsed) => {
        /** Kiểm tra Muse từ chối */
        const pageText = (document.body.innerText || '').toLowerCase();
        const refusalKeywords = ['không tạo được', 'vi phạm chính sách', 'không thể tạo', 'thử lại với prompt khác'];
        const refusal = refusalKeywords.find(k => pageText.includes(k));
        if (refusal && elapsed > 10) return { isRefused: true, refusalError: refusal };

        /** Kiểm tra trạng thái đang sinh */
        const hasStopButton = document.querySelector('button[aria-label="Dừng tạo"], button[aria-label="Stop generating"]') !== null;
        if (hasStopButton) return { isGenerating: true };

        /** Tìm ảnh mới (không có data-ztteam-old) */
        const allImgs = Array.from(document.querySelectorAll('img')).filter(img => {
          const isAvatar = img.closest('.rounded-full') !== null || img.width <= 48 || img.height <= 48;
          const isOld = img.getAttribute('data-ztteam-old') === 'true';
          return !isAvatar && !isOld && img.src && (img.src.startsWith('http') || img.src.startsWith('blob:') || img.src.startsWith('data:'));
        });

        if (allImgs.length > 0 && elapsed >= 12) {
          const targetImg = allImgs[allImgs.length - 1];
          return { isReady: true, imgSrc: targetImg.src };
        }

        return { isReady: false, elapsed };
      }, elapsedSec);

      if (check.isRefused) {
        throw new Error(`Muse.ai từ chối vẽ ảnh: ${check.refusalError}`);
      }

      process.stdout.write(`\r   ⏱️ [${WORKER_NAME}] Đang chờ ảnh: ${elapsedSec}s | Trạng thái: ${check.isReady ? 'HOÀN TẤT' : (check.isGenerating ? 'Đang vẽ...' : 'Chờ phản hồi...')}`);

      if (check.isReady && check.imgSrc) {
        console.log(`\n🎉 [${WORKER_NAME}] Đã phát hiện ảnh mới từ Muse.ai sau ${elapsedSec}s!`);

        /** Đọc trực tiếp base64 của ảnh trong context trình duyệt */
        base64Data = await page.evaluate(async (src) => {
          try {
            const res = await fetch(src);
            const blob = await res.blob();
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            return null;
          }
        }, check.imgSrc);

        if (base64Data && base64Data.startsWith('data:image')) {
          imageFound = true;
          break;
        }
      }
    }

    if (!imageFound || !base64Data) {
      throw new Error('Quá thời gian chờ hoặc không trích xuất được dữ liệu ảnh từ Muse.ai');
    }

    /** 6. Lưu file PNG */
    const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
    fs.writeFileSync(localImagePath, buffer);
    console.log(`💾 [${WORKER_NAME}] Đã lưu ảnh tạm: ${(buffer.length / 1024).toFixed(1)} KB`);

    /** 7. Đẩy ảnh lên máy chủ */
    console.log(`🚀 [${WORKER_NAME}] [4/4] Đang đồng bộ ảnh lên máy chủ ${TARGET_URL}...`);
    const formData = new FormData();
    formData.append('image', fs.createReadStream(localImagePath));
    formData.append('type', job.type);
    formData.append('autoApply', 'true');

    const uploadRes = await axios.post(`${TARGET_URL}/api/facebook/pages/${job.pageId}/branding/muse/upload`, formData, {
      headers: { ...formData.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000,
    });

    console.log(`========================================================`);
    console.log(`🎉 HOÀN TẤT VẼ VÀ ĐỒNG BỘ ẢNH ${label} CHO "${job.pageName}"!`);
    console.log(`🖼️ URL Ảnh: ${uploadRes.data?.imageUrl}`);
    console.log(`🌐 Facebook Sync: ${uploadRes.data?.appliedToFacebook ? 'THÀNH CÔNG' : 'Chưa áp dụng'}`);
    console.log(`========================================================\n`);

    await ztteam_cooldown(SUCCESS_COOLDOWN_SEC, `Đã hoàn tất ảnh ${label}. Nghỉ giải lao trước bài tiếp theo`);
  } catch (err) {
    console.error(`\n❌ [${WORKER_NAME}] LỖI KHI XỬ LÝ JOB #${job.id}:`, err.message);

    try {
      await axios.post(`${TARGET_URL}/api/facebook/pages/${job.pageId}/branding/muse/status`, {
        status: 'FAILED',
        error: err.message,
      });
      console.log(`⚠️ [${WORKER_NAME}] Đã báo trạng thái FAILED lên máy chủ.`);
    } catch (apiErr) {
      console.error(`[${WORKER_NAME}] Không thể cập nhật trạng thái lỗi lên máy chủ:`, apiErr.message);
    }

    await ztteam_cooldown(FAILURE_COOLDOWN_SEC, 'Gặp lỗi khi vẽ ảnh trên Muse.ai. Dừng nghỉ trước khi thử lại');
  } finally {
    if (browser) {
      try { browser.disconnect(); } catch (e) {}
    }
    if (fs.existsSync(localImagePath)) {
      try { fs.unlinkSync(localImagePath); } catch (e) {}
    }
  }
}

/** Vòng lặp chính kiểm tra hàng đợi */
async function ztteam_brandingWorkerLoop() {
  if (isProcessing) return;

  try {
    const chromeAlive = await ztteam_isChromeRunning();
    if (!chromeAlive) {
      process.stdout.write(`\r[${WORKER_NAME}] Đang chờ mở Chrome tại ${CHROME_DEBUG_URL}...`);
      return;
    }

    const res = await axios.get(`${TARGET_URL}/api/facebook/pages/branding/muse/pending-job`, { timeout: 10000 });
    if (res.data && res.data.hasJob && res.data.job) {
      isProcessing = true;
      console.log(`\n🎯 [${WORKER_NAME}] Nhận được job vẽ ảnh mới: ${res.data.job.type.toUpperCase()} cho Page "${res.data.job.pageName}"`);
      try {
        await ztteam_processImageJobOnMuse(res.data.job);
      } finally {
        isProcessing = false;
      }
    } else {
      process.stdout.write(`\r[${new Date().toLocaleTimeString()}] [${WORKER_NAME}] Đang theo dõi hàng đợi Muse.ai... (Hiện tại không có job PENDING)`);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.response?.status === 502) {
      process.stdout.write(`\r⚠️ [${WORKER_NAME}] Không thể kết nối tới máy chủ ${TARGET_URL}... Đang thử lại`);
    } else {
      console.error(`\n[${WORKER_NAME}] Lỗi kiểm tra hàng đợi:`, err.message);
    }
  }
}

/** Khởi động tiến trình Worker */
console.log(`========================================================`);
console.log(`  ZTTeam Muse.ai Branding Worker - Phương Án 1 (Auto RPA)`);
console.log(`========================================================`);
console.log(`🌐 Máy chủ đích : ${TARGET_URL}`);
console.log(`🔌 Cổng Chrome   : ${CHROME_PORT} (${CHROME_DEBUG_URL})`);
console.log(`🤖 Tên Worker    : ${WORKER_NAME}`);
console.log(`📁 Thư mục tạm   : ${TEMP_DIR}`);
console.log(`========================================================\n`);

setInterval(ztteam_brandingWorkerLoop, POLL_INTERVAL_MS);
ztteam_brandingWorkerLoop();

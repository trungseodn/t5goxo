import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useZTTeamFacebookStore } from '../stores/facebookStore';
import type { ZTTeamFanpage } from '../stores/facebookStore';
import { useUIStore } from '../stores/uiStore';
import { ztteam_decodeHtmlEntity } from '../utils/stringUtils';
import CustomDropdown from '../components/CustomDropdown';
import api from '../services/api';

/** Danh sách chủ đề điện ảnh Muse.ai mẫu */
const MUSE_AI_THEMES = [
  {
    value: 'Family Drama & Confessions',
    label: 'Family Drama & Confessions (Kịch tính gia đình & Thú nhận chấn động)',
    desc: 'Cinematic chiaroscuro, narrative tension, deep emotional character expressions'
  },
  {
    value: 'Emotional Life & Healing',
    label: 'Emotional Life & Healing (Tâm sự sâu lắng & Chữa lành tâm hồn)',
    desc: 'Golden hour warmth, gentle poetic atmosphere, reflective and touching mood'
  },
  {
    value: 'Heartwarming & True Miracles',
    label: 'Heartwarming & True Miracles (Kỳ diệu cuộc sống & Ấm áp đời thường)',
    desc: 'Warm ambient glow, uplifting moments, heartwarming human connections'
  },
  {
    value: 'Mystery, Secrets & Suspense',
    label: 'Mystery, Secrets & Suspense (Bí mật giấu kín & Ly kỳ nghẹt thở)',
    desc: 'Moody noir shadows, mist and suspense, thrilling cinematic intrigue'
  },
  {
    value: 'Love, Marriage & Relationships',
    label: 'Love, Marriage & Relationships (Hôn nhân, Tình yêu & Sóng gió)',
    desc: 'Intimate drama, romantic tension, poignant character storytelling'
  },
  {
    value: 'Daily Wisdom & Life Lessons',
    label: 'Daily Wisdom & Life Lessons (Triết lý sống & Bài học nhân sinh)',
    desc: 'Minimalist timeless composition, thoughtful serene atmosphere, philosophical depth'
  },
  {
    value: 'custom',
    label: 'Tùy chỉnh chủ đề riêng...',
    desc: 'Tự nhập phong cách và mô tả cốt truyện theo ý bạn'
  }
];

/** Danh sách Hạng mục Facebook chuẩn */
const FB_CATEGORY_OPTIONS = [
  { value: 'Người sáng tạo nội dung số', label: 'Người sáng tạo nội dung số (Digital Creator)' },
  { value: 'Trang web tin tức và truyền thông', label: 'Trang web tin tức & truyền thông (News & Media)' },
  { value: 'Trang web giải trí', label: 'Trang web giải trí (Entertainment Website)' },
  { value: 'Giải trí', label: 'Giải trí (Just for Fun)' },
  { value: 'Cộng đồng', label: 'Cộng đồng (Community)' },
  { value: 'Blog cá nhân', label: 'Blog cá nhân (Personal Blog)' },
  { value: 'Film', label: 'Film (Phim ảnh)' },
  { value: 'Thẩm mỹ viện', label: 'Thẩm mỹ viện (Beauty Salon)' },
  { value: 'Làm đẹp, mỹ phẩm & chăm sóc cá nhân', label: 'Làm đẹp & Chăm sóc cá nhân' },
  { value: 'Doanh nhân', label: 'Doanh nhân / Khởi nghiệp (Entrepreneur)' },
  { value: 'Nhiếp ảnh gia', label: 'Nhiếp ảnh gia (Photographer)' },
  { value: 'Nhạc sĩ/Ban nhạc', label: 'Nhạc sĩ / Ban nhạc (Musician/Band)' },
  { value: 'Doanh nghiệp địa phương', label: 'Doanh nghiệp địa phương (Local Business)' },
];

export default function BrandingStudio() {
  const { pages, ztteam_fetchPagesFromDB } = useZTTeamFacebookStore();
  const { ztteam_showToast, ztteam_showConfirm } = useUIStore();

  /** Tab điều hướng chính: 'branding' | 'bio' | 'category' */
  const [activeTab, setActiveTab] = useState<'branding' | 'bio' | 'category'>('branding');

  /** Lựa chọn Engine AI tạo mô tả Fanpage: DeepSeek hoặc Gemini */
  const [bioAiProvider, setBioAiProvider] = useState<'deepseek' | 'gemini'>('deepseek');

  /** Bộ lọc dữ liệu */
  const [filterBM, setFilterBM] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'no_images' | 'has_images' | 'no_bio' | 'has_bio'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);

  /** Cấu hình Theme chung */
  const [selectedTheme, setSelectedTheme] = useState<string>('Family Drama & Confessions');
  const [customTheme, setCustomTheme] = useState<string>('');

  /** State Xử lý Hàng loạt */
  const [targetScope, setTargetScope] = useState<'selected' | 'bm'>('selected');
  const [targetBM, setTargetBM] = useState<string>('');
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);
  const [batchProgressMsg, setBatchProgressMsg] = useState<string | null>(null);

  /** State riêng cho từng Page (đang tạo / đang lưu) */
  const [loadingPages, setLoadingPages] = useState<Record<string, { avatar?: boolean; cover?: boolean; both?: boolean; bio?: boolean; apply?: boolean }>>({});
  const [editedBios, setEditedBios] = useState<Record<string, string>>({});
  const [savedBioStatus, setSavedBioStatus] = useState<Record<string, boolean>>({});

  /** State Cấu hình Hạng mục hàng loạt */
  const [bulkCategory, setBulkCategory] = useState<string>('Người sáng tạo nội dung số');
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');

  /** State Preview Modal ảnh phóng to */
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  /** File input ẩn cho upload thủ công */
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ pageId: string; type: 'avatar' | 'cover' } | null>(null);

  /** Danh sách Business Manager duy nhất */
  const uniqueBusinesses = useMemo(() => {
    return Array.from(new Set(pages.map(p => p.businessName).filter(Boolean) as string[]));
  }, [pages]);

  /** Nạp dữ liệu khi mở trang */
  useEffect(() => {
    ztteam_fetchPagesFromDB();
  }, []);

  /** Khởi tạo bản nháp mô tả cho từng page khi data về */
  useEffect(() => {
    const bios: Record<string, string> = {};
    pages.forEach(p => {
      const internalId = p.internalId || p.id;
      bios[internalId] = (p as any).brandingDescription || (p as any).branding_description || '';
    });
    setEditedBios(prev => ({ ...bios, ...prev }));
  }, [pages]);

  /** Lọc danh sách Fanpage */
  const filteredPages = useMemo(() => {
    return pages.filter(p => {
      if (p.isActive === false) return false;
      if (filterBM && p.businessName !== filterBM) return false;

      const hasAvatar = !!(p as any).brandingAvatarUrl || !!(p as any).branding_avatar_url;
      const hasCover = !!(p as any).brandingCoverUrl || !!(p as any).branding_cover_url;
      const hasBio = !!((p as any).brandingDescription || (p as any).branding_description || editedBios[p.internalId || p.id]);

      if (filterStatus === 'no_images' && hasAvatar && hasCover) return false;
      if (filterStatus === 'has_images' && (!hasAvatar || !hasCover)) return false;
      if (filterStatus === 'no_bio' && hasBio) return false;
      if (filterStatus === 'has_bio' && !hasBio) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const idMatch = (p.id || '').toLowerCase().includes(q);
        if (!nameMatch && !idMatch) return false;
      }

      return true;
    });
  }, [pages, filterBM, filterStatus, searchQuery, editedBios]);

  /** Danh sách Fanpage mục tiêu áp dụng cho Tác vụ Hàng loạt */
  const targetPages = useMemo(() => {
    if (targetScope === 'bm') {
      if (!targetBM) return [];
      return pages.filter(p => p.businessName === targetBM && p.isActive !== false);
    }
    return pages.filter(p => selectedPageIds.includes(p.id) && p.isActive !== false);
  }, [targetScope, targetBM, pages, selectedPageIds]);

  const targetPageIds = useMemo(() => {
    return targetPages.map(p => p.internalId || p.id);
  }, [targetPages]);

  /** Thống kê nhanh */
  const stats = useMemo(() => {
    const total = pages.filter(p => p.isActive !== false).length;
    let hasImages = 0;
    let hasBio = 0;
    pages.forEach(p => {
      if (p.isActive === false) return;
      const a = (p as any).brandingAvatarUrl || (p as any).branding_avatar_url;
      const c = (p as any).brandingCoverUrl || (p as any).branding_cover_url;
      const b = (p as any).brandingDescription || (p as any).branding_description;
      if (a && c) hasImages++;
      if (b) hasBio++;
    });
    return { total, hasImages, hasBio, selected: selectedPageIds.length };
  }, [pages, selectedPageIds]);

  /** Toggle chọn tất cả */
  const handleToggleSelectAll = () => {
    if (selectedPageIds.length === filteredPages.length && filteredPages.length > 0) {
      setSelectedPageIds([]);
    } else {
      setSelectedPageIds(filteredPages.map(p => p.id));
    }
  };

  const getEffectiveTheme = () => {
    return selectedTheme === 'custom' ? customTheme.trim() : selectedTheme;
  };

  // ==========================================
  // XỬ LÝ TAB 1: BỘ NHẬN DIỆN ẢNH (AVATAR & COVER)
  // ==========================================

  /** Tạo hàng loạt Bộ nhận diện 2K bằng Gemini */
  const handleBatchGenerateBranding = async () => {
    if (targetPageIds.length === 0) {
      ztteam_showToast('Vui lòng chọn ít nhất 1 Fanpage hoặc chọn Doanh Nghiệp (BM)', 'error');
      return;
    }
    const themeToSend = getEffectiveTheme();
    try {
      setIsProcessingBatch(true);
      setBatchProgressMsg(`Gemini đang tạo Avatar & Ảnh bìa 2K (chủ đề: ${themeToSend || 'Mặc định'}) cho ${targetPageIds.length} Fanpage...`);
      const res = await api.post('/facebook/pages/branding/batch-generate', {
        pageIds: targetPageIds,
        overwriteExisting,
        theme: themeToSend || undefined,
      });
      if (res.data?.success) {
        ztteam_showToast(`Gemini đã tạo xong bộ nhận diện cho ${res.data.totalProcessed || res.data.count || 0} Fanpage!`, 'success');
        setBatchProgressMsg(`Hoàn tất: Đã tạo thành công ảnh nhận diện 2K.`);
        await ztteam_fetchPagesFromDB();
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi khi tạo bộ nhận diện Gemini', 'error');
      setBatchProgressMsg(null);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  /** Gắn bộ nhận diện lên Facebook hàng loạt */
  const handleBatchApplyBranding = async () => {
    if (targetPageIds.length === 0) {
      ztteam_showToast('Vui lòng chọn ít nhất 1 Fanpage hoặc chọn Doanh Nghiệp (BM)', 'error');
      return;
    }
    const confirm = await ztteam_showConfirm(
      'Gắn Bộ Nhận Diện Lên Facebook',
      `Bạn có chắc chắn muốn gắn Avatar & Ảnh bìa AI lên ${targetPages.length} Fanpage Facebook thật? Ảnh bìa sẽ được tải vào kho ẩn không tạo bài viết rác.`
    );
    if (!confirm) return;

    try {
      setIsProcessingBatch(true);
      setBatchProgressMsg(`Đang gắn Avatar & Ảnh bìa lên ${targetPageIds.length} Fanpage Facebook thật...`);
      const res = await api.post('/facebook/pages/branding/batch-apply', {
        pageIds: targetPageIds,
      });
      if (res.data?.success) {
        ztteam_showToast(`Đã gắn thành công lên ${res.data.appliedCount || 0} Fanpage!`, 'success');
        setBatchProgressMsg(`Hoàn tất gắn lên Facebook (${res.data.appliedCount || 0} thành công)`);
        await ztteam_fetchPagesFromDB();
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi khi gắn lên Facebook', 'error');
      setBatchProgressMsg(null);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  /** Tạo riêng cả bộ Avatar & Cover cho 1 page */
  const handleSingleGenerateBoth = async (page: ZTTeamFanpage) => {
    const pId = page.internalId || page.id;
    setLoadingPages(prev => ({ ...prev, [pId]: { ...prev[pId], both: true } }));
    try {
      ztteam_showToast(`Đang tạo bộ nhận diện 2K theo phong cách Muse.ai cho "${page.name}"...`, 'info');
      const themeToSend = getEffectiveTheme();
      const res = await api.post(`/facebook/pages/${pId}/branding/generate`, {
        theme: themeToSend || undefined,
      });
      if (res.data?.success) {
        ztteam_showToast(`Đã tạo thành công bộ nhận diện 2K cho "${page.name}"!`, 'success');
        await ztteam_fetchPagesFromDB();
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi khi tạo ảnh nhận diện AI', 'error');
    } finally {
      setLoadingPages(prev => ({ ...prev, [pId]: { ...prev[pId], both: false } }));
    }
  };

  /** Vẽ lại riêng Avatar hoặc Cover cho 1 page */
  const handleSingleRegenerateItem = async (page: ZTTeamFanpage, type: 'avatar' | 'cover') => {
    const pId = page.internalId || page.id;
    setLoadingPages(prev => ({ ...prev, [pId]: { ...prev[pId], [type]: true } }));
    try {
      ztteam_showToast(`Đang vẽ lại ${type === 'avatar' ? 'Avatar (1:1)' : 'Ảnh bìa (16:9)'} cho "${page.name}"...`, 'info');
      const themeToSend = getEffectiveTheme();
      const res = await api.post(`/facebook/pages/${pId}/branding/regenerate-item`, {
        type,
        theme: themeToSend || undefined,
      });
      if (res.data?.success) {
        ztteam_showToast(`Đã vẽ lại ${type === 'avatar' ? 'Avatar' : 'Ảnh bìa'} thành công!`, 'success');
        await ztteam_fetchPagesFromDB();
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi khi vẽ lại ảnh AI', 'error');
    } finally {
      setLoadingPages(prev => ({ ...prev, [pId]: { ...prev[pId], [type]: false } }));
    }
  };

  /** Gắn bộ nhận diện lên Facebook cho 1 page */
  const handleSingleApply = async (page: ZTTeamFanpage) => {
    const pId = page.internalId || page.id;
    const avatarUrl = (page as any).brandingAvatarUrl || (page as any).branding_avatar_url;
    const coverUrl = (page as any).brandingCoverUrl || (page as any).branding_cover_url;

    if (!avatarUrl && !coverUrl) {
      ztteam_showToast('Page này chưa có Avatar hoặc Ảnh bìa để gắn lên Facebook', 'error');
      return;
    }

    setLoadingPages(prev => ({ ...prev, [pId]: { ...prev[pId], apply: true } }));
    try {
      const res = await api.post(`/facebook/pages/${pId}/branding/apply`, {
        avatarUrl,
        coverUrl,
      });
      if (res.data?.success) {
        ztteam_showToast(`Đã gắn bộ nhận diện lên Fanpage "${page.name}" thành công!`, 'success');
        await ztteam_fetchPagesFromDB();
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi gắn lên Facebook', 'error');
    } finally {
      setLoadingPages(prev => ({ ...prev, [pId]: { ...prev[pId], apply: false } }));
    }
  };

  /** Trigger tải ảnh thủ công */
  const triggerManualUpload = (page: ZTTeamFanpage, type: 'avatar' | 'cover') => {
    setUploadTarget({ pageId: page.internalId || page.id, type });
    if (uploadFileInputRef.current) {
      uploadFileInputRef.current.value = '';
      uploadFileInputRef.current.click();
    }
  };

  /** Xử lý tải file ảnh thủ công lên backend */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', uploadTarget.type);

    try {
      ztteam_showToast(`Đang tải ảnh ${uploadTarget.type === 'avatar' ? 'Avatar' : 'Ảnh bìa'} lên hệ thống...`, 'info');
      const res = await api.post(`/facebook/pages/${uploadTarget.pageId}/branding/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        ztteam_showToast(`Đã tải ảnh thủ công thành công!`, 'success');
        await ztteam_fetchPagesFromDB();
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi tải ảnh lên', 'error');
    } finally {
      setUploadTarget(null);
    }
  };

  // ==========================================
  // XỬ LÝ TAB 2: TÁC VỤ RIÊNG BIỆT - MÔ TẢ (100% TIẾNG ANH)
  // ==========================================

  /** Viết mô tả 100% tiếng Anh hàng loạt */
  /** Tạo mô tả hàng loạt bằng DeepSeek / Gemini */
  const handleBatchGenerateBio = async () => {
    if (targetPageIds.length === 0) {
      ztteam_showToast('Vui lòng chọn ít nhất 1 Fanpage hoặc chọn Doanh Nghiệp (BM)', 'error');
      return;
    }
    const themeToSend = getEffectiveTheme();
    const aiLabel = bioAiProvider === 'deepseek' ? 'DeepSeek AI' : 'Google Gemini';
    try {
      setIsProcessingBatch(true);
      setBatchProgressMsg(`${aiLabel} đang viết mô tả 100% tiếng Anh (chủ đề: ${themeToSend || 'Mặc định'}) cho ${targetPageIds.length} Fanpage...`);
      const res = await api.post('/facebook/pages/description/batch-generate', {
        pageIds: targetPageIds,
        overwriteExisting,
        theme: themeToSend || undefined,
        aiProvider: bioAiProvider,
      });
      if (res.data?.success) {
        ztteam_showToast(`Đã tạo xong mô tả tiếng Anh (${aiLabel}) cho ${res.data.totalProcessed || 0} Fanpage!`, 'success');
        setBatchProgressMsg(`Hoàn tất: Đã sinh mô tả qua ${aiLabel} cho ${res.data.totalProcessed || 0} Fanpage.`);
        await ztteam_fetchPagesFromDB();
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi khi tạo mô tả AI', 'error');
      setBatchProgressMsg(null);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  /** Đồng bộ mô tả lên Facebook hàng loạt */
  const handleBatchApplyBio = async () => {
    if (targetPageIds.length === 0) {
      ztteam_showToast('Vui lòng chọn ít nhất 1 Fanpage hoặc chọn Doanh Nghiệp (BM)', 'error');
      return;
    }
    const confirm = await ztteam_showConfirm(
      'Cập Nhật Mô Tả Lên Facebook',
      `Bạn có chắc chắn muốn cập nhật mô tả giới thiệu lên ${targetPages.length} Fanpage Facebook thật qua Meta Graph API?`
    );
    if (!confirm) return;

    try {
      setIsProcessingBatch(true);
      setBatchProgressMsg(`Đang cập nhật mô tả lên ${targetPages.length} Fanpage Facebook...`);
      const res = await api.post('/facebook/pages/description/batch-apply', {
        pageIds: targetPageIds,
      });
      if (res.data?.success) {
        ztteam_showToast(`Đã cập nhật thành công lên ${res.data.successCount || 0} Fanpage!`, 'success');
        setBatchProgressMsg(`Hoàn tất: Đã cập nhật thành công ${res.data.successCount || 0}/${targetPages.length} Fanpage.`);
        await ztteam_fetchPagesFromDB();
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi cập nhật mô tả Facebook', 'error');
      setBatchProgressMsg(null);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  /** Viết lại mô tả tiếng Anh cho 1 page qua DeepSeek / Gemini */
  const handleSingleGenerateBio = async (page: ZTTeamFanpage) => {
    const pId = page.internalId || page.id;
    const aiLabel = bioAiProvider === 'deepseek' ? 'DeepSeek AI' : 'Google Gemini';
    setLoadingPages(prev => ({ ...prev, [pId]: { ...prev[pId], bio: true } }));
    try {
      ztteam_showToast(`${aiLabel} đang viết mô tả 100% tiếng Anh cho "${page.name}"...`, 'info');
      const themeToSend = getEffectiveTheme();
      const res = await api.post(`/facebook/pages/${pId}/description/generate`, {
        theme: themeToSend || undefined,
        aiProvider: bioAiProvider,
      });
      if (res.data?.success && res.data.description) {
        setEditedBios(prev => ({ ...prev, [pId]: res.data.description }));
        ztteam_showToast(`Đã tạo xong mô tả tiếng Anh (${aiLabel}) cho "${page.name}"!`, 'success');
        await ztteam_fetchPagesFromDB();
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi khi tạo mô tả AI', 'error');
    } finally {
      setLoadingPages(prev => ({ ...prev, [pId]: { ...prev[pId], bio: false } }));
    }
  };

  /** Cập nhật mô tả trực tiếp lên Facebook cho 1 page */
  const handleSingleUpdateBio = async (page: ZTTeamFanpage) => {
    const pId = page.internalId || page.id;
    const desc = (editedBios[pId] || '').trim();
    if (!desc) {
      ztteam_showToast('Vui lòng nhập nội dung mô tả trước khi cập nhật', 'error');
      return;
    }

    setLoadingPages(prev => ({ ...prev, [pId]: { ...prev[pId], apply: true } }));
    try {
      const res = await api.post(`/facebook/pages/${pId}/description/update`, { description: desc });
      if (res.data?.success) {
        ztteam_showToast(`Đã cập nhật mô tả lên Fanpage "${page.name}" thành công!`, 'success');
        setSavedBioStatus(prev => ({ ...prev, [pId]: true }));
        await ztteam_fetchPagesFromDB();
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi cập nhật mô tả Facebook', 'error');
    } finally {
      setLoadingPages(prev => ({ ...prev, [pId]: { ...prev[pId], apply: false } }));
    }
  };

  // ==========================================
  // XỬ LÝ TAB 3: HẠNG MỤC (CATEGORY) HÀNG LOẠT
  // ==========================================

  const handleBulkUpdateCategory = async () => {
    if (targetPageIds.length === 0) {
      ztteam_showToast('Vui lòng chọn ít nhất 1 Fanpage hoặc chọn Doanh Nghiệp (BM)', 'error');
      return;
    }
    const finalCategory = customCategoryInput.trim() || bulkCategory.trim();
    if (!finalCategory) {
      ztteam_showToast('Vui lòng chọn hoặc nhập Hạng mục cần áp dụng', 'error');
      return;
    }

    try {
      setIsProcessingBatch(true);
      setBatchProgressMsg(`Đang cập nhật hạng mục "${finalCategory}" cho ${targetPageIds.length} Page...`);
      const res = await api.post('/facebook/pages/bulk-update-category', {
        pageIds: targetPageIds,
        category: finalCategory,
      });
      if (res.data?.success) {
        ztteam_showToast(res.data.message || `Đã cập nhật hạng mục cho ${res.data.updatedCount || targetPageIds.length} Page!`, 'success');
        setBatchProgressMsg(`Đã cập nhật xong hạng mục "${finalCategory}"`);
        await ztteam_fetchPagesFromDB();
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi cập nhật hạng mục', 'error');
      setBatchProgressMsg(null);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/** Input ẩn để upload file thủ công */}
      <input
        type="file"
        ref={uploadFileInputRef}
        onChange={handleFileUpload}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
      />

      {/** Modal Phóng to ảnh Preview */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-4xl max-h-[90vh] bg-fb-surface p-4 rounded-3xl border border-slate-700/80 shadow-2xl flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full pb-2 border-b border-fb-surface-hover/50">
              <h4 className="text-sm font-bold text-fb-text">{previewImage.title}</h4>
              <button 
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full hover:bg-fb-surface-hover flex items-center justify-center text-fb-text-muted hover:text-white"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <img src={previewImage.url} alt="Preview 2K" className="max-h-[75vh] w-auto rounded-2xl object-contain shadow-lg" />
          </div>
        </div>
      )}

      {/** HEADER: TIÊU ĐỀ & THỐNG KÊ NHANH */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-fb-surface p-6 rounded-2xl border border-fb-surface-hover/50 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 shrink-0">
            <span className="material-symbols-outlined text-3xl">palette</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-fb-text tracking-tight">Studio Nhận Diện & Bio Fanpage</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                Muse.ai & Gemini 2K
              </span>
            </div>
            <p className="text-xs text-fb-text-muted mt-1 max-w-3xl leading-relaxed">
              Phân hệ độc lập: Sáng tạo Avatar & Ảnh bìa theo phong cách điện ảnh Muse.ai, viết mô tả Facebook 100% tiếng Anh chuẩn Bio và đồng bộ hàng loạt lên Facebook qua Meta Graph API.
            </p>
          </div>
        </div>

        {/** Quick Stats Counter Badges */}
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="px-3.5 py-2 bg-fb-surface-hover/40 rounded-xl border border-fb-surface-hover/60 flex flex-col shrink-0">
            <span className="text-[10px] text-fb-text-muted font-bold uppercase">Tổng Fanpage</span>
            <span className="text-base font-black text-fb-text">{stats.total}</span>
          </div>
          <div className="px-3.5 py-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20 flex flex-col shrink-0">
            <span className="text-[10px] text-cyan-400 font-bold uppercase">Đủ Avatar & Bìa</span>
            <span className="text-base font-black text-cyan-400">{stats.hasImages} / {stats.total}</span>
          </div>
          <div className="px-3.5 py-2 bg-teal-500/10 rounded-xl border border-teal-500/20 flex flex-col shrink-0">
            <span className="text-[10px] text-teal-400 font-bold uppercase">Đã Có Bio (Tiếng Anh)</span>
            <span className="text-base font-black text-teal-400">{stats.hasBio} / {stats.total}</span>
          </div>
          <button
            onClick={() => ztteam_fetchPagesFromDB()}
            className="p-2.5 rounded-xl bg-fb-surface-hover/60 hover:bg-fb-surface-hover text-fb-text-muted hover:text-white transition-colors border border-fb-surface-hover shrink-0"
            title="Làm mới danh sách"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
          </button>
        </div>
      </div>

      {/** TAB CHUYỂN ĐỔI WORKSPACE */}
      <div className="flex items-center gap-2 border-b border-fb-surface-hover/60 overflow-x-auto">
        <button
          onClick={() => setActiveTab('branding')}
          className={`px-6 py-3.5 font-black text-sm flex items-center gap-2.5 border-b-2 rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'branding'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5 shadow-xs'
              : 'border-transparent text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover/40'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">palette</span>
          1. Ảnh Bìa & Avatar Muse.ai (2K)
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            activeTab === 'branding' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-fb-surface-hover text-fb-text border-white/5'
          }`}>
            Gemini 2K
          </span>
        </button>

        <button
          onClick={() => setActiveTab('bio')}
          className={`px-6 py-3.5 font-black text-sm flex items-center gap-2.5 border-b-2 rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'bio'
              ? 'border-teal-500 text-teal-400 bg-teal-500/5 shadow-xs'
              : 'border-transparent text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover/40'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">description</span>
          2. Tác Vụ Riêng: Mô Tả Fanpage (100% Tiếng Anh)
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            activeTab === 'bio' ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' : 'bg-fb-surface-hover text-fb-text border-white/5'
          }`}>
            English Bio
          </span>
        </button>

        <button
          onClick={() => setActiveTab('category')}
          className={`px-6 py-3.5 font-black text-sm flex items-center gap-2.5 border-b-2 rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'category'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5 shadow-xs'
              : 'border-transparent text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover/40'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">category</span>
          3. Cấu Hình Hạng Mục Hàng Loạt
        </button>
      </div>

      {/** BỘ LỌC DỮ LIỆU & THANH TÌM KIẾM CHUNG */}
      <div className="bg-fb-surface rounded-2xl p-4 border border-fb-surface-hover/50 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/** Lọc theo BM */}
          <div className="w-56">
            <CustomDropdown
              value={filterBM}
              onChange={(val) => setFilterBM(String(val))}
              options={[
                { value: '', label: '-- Tất cả Doanh Nghiệp (BM) --' },
                ...uniqueBusinesses.map(b => ({ value: b, label: b })),
              ]}
              className="w-full text-xs"
            />
          </div>

          {/** Lọc theo trạng thái */}
          <div className="w-56">
            <CustomDropdown
              value={filterStatus}
              onChange={(val) => setFilterStatus(val as any)}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'no_images', label: 'Chưa đủ Ảnh Bìa / Avatar' },
                { value: 'has_images', label: 'Đã có đủ Ảnh Bìa & Avatar' },
                { value: 'no_bio', label: 'Chưa có Mô tả (Bio)' },
                { value: 'has_bio', label: 'Đã có Mô tả (Bio)' },
              ]}
              className="w-full text-xs"
            />
          </div>

          {/** Nút chọn tất cả */}
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              selectedPageIds.length > 0 && selectedPageIds.length === filteredPages.length
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                : 'bg-fb-surface-hover/40 text-fb-text-muted hover:text-fb-text border-fb-surface-hover'
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {selectedPageIds.length > 0 && selectedPageIds.length === filteredPages.length ? 'check_box' : 'check_box_outline_blank'}
            </span>
            <span>
              {selectedPageIds.length > 0 && selectedPageIds.length === filteredPages.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'} ({filteredPages.length})
            </span>
          </button>
        </div>

        {/** Ô tìm kiếm */}
        <div className="relative w-full md:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fb-text-muted text-lg">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc ID Page..."
            className="w-full bg-fb-surface-hover/60 border border-fb-surface-hover focus:border-cyan-500 rounded-xl pl-9 pr-3 py-2 text-xs text-fb-text focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/** BẢNG ĐIỀU KHIỂN HÀNG LOẠT (CONTROL BAR) */}
      <div className="bg-fb-surface rounded-2xl p-6 border border-fb-surface-hover/50 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-fb-surface-hover/50">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg shadow-md ${
              activeTab === 'branding' 
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' 
                : activeTab === 'bio'
                  ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                  : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
            }`}>
              <span className="material-symbols-outlined">
                {activeTab === 'branding' ? 'tune' : activeTab === 'bio' ? 'edit_note' : 'category'}
              </span>
            </div>
            <div>
              <h3 className="text-base font-black text-fb-text">
                {activeTab === 'branding' && 'Bảng Điều Khiển Tạo Ảnh Hàng Loạt (Muse.ai 2K)'}
                {activeTab === 'bio' && 'Bảng Điều Khiển Viết Mô Tả Hàng Loạt (100% Tiếng Anh)'}
                {activeTab === 'category' && 'Bảng Cập Nhật Hạng Mục Hàng Loạt (Facebook Category)'}
              </h3>
              <p className="text-xs text-fb-text-muted mt-0.5">
                Thiết lập chủ đề và chạy tác vụ hàng loạt cho các Fanpage đã chọn hoặc toàn bộ Doanh Nghiệp (BM).
              </p>
            </div>
          </div>

          {/** Nút chạy tác vụ tương ứng với Tab */}
          <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
            {activeTab === 'branding' && (
              <>
                <button
                  type="button"
                  onClick={handleBatchGenerateBranding}
                  disabled={isProcessingBatch || targetPages.length === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-500 hover:opacity-90 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isProcessingBatch ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      <span>Đang Xử Lý ({targetPages.length} Page)...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      <span>Tạo Cả Bộ (Gemini 2K)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBatchApplyBranding}
                  disabled={isProcessingBatch || targetPages.length === 0}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">cloud_upload</span>
                  <span>Gắn Lên Facebook Hàng Loạt</span>
                </button>
              </>
            )}

            {activeTab === 'bio' && (
              <>
                <button
                  type="button"
                  onClick={handleBatchGenerateBio}
                  disabled={isProcessingBatch || targetPages.length === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:opacity-90 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-teal-500/25 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isProcessingBatch ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      <span>{bioAiProvider === 'deepseek' ? 'DeepSeek' : 'Gemini'} Đang Viết ({targetPages.length} Page)...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      <span>Viết Mô Tả ({bioAiProvider === 'deepseek' ? 'DeepSeek' : 'Gemini'}) Hàng Loạt</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBatchApplyBio}
                  disabled={isProcessingBatch || targetPages.length === 0}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">publish</span>
                  <span>Cập Nhật Lên Facebook Hàng Loạt</span>
                </button>
              </>
            )}

            {activeTab === 'category' && (
              <button
                type="button"
                onClick={handleBulkUpdateCategory}
                disabled={isProcessingBatch || targetPages.length === 0}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                <span>Lưu Hạng Mục & Đồng Bộ FB</span>
              </button>
            )}
          </div>
        </div>

        {/** Progress Message Banner */}
        {batchProgressMsg && (
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center gap-2.5 text-xs text-cyan-300 animate-pulse">
            <span className="material-symbols-outlined text-base shrink-0 animate-spin">sync</span>
            <span className="flex-1 font-medium">{batchProgressMsg}</span>
          </div>
        )}

        {/** Cấu hình chi tiết bộ tác vụ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/** Cột 1: Đối tượng áp dụng */}
          <div className="space-y-2 bg-fb-surface-hover/20 p-4 rounded-xl border border-fb-surface-hover/40">
            <label className="block text-xs font-bold text-fb-text">1. Chọn đối tượng áp dụng</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope('selected')}
                className={`py-2 px-3 rounded-lg text-xs font-bold border text-center transition-all ${
                  targetScope === 'selected'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-fb-surface-hover/40 border-transparent text-fb-text-muted hover:text-fb-text'
                }`}
              >
                Đã chọn ({selectedPageIds.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setTargetScope('bm');
                  if (!targetBM && uniqueBusinesses.length > 0) setTargetBM(uniqueBusinesses[0]);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold border text-center transition-all ${
                  targetScope === 'bm'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-fb-surface-hover/40 border-transparent text-fb-text-muted hover:text-fb-text'
                }`}
              >
                Theo BM
              </button>
            </div>

            {targetScope === 'bm' && (
              <div className="pt-2">
                <CustomDropdown
                  value={targetBM}
                  onChange={(val) => setTargetBM(String(val))}
                  options={uniqueBusinesses.map(b => ({ value: b, label: b }))}
                  placeholder="-- Chọn Business Manager --"
                  className="w-full text-xs"
                />
              </div>
            )}

            <div className="text-[11px] text-fb-text-muted pt-1 flex items-center justify-between">
              <span>Số Page sẽ chạy:</span>
              <span className="font-extrabold text-cyan-400">{targetPages.length} Fanpage</span>
            </div>
          </div>

          {/** Cột 2 & 3: Tùy theo tab */}
          {activeTab !== 'category' ? (
            <>
              {/** Cột 2: Chọn Chủ Đề (Muse.ai Theme) */}
              <div className="space-y-2 bg-fb-surface-hover/20 p-4 rounded-xl border border-fb-surface-hover/40">
                <label className="block text-xs font-bold text-fb-text">
                  2. Chủ đề cốt truyện & Nghệ thuật
                </label>
                <CustomDropdown
                  value={selectedTheme}
                  onChange={(val) => setSelectedTheme(String(val))}
                  options={MUSE_AI_THEMES.map(t => ({ value: t.value, label: t.label }))}
                  className="w-full text-xs"
                />
                {selectedTheme === 'custom' && (
                  <input
                    type="text"
                    value={customTheme}
                    onChange={(e) => setCustomTheme(e.target.value)}
                    placeholder="Nhập mô tả chủ đề tùy chỉnh..."
                    className="w-full bg-fb-surface-hover/60 border border-fb-surface-hover focus:border-cyan-500 rounded-xl px-3 py-1.5 text-xs text-fb-text focus:outline-none"
                  />
                )}
                <p className="text-[11px] text-fb-text-muted leading-relaxed">
                  {MUSE_AI_THEMES.find(t => t.value === selectedTheme)?.desc || 'Tùy biến phong cách tự do'}
                </p>
              </div>

              {/** Cột 3: Tùy chọn nâng cao & Ghi đè */}
              <div className="space-y-3 bg-fb-surface-hover/20 p-4 rounded-xl border border-fb-surface-hover/40 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-fb-text mb-2">3. Tùy chọn nâng cao</label>
                  <label className="flex items-center gap-2 text-xs text-fb-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 text-cyan-600 focus:ring-0 bg-slate-900 cursor-pointer"
                    />
                    <span>Ghi đè cả những Fanpage đã có dữ liệu</span>
                  </label>
                </div>
                <div className="text-[11px] text-fb-text-muted leading-relaxed">
                  {activeTab === 'branding' 
                    ? 'Ảnh bìa (16:9) và Avatar (1:1) sẽ được Gemini tạo đạt chuẩn 2K. Khi gắn lên FB sẽ lưu vào album ẩn an toàn.'
                    : 'Mô tả được ép buộc 100% tiếng Anh, độ dài 120-220 ký tự chuẩn Facebook Bio, không có dấu ngoặc kép hay hashtag.'}
                </div>
              </div>
            </>
          ) : (
            <>
              {/** Cột 2: Chọn Hạng Mục Chuẩn */}
              <div className="space-y-2 bg-fb-surface-hover/20 p-4 rounded-xl border border-fb-surface-hover/40">
                <label className="block text-xs font-bold text-fb-text">2. Chọn Hạng Mục Facebook</label>
                <CustomDropdown
                  value={bulkCategory}
                  onChange={(val) => setBulkCategory(String(val))}
                  options={FB_CATEGORY_OPTIONS}
                  className="w-full text-xs"
                />
                <input
                  type="text"
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  placeholder="Hoặc nhập hạng mục tự do..."
                  className="w-full bg-fb-surface-hover/60 border border-fb-surface-hover focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs text-fb-text focus:outline-none"
                />
              </div>

              {/** Cột 3: Mô tả Hạng mục */}
              <div className="space-y-2 bg-fb-surface-hover/20 p-4 rounded-xl border border-fb-surface-hover/40 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-fb-text mb-1">3. Lưu ý Hạng Mục</label>
                  <p className="text-[11px] text-fb-text-muted leading-relaxed">
                    Hạng mục được lưu vào CSDL và đồng bộ trực tiếp lên Facebook qua Meta Graph API. Hạng mục này cũng đóng vai trò gợi ý quan trọng để AI định hình ngữ cảnh vẽ ảnh.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/** ========================================== */}
      {/** KHÔNG GIAN LÀM VIỆC THEO TAB */}
      {/** ========================================== */}

      {/** TAB 1: VISUAL CARD GRID - BỘ NHẬN DIỆN ẢNH (AVATAR & COVER) */}
      {activeTab === 'branding' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-fb-text-muted px-1">
            <span>Hiển thị: <b>{filteredPages.length}</b> Fanpage</span>
            <span>Đang chọn: <b className="text-cyan-400">{selectedPageIds.length}</b> Fanpage</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPages.map(page => {
              const pId = page.internalId || page.id;
              const avatarUrl = (page as any).brandingAvatarUrl || (page as any).branding_avatar_url || page.avatar;
              const coverUrl = (page as any).brandingCoverUrl || (page as any).branding_cover_url;
              const isSelected = selectedPageIds.includes(page.id);
              const pLoading = loadingPages[pId] || {};

              return (
                <div 
                  key={page.id} 
                  className={`bg-fb-surface rounded-2xl border transition-all duration-200 overflow-hidden shadow-lg flex flex-col justify-between ${
                    isSelected ? 'border-cyan-500 ring-1 ring-cyan-500/30' : 'border-fb-surface-hover/60 hover:border-fb-surface-hover'
                  }`}
                >
                  {/** Khung Ảnh Bìa (Cover Banner 16:9) */}
                  <div className="relative w-full aspect-[16/9] bg-slate-900 overflow-hidden group">
                    {coverUrl ? (
                      <img 
                        src={coverUrl} 
                        alt="Ảnh bìa 2K" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900/90 gap-1.5">
                        <span className="material-symbols-outlined text-4xl opacity-50">landscape</span>
                        <span className="text-[11px] font-bold">Chưa có ảnh bìa 2K</span>
                      </div>
                    )}

                    {/** Overlay controls trên ảnh bìa */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 flex items-start justify-between p-3 opacity-90 group-hover:opacity-100 transition-opacity">
                      {/** Checkbox chọn card */}
                      <label 
                        className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700/80 cursor-pointer"
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) setSelectedPageIds(prev => prev.filter(id => id !== page.id));
                            else setSelectedPageIds(prev => [...prev, page.id]);
                          }}
                          className="w-4 h-4 rounded border-slate-600 text-cyan-600 focus:ring-0 bg-slate-900 cursor-pointer"
                        />
                      </label>

                      {/** Badge trạng thái & Zoom */}
                      <div className="flex items-center gap-1.5">
                        {coverUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage({ url: coverUrl, title: `Ảnh bìa 2K: ${page.name}` })}
                            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700/70"
                            title="Phóng to ảnh bìa 2K"
                          >
                            <span className="material-symbols-outlined text-sm">fullscreen</span>
                          </button>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md border ${
                          coverUrl && avatarUrl
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {coverUrl && avatarUrl ? 'Đủ Bộ 2K' : 'Chưa Đủ Ảnh'}
                        </span>
                      </div>
                    </div>

                    {/** Nút tải ảnh bìa thủ công */}
                    <button
                      type="button"
                      onClick={() => triggerManualUpload(page, 'cover')}
                      className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-slate-200 text-[10px] font-bold backdrop-blur-md border border-slate-700/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                      title="Upload ảnh bìa thủ công"
                    >
                      <span className="material-symbols-outlined text-xs">upload</span>
                      <span>Upload Bìa</span>
                    </button>
                  </div>

                  {/** Thông tin Fanpage & Avatar */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="flex items-start gap-3">
                      {/** Avatar tròn 1:1 */}
                      <div className="relative group shrink-0">
                        <div className="w-13 h-13 rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-900 shadow-md">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-bold">
                              No Ava
                            </div>
                          )}
                        </div>
                        {/** Nút tải avatar thủ công */}
                        <button
                          type="button"
                          onClick={() => triggerManualUpload(page, 'avatar')}
                          className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs rounded-2xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Tải avatar thủ công"
                        >
                          <span className="material-symbols-outlined text-sm">upload</span>
                        </button>
                      </div>

                      {/** Tên & Thông tin phụ */}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-fb-text truncate" title={page.name}>
                          {ztteam_decodeHtmlEntity(page.name)}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-fb-text-muted truncate">
                          <span>{page.category || 'Chưa có hạng mục'}</span>
                          <span>•</span>
                          <span className="truncate">{page.businessName || 'Cá nhân'}</span>
                        </div>
                        <div className="text-[10px] text-fb-text-muted mt-0.5 font-mono">
                          ID: {page.id}
                        </div>
                      </div>
                    </div>

                    {/** Thao tác nhanh trên từng Card */}
                    <div className="pt-3 border-t border-fb-surface-hover/50 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSingleRegenerateItem(page, 'cover')}
                          disabled={pLoading.cover || pLoading.both}
                          className="px-2 py-1 rounded-lg bg-fb-surface-hover/50 hover:bg-fb-surface-hover text-slate-300 hover:text-white text-[11px] font-bold border border-fb-surface-hover flex items-center gap-1 transition-all disabled:opacity-50"
                          title="Vẽ lại riêng ảnh bìa 2K bằng Gemini"
                        >
                          {pLoading.cover ? (
                            <span className="material-symbols-outlined animate-spin text-xs">sync</span>
                          ) : (
                            <span className="material-symbols-outlined text-xs text-cyan-400">landscape</span>
                          )}
                          <span>Vẽ Bìa</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSingleRegenerateItem(page, 'avatar')}
                          disabled={pLoading.avatar || pLoading.both}
                          className="px-2 py-1 rounded-lg bg-fb-surface-hover/50 hover:bg-fb-surface-hover text-slate-300 hover:text-white text-[11px] font-bold border border-fb-surface-hover flex items-center gap-1 transition-all disabled:opacity-50"
                          title="Vẽ lại riêng Avatar 1:1 bằng Gemini"
                        >
                          {pLoading.avatar ? (
                            <span className="material-symbols-outlined animate-spin text-xs">sync</span>
                          ) : (
                            <span className="material-symbols-outlined text-xs text-cyan-400">account_circle</span>
                          )}
                          <span>Vẽ Ava</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSingleGenerateBoth(page)}
                          disabled={pLoading.both || pLoading.avatar || pLoading.cover}
                          className="px-2 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-[11px] font-bold border border-cyan-500/40 flex items-center gap-1 transition-all disabled:opacity-50"
                          title="Tạo cả bộ Avatar & Bìa 2K"
                        >
                          {pLoading.both ? (
                            <span className="material-symbols-outlined animate-spin text-xs">sync</span>
                          ) : (
                            <span className="material-symbols-outlined text-xs">auto_awesome</span>
                          )}
                          <span>Cả Bộ</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSingleApply(page)}
                          disabled={pLoading.apply || (!coverUrl && !avatarUrl)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/40 flex items-center gap-1 transition-all disabled:opacity-40"
                          title="Gắn trực tiếp bộ ảnh lên Facebook thật"
                        >
                          {pLoading.apply ? (
                            <span className="material-symbols-outlined animate-spin text-xs">sync</span>
                          ) : (
                            <span className="material-symbols-outlined text-xs">cloud_upload</span>
                          )}
                          <span>Gắn Lên FB</span>
                        </button>

                        <Link
                          to={`/facebook/pages/${pId}/settings`}
                          className="p-1 rounded-lg hover:bg-fb-surface-hover text-fb-text-muted hover:text-white transition-colors"
                          title="Mở cài đặt chi tiết trang này"
                        >
                          <span className="material-symbols-outlined text-sm">settings</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/** TAB 2: INTERACTIVE TABLE - TÁC VỤ RIÊNG BIỆT: MÔ TẢ FANPAGE (100% TIẾNG ANH) */}
      {activeTab === 'bio' && (
        <div className="bg-fb-surface rounded-2xl border border-fb-surface-hover/60 shadow-xl overflow-hidden space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fb-text-muted pb-3 border-b border-fb-surface-hover/50">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-fb-text flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-teal-400">psychology</span>
                <span>Engine AI Tạo Mô Tả:</span>
              </span>
              <div className="inline-flex p-0.5 rounded-xl bg-fb-surface-hover/60 border border-fb-surface-hover/80">
                <button
                  type="button"
                  onClick={() => setBioAiProvider('deepseek')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    bioAiProvider === 'deepseek'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-sm'
                      : 'text-fb-text-muted hover:text-fb-text'
                  }`}
                  title="Sử dụng DeepSeek AI (deepseek-chat) tối ưu ngữ nghĩa tiếng Anh"
                >
                  <span className="material-symbols-outlined text-[15px] text-cyan-400">smart_toy</span>
                  <span>DeepSeek AI</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Khuyên dùng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBioAiProvider('gemini')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    bioAiProvider === 'gemini'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-sm'
                      : 'text-fb-text-muted hover:text-fb-text'
                  }`}
                  title="Sử dụng Google Gemini AI"
                >
                  <span className="material-symbols-outlined text-[15px] text-amber-400">auto_awesome</span>
                  <span>Google Gemini</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-teal-400 flex items-center gap-2">
              <span>Hiển thị: <b>{filteredPages.length}</b> • Đang chọn: <b className="text-teal-300">{selectedPageIds.length}</b> Page</span>
              <span>•</span>
              <span>120 – 220 ký tự (100% English Bio)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-fb-surface-hover/80 text-[11px] font-bold text-fb-text-muted uppercase tracking-wider bg-fb-surface-hover/20">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedPageIds.length === filteredPages.length && filteredPages.length > 0}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-slate-600 text-teal-600 focus:ring-0 bg-slate-900 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 w-64">Fanpage</th>
                  <th className="py-3 px-4">Nội Dung Mô Tả (100% Tiếng Anh) - Chỉnh Sửa Trực Tiếp</th>
                  <th className="py-3 px-4 w-48 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fb-surface-hover/40 text-xs">
                {filteredPages.map(page => {
                  const pId = page.internalId || page.id;
                  const isSelected = selectedPageIds.includes(page.id);
                  const pLoading = loadingPages[pId] || {};
                  const currentBio = editedBios[pId] || '';
                  const bioLength = currentBio.length;

                  return (
                    <tr key={page.id} className={`hover:bg-fb-surface-hover/30 transition-colors ${isSelected ? 'bg-teal-500/5' : ''}`}>
                      {/** Checkbox */}
                      <td className="py-3 px-3 text-center align-top pt-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) setSelectedPageIds(prev => prev.filter(id => id !== page.id));
                            else setSelectedPageIds(prev => [...prev, page.id]);
                          }}
                          className="w-4 h-4 rounded border-slate-600 text-teal-600 focus:ring-0 bg-slate-900 cursor-pointer"
                        />
                      </td>

                      {/** Fanpage Info */}
                      <td className="py-3 px-4 align-top">
                        <div className="font-bold text-fb-text truncate" title={page.name}>
                          {ztteam_decodeHtmlEntity(page.name)}
                        </div>
                        <div className="text-[11px] text-fb-text-muted mt-0.5 truncate">
                          {page.category || 'Chưa phân loại'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {page.businessName || 'Cá nhân'}
                        </div>
                      </td>

                      {/** Inline Editable Bio Textarea */}
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1.5">
                          <textarea
                            rows={3}
                            value={currentBio}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedBios(prev => ({ ...prev, [pId]: val }));
                              setSavedBioStatus(prev => ({ ...prev, [pId]: false }));
                            }}
                            placeholder="Nhấn vào nút 'Viết Bằng AI' hoặc tự gõ mô tả tiếng Anh tại đây..."
                            className="w-full bg-slate-900/70 border border-slate-700/80 focus:border-teal-500 rounded-xl p-2.5 text-xs text-fb-text focus:outline-none transition-colors resize-y leading-relaxed font-sans"
                          />
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold ${
                                bioLength === 0 
                                  ? 'text-slate-500' 
                                  : bioLength > 255 
                                    ? 'text-red-400' 
                                    : bioLength >= 120 
                                      ? 'text-emerald-400' 
                                      : 'text-amber-400'
                              }`}>
                                {bioLength} / 220 ký tự
                              </span>
                              {bioLength > 255 && (
                                <span className="text-red-400 text-[10px]">Quá 255 ký tự (FB có thể từ chối)</span>
                              )}
                              {savedBioStatus[pId] && (
                                <span className="text-emerald-400 text-[10px] flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-xs">check_circle</span>
                                  Đã đồng bộ lên FB
                                </span>
                              )}
                            </div>

                            <span className="text-fb-text-muted text-[10px]">
                              {bioLength >= 120 && bioLength <= 220 ? 'Chuẩn Bio Meta' : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/** Actions */}
                      <td className="py-3 px-4 align-top text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSingleGenerateBio(page)}
                            disabled={pLoading.bio}
                            className="px-3 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 text-xs font-bold border border-teal-500/40 flex items-center gap-1.5 transition-all disabled:opacity-50 w-full justify-center"
                            title={`Tạo mới mô tả bằng ${bioAiProvider === 'deepseek' ? 'DeepSeek AI' : 'Google Gemini'} theo chủ đề`}
                          >
                            {pLoading.bio ? (
                              <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                            ) : (
                              <span className="material-symbols-outlined text-sm">auto_awesome</span>
                            )}
                            <span>Viết Bằng {bioAiProvider === 'deepseek' ? 'DeepSeek' : 'Gemini'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSingleUpdateBio(page)}
                            disabled={pLoading.apply || !currentBio.trim()}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50 w-full justify-center"
                            title="Cập nhật trực tiếp lên Fanpage Facebook thật"
                          >
                            {pLoading.apply ? (
                              <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                            ) : (
                              <span className="material-symbols-outlined text-sm">publish</span>
                            )}
                            <span>Cập Nhật FB</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/** TAB 3: HẠNG MỤC FANPAGE HÀNG LOẠT */}
      {activeTab === 'category' && (
        <div className="bg-fb-surface rounded-2xl border border-fb-surface-hover/60 shadow-xl overflow-hidden p-5 space-y-4">
          <div className="flex items-center justify-between text-xs text-fb-text-muted pb-2 border-b border-fb-surface-hover/50">
            <span>Hiển thị: <b>{filteredPages.length}</b> Fanpage</span>
            <span>Đang chọn: <b className="text-blue-400">{selectedPageIds.length}</b> Fanpage</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-fb-surface-hover/80 text-[11px] font-bold text-fb-text-muted uppercase tracking-wider bg-fb-surface-hover/20">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedPageIds.length === filteredPages.length && filteredPages.length > 0}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-0 bg-slate-900 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Fanpage</th>
                  <th className="py-3 px-4">Doanh Nghiệp (BM)</th>
                  <th className="py-3 px-4">Hạng Mục Hiện Tại</th>
                  <th className="py-3 px-4 text-right">ID Facebook</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fb-surface-hover/40 text-xs">
                {filteredPages.map(page => {
                  const isSelected = selectedPageIds.includes(page.id);
                  return (
                    <tr key={page.id} className={`hover:bg-fb-surface-hover/30 transition-colors ${isSelected ? 'bg-blue-500/5' : ''}`}>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) setSelectedPageIds(prev => prev.filter(id => id !== page.id));
                            else setSelectedPageIds(prev => [...prev, page.id]);
                          }}
                          className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-0 bg-slate-900 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-bold text-fb-text truncate">
                        {ztteam_decodeHtmlEntity(page.name)}
                      </td>
                      <td className="py-3 px-4 text-fb-text-muted truncate">
                        {page.businessName || 'Cá nhân'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {page.category || 'Chưa thiết lập'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-fb-text-muted text-right">
                        {page.id}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

# Visual Guide: Published Course Edit Page - PHASE 4.71

## Published Course Status Alert & Buttons Layout

### Current State (Published Course)

```
┌─────────────────────────────────────────────────────────────┐
│                    Edit Kursus                              │
│  Perbarui informasi dan konten kursus Anda untuk memberikan │
│  pengalaman belajar terbaik                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ [FORM FIELDS - Title, Description, Category, Level, etc.]   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ✓ Kursus Dipublikasikan                                     │
│   Kursus Anda telah disetujui dan sekarang tersedia untuk   │
│   siswa di platform.                                         │
└─────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │🔄 Restore Kursus    │ ← NEW: Always visible
                    └──────────────────────┘

        ┌────────────────────────────────────────┐
        │Ajukan Review Admin untuk Publikasi     │ ← NEW: Always visible
        │         Kursus                          │
        └────────────────────────────────────────┘
```

### After Making Changes (isDirty = true)

```
┌─────────────────────────────────────────────────────────────┐
│ ✓ Kursus Dipublikasikan                                     │
│   Kursus Anda telah disetujui dan sekarang tersedia untuk   │
│   siswa di platform.                                         │
└─────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │🔄 Restore Kursus    │
                    └──────────────────────┘
                    ℹ️ Anda memiliki perubahan yang belum disimpan

        ┌────────────────────────────────────────┐
        │Ajukan Review Admin untuk Publikasi     │
        │         Kursus                          │
        └────────────────────────────────────────┘
```

### Draft Course (For Comparison)

```
┌─────────────────────────────────────────────────────────────┐
│ ✓ Draft Status                                              │
│   Kursus masih dalam tahap draft dan belum dipublikasikan   │
└─────────────────────────────────────────────────────────────┘

        ┌────────────────────────────────────┐
        │ Ajukan Publikasi Kursus            │ ← Different text
        └────────────────────────────────────┘
```

### Rejected Course (For Comparison)

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Kursus Ditolak                                           │
│   Alasan dari Admin:                                        │
│   "Konten kurang lengkap, tambahkan lebih banyak materi"    │
└─────────────────────────────────────────────────────────────┘

        ┌────────────────────────────────────┐
        │ Ajukan Ulang Publikasi Kursus      │ ← Different text
        └────────────────────────────────────┘
```

## Button Behavior Details

### "Restore Kursus" Button

**When Visible:**
- ✅ Published courses (always, new in 4.71)

**Action on Click:**
1. Shows warning confirmation dialog
2. Lists all changes that will be discarded
3. Resets course to published version
4. Clears all unsaved changes
5. Sets isDirty = false
6. Helper text disappears

**Styling:**
- Color: Orange gradient (#f39c12 → #e67e22)
- Icon: undo (↻)
- Hover Effect: Lifts up with enhanced shadow

**Disabled When:**
- API call in progress (submitStatus === "submitting")

---

### "Ajukan Review Admin untuk Publikasi Kursus" Button

**When Visible:**
- ✅ Draft courses (unchanged)
- ✅ Review courses (unchanged)
- ✅ Rejected courses (unchanged)
- ✅ Published courses (NEW in 4.71)

**Button Text Variations:**
- **Draft**: "Ajukan Publikasi Kursus"
- **Rejected**: "Ajukan Ulang Publikasi Kursus"
- **Review**: "Ajukan Publikasi Kursus"
- **Published**: "Ajukan Review Admin untuk Publikasi Kursus" ← NEW

**Action on Click:**
1. Shows context-aware confirmation dialog
2. For published courses: explains updates will be reviewed
3. Indicates course stays live during review
4. On confirmation: submits to `/teacher/course-publish/`
5. Sets platform_status = "Review"
6. Sets review_submitted_date = now()

**Styling:**
- Color: Blue gradient (#2196F3 → #1976D2) when enabled
- Color: Gray gradient when disabled
- Icon: paper-plane (✈️)
- Hover Effect: Lifts up with enhanced shadow

**Disabled When:**
- !canPublish (validation fails)
- isPublishing (API call in progress)
- submitStatus === "submitting"

---

## Confirmation Dialog Examples

### For Published Course - Restore Action

```
┌─────────────────────────────────────────────────────────┐
│ Kembalikan ke Versi Dipublikasikan?                    │
├─────────────────────────────────────────────────────────┤
│ Apakah Anda yakin ingin mengembalikan kursus ke versi   │
│ yang terakhir dipublikasikan?                           │
│                                                          │
│ ⚠️ WARNING:                                             │
│    Semua perubahan yang belum disimpan akan dihapus     │
│    dan kursus akan dikembalikan ke keadaan terakhir     │
│    yang dipublikasikan.                                 │
├─────────────────────────────────────────────────────────┤
│  [Batal]  [Ya, Kembalikan (Red)]                        │
└─────────────────────────────────────────────────────────┘
```

### For Published Course - Republication Action

```
┌─────────────────────────────────────────────────────────┐
│ Ajukan Perubahan Kursus untuk Publikasi?               │
├─────────────────────────────────────────────────────────┤
│ Apakah Anda siap untuk mengajukan perubahan pada       │
│ "Nama Kursus" untuk persetujuan publikasi dari admin?   │
│                                                          │
│ ℹ️ Informasi Update Publikasi:                         │
│   • Perubahan Anda akan diajukan untuk persetujuan     │
│   • Admin akan meninjau perubahan dan konten terbaru   │
│   • Kursus tetap dapat diakses siswa selama review ✓  │
│   • Perubahan akan langsung diterapkan jika disetujui  │
│                                                          │
│ ⚠️ Catatan:                                             │
│    Pastikan kursus Anda sudah lengkap dengan          │
│    kurikulum, pelajaran, dan kuis berkualitas          │
├─────────────────────────────────────────────────────────┤
│  [Belum] [Ya, Ajukan Perubahan (Blue)]                │
└─────────────────────────────────────────────────────────┘
```

### For Draft Course - Initial Publication Action

```
┌─────────────────────────────────────────────────────────┐
│ Ajukan Kursus untuk Publikasi?                         │
├─────────────────────────────────────────────────────────┤
│ Apakah Anda siap untuk mengajukan "Nama Kursus"        │
│ untuk persetujuan publikasi dari admin?                │
│                                                          │
│ ℹ️ Alur Persetujuan Publikasi:                        │
│   • Kursus Anda akan diajukan untuk persetujuan        │
│   • Admin akan meninjau konten dan kualitas kursus     │
│   • Jika disetujui, kursus akan dipublikasikan ✓      │
│   • Jika ditolak, Anda akan menerima feedback          │
│                                                          │
│ ⚠️ Catatan:                                             │
│    Pastikan kursus Anda sudah lengkap dengan          │
│    kurikulum, pelajaran, dan kuis berkualitas          │
├─────────────────────────────────────────────────────────┤
│  [Belum] [Ya, Ajukan Publikasi Kursus (Blue)]         │
└─────────────────────────────────────────────────────────┘
```

## Success Messages

### After Restoring Published Course

```
┌──────────────────────────────────────┐
│ ✓ Kursus Dikembalikan!               │
│                                      │
│ Kursus telah berhasil dikembalikan   │
│ ke versi yang terakhir dipublikasikan│
└──────────────────────────────────────┘
(Toast - 4 second auto-dismiss)
```

### After Submitting Draft Course for Publication

```
┌─────────────────────────────────────────────────────┐
│ ✓ Kursus Diajukan untuk Publikasi!                │
├─────────────────────────────────────────────────────┤
│ "Nama Kursus" telah berhasil diajukan untuk       │
│ persetujuan publikasi.                             │
│                                                    │
│ ✓ Status Terbaru:                                 │
│   • ✓ 5 bagian kurikulum                          │
│   • ✓ 12 pelajaran                                │
│   • ⏳ Menunggu persetujuan publikasi dari admin   │
│                                                    │
│ ℹ️ Apa yang terjadi selanjutnya?                  │
│   1. Admin akan meninjau konten dan kualitas     │
│   2. Anda akan menerima notifikasi saat keputusan│
│   3. Jika disetujui, kursus akan dipublikasikan  │
│   4. Jika perlu perbaikan, kami akan memberikan  │
│      feedback spesifik                            │
│                                                    │
│  [OK]                                             │
└─────────────────────────────────────────────────────┘
```

### After Submitting Published Course for Updates

```
┌─────────────────────────────────────────────────────┐
│ ✓ Perubahan Kursus Diajukan!        (NEW MESSAGE)  │
├─────────────────────────────────────────────────────┤
│ Perubahan "Nama Kursus" telah berhasil diajukan   │
│ untuk persetujuan admin.                           │
│                                                    │
│ ✓ Status Update:                                   │
│   • ✓ Perubahan Anda sedang ditinjau oleh admin   │
│   • ✓ Kursus tetap dapat diakses siswa ✨ NEW    │
│   • ⏳ Menunggu persetujuan publikasi dari admin   │
│                                                    │
│ ℹ️ Apa yang terjadi selanjutnya?                  │
│   1. Admin akan meninjau perubahan konten Anda   │
│   2. Anda akan menerima notifikasi tentang        │
│      persetujuan atau permintaan revisi           │
│   3. Jika disetujui, perubahan akan diterapkan   │
│      untuk semua siswa                            │
│   4. Jika perlu perbaikan, kami akan memberikan  │
│      feedback spesifik                            │
│                                                    │
│  [OK]                                             │
└─────────────────────────────────────────────────────┘
```

## Key Differences Summarized

| Scenario | Before | After |
|----------|--------|-------|
| **Published course edit page** | - Restore button only if isDirty | + Always shows Restore button |
| **Published course buttons** | - Only Simpan Draf available | + Simpan Draf + Restore + Ajukan Review |
| **Restore button helper** | - Always says "perubahan belum disimpan" | + Only shows if isDirty |
| **Submit button text (Published)** | - Not available | + "Ajukan Review Admin untuk Publikasi Kursus" |
| **Course stays live during review** | - N/A | + Yes, explicitly mentioned in dialog |
| **Confirm button text** | - "Ajukan Publikasi" | + "Ajukan Perubahan untuk Publikasi" (for republication) |


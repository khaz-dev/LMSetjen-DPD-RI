import os
import io
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_default_certificate_pptx():
    """
    Generate an official PowerPoint (.pptx) template for LMSetjen DPD RI certificates.
    Slide 1: Certificate Layout with placeholders ({{NAMA_SISWA}}, {{JUDUL_KURSUS}}, etc.)
    Slide 2: Comprehensive Guide & Variable Cheatsheet
    """
    prs = Presentation()
    # A4 Landscape standard (11.693 x 8.268 inches = 29.7 x 21.0 cm)
    prs.slide_width = Inches(11.693)
    prs.slide_height = Inches(8.268)

    blank_layout = prs.slide_layouts[6]

    # ==========================================
    # SLIDE 1: CERTIFICATE LAYOUT TEMPLATE
    # ==========================================
    slide1 = prs.slides.add_slide(blank_layout)

    # Outer Emerald Border
    border_outer = slide1.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0.2), Inches(0.2), Inches(11.293), Inches(7.868)
    )
    border_outer.fill.background()
    border_outer.line.color.rgb = RGBColor(6, 78, 59) # Deep Forest Emerald (#064e3b)
    border_outer.line.width = Pt(4.5)

    # Inner Gold Border
    border_inner = slide1.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0.28), Inches(0.28), Inches(11.133), Inches(7.708)
    )
    border_inner.fill.background()
    border_inner.line.color.rgb = RGBColor(180, 83, 9) # Amber Gold (#b45309)
    border_inner.line.width = Pt(1.5)

    # 1. Header (Kop Surat Lembaga)
    tb_header = slide1.shapes.add_textbox(Inches(1.2), Inches(0.45), Inches(9.293), Inches(1.0))
    tf_h = tb_header.text_frame
    tf_h.word_wrap = True
    
    p1 = tf_h.paragraphs[0]
    p1.text = 'DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA'
    p1.font.name = 'Times New Roman'
    p1.font.size = Pt(12)
    p1.font.bold = True
    p1.font.color.rgb = RGBColor(15, 23, 42)
    p1.alignment = PP_ALIGN.CENTER

    p2 = tf_h.add_paragraph()
    p2.text = 'SEKRETARIAT JENDERAL'
    p2.font.name = 'Times New Roman'
    p2.font.size = Pt(16.5)
    p2.font.bold = True
    p2.font.color.rgb = RGBColor(6, 78, 59)
    p2.alignment = PP_ALIGN.CENTER

    p3 = tf_h.add_paragraph()
    p3.text = 'PUSAT PENGEMBANGAN SUMBER DAYA MANUSIA APARATUR'
    p3.font.name = 'Arial'
    p3.font.size = Pt(9.5)
    p3.font.bold = True
    p3.font.color.rgb = RGBColor(71, 85, 105)
    p3.alignment = PP_ALIGN.CENTER

    # 2. Certificate Title & Registration Number
    tb_title = slide1.shapes.add_textbox(Inches(1), Inches(1.65), Inches(9.693), Inches(1.15))
    tf_t = tb_title.text_frame
    tf_t.word_wrap = True
    
    pt1 = tf_t.paragraphs[0]
    pt1.text = 'SERTIFIKAT KELULUSAN'
    pt1.font.name = 'Georgia'
    pt1.font.size = Pt(28)
    pt1.font.bold = True
    pt1.font.color.rgb = RGBColor(6, 78, 59)
    pt1.alignment = PP_ALIGN.CENTER

    pt2 = tf_t.add_paragraph()
    pt2.text = 'NOMOR: {{NOMOR_SERTIFIKAT}}'
    pt2.font.name = 'Courier New'
    pt2.font.size = Pt(10)
    pt2.font.bold = True
    pt2.font.color.rgb = RGBColor(30, 41, 59)
    pt2.alignment = PP_ALIGN.CENTER

    # 3. Recipient Section
    tb_rec = slide1.shapes.add_textbox(Inches(1), Inches(2.95), Inches(9.693), Inches(1.3))
    tf_r = tb_rec.text_frame
    tf_r.word_wrap = True
    
    pr1 = tf_r.paragraphs[0]
    pr1.text = 'Diberikan dengan penuh kehormatan kepada:'
    pr1.font.name = 'Georgia'
    pr1.font.size = Pt(11)
    pr1.font.italic = True
    pr1.font.color.rgb = RGBColor(100, 116, 139)
    pr1.alignment = PP_ALIGN.CENTER

    pr2 = tf_r.add_paragraph()
    pr2.text = '{{NAMA_SISWA}}'
    pr2.font.name = 'Georgia'
    pr2.font.size = Pt(26)
    pr2.font.bold = True
    pr2.font.color.rgb = RGBColor(4, 47, 46)
    pr2.alignment = PP_ALIGN.CENTER

    pr3 = tf_r.add_paragraph()
    pr3.text = '{{NIP_PEGAWAI}} • {{JABATAN_PEGAWAI}}'
    pr3.font.name = 'Arial'
    pr3.font.size = Pt(11)
    pr3.font.bold = True
    pr3.font.color.rgb = RGBColor(71, 85, 105)
    pr3.alignment = PP_ALIGN.CENTER

    # 4. Achievement & Course Statement
    tb_body = slide1.shapes.add_textbox(Inches(1), Inches(4.35), Inches(9.693), Inches(1.5))
    tf_b = tb_body.text_frame
    tf_b.word_wrap = True
    
    pb1 = tf_b.paragraphs[0]
    pb1.text = 'Telah berhasil dan berintegritas menyelesaikan seluruh materi pembelajaran mandiri, penugasan studi kasus, serta memenuhi standar evaluasi kelulusan pada program:'
    pb1.font.name = 'Arial'
    pb1.font.size = Pt(10)
    pb1.font.color.rgb = RGBColor(51, 65, 85)
    pb1.alignment = PP_ALIGN.CENTER

    pb2 = tf_b.add_paragraph()
    pb2.text = '“{{JUDUL_KURSUS}}”'
    pb2.font.name = 'Georgia'
    pb2.font.size = Pt(18)
    pb2.font.bold = True
    pb2.font.color.rgb = RGBColor(15, 23, 42)
    pb2.alignment = PP_ALIGN.CENTER

    pb3 = tf_b.add_paragraph()
    pb3.text = '[ Beban Belajar: {{TOTAL_JP}} | Kategori: {{KATEGORI_KURSUS}} | Predikat: Lulus Memuaskan ]'
    pb3.font.name = 'Arial'
    pb3.font.size = Pt(9)
    pb3.font.bold = True
    pb3.font.color.rgb = RGBColor(13, 148, 136)
    pb3.alignment = PP_ALIGN.CENTER

    # 5. Footer Triad: QR Code, Seal, Signature
    # Left: QR Code Box
    tb_qr = slide1.shapes.add_textbox(Inches(0.6), Inches(6.15), Inches(2.8), Inches(1.4))
    tf_qr = tb_qr.text_frame
    tf_qr.word_wrap = True
    pq1 = tf_qr.paragraphs[0]
    pq1.text = '[ AREA KODE QR ]'
    pq1.font.size = Pt(10)
    pq1.font.bold = True
    pq1.font.color.rgb = RGBColor(6, 78, 59)
    pq2 = tf_qr.add_paragraph()
    pq2.text = 'Pindai QR untuk verifikasi keabsahan dokumen:\n{{KODE_QR}}'
    pq2.font.size = Pt(8)
    pq2.font.color.rgb = RGBColor(100, 116, 139)

    # Center: Official Seal Placeholder
    tb_seal = slide1.shapes.add_textbox(Inches(4.45), Inches(6.15), Inches(2.793), Inches(1.4))
    tf_s = tb_seal.text_frame
    tf_s.word_wrap = True
    ps1 = tf_s.paragraphs[0]
    ps1.text = '★ MEDALI SEGEL RESMI ★'
    ps1.font.size = Pt(10)
    ps1.font.bold = True
    ps1.font.color.rgb = RGBColor(180, 83, 9)
    ps1.alignment = PP_ALIGN.CENTER
    ps2 = tf_s.add_paragraph()
    ps2.text = 'Dokumen Elektronik Sah\nSekretariat Jenderal DPD RI'
    ps2.font.size = Pt(8)
    ps2.font.color.rgb = RGBColor(100, 116, 139)
    ps2.alignment = PP_ALIGN.CENTER

    # Right: Signature Box
    tb_sig = slide1.shapes.add_textbox(Inches(8.25), Inches(6.15), Inches(2.8), Inches(1.4))
    tf_sg = tb_sig.text_frame
    tf_sg.word_wrap = True
    psg1 = tf_sg.paragraphs[0]
    psg1.text = 'Jakarta, {{TANGGAL_LULUS}}'
    psg1.font.size = Pt(9.5)
    psg1.font.color.rgb = RGBColor(51, 65, 85)
    psg1.alignment = PP_ALIGN.CENTER
    psg2 = tf_sg.add_paragraph()
    psg2.text = '{{JABATAN_PENANDATANGAN}}'
    psg2.font.size = Pt(9)
    psg2.font.color.rgb = RGBColor(71, 85, 105)
    psg2.alignment = PP_ALIGN.CENTER
    psg3 = tf_sg.add_paragraph()
    psg3.text = '\n{{NAMA_INSTRUKTUR}}'
    psg3.font.size = Pt(11)
    psg3.font.bold = True
    psg3.font.underline = True
    psg3.font.color.rgb = RGBColor(15, 23, 42)
    psg3.alignment = PP_ALIGN.CENTER

    # ==========================================
    # SLIDE 2: USER GUIDE & VARIABLE CHEATSHEET
    # ==========================================
    slide2 = prs.slides.add_slide(blank_layout)
    tb_guide = slide2.shapes.add_textbox(Inches(0.6), Inches(0.5), Inches(10.493), Inches(7.2))
    tf_g = tb_guide.text_frame
    tf_g.word_wrap = True
    
    pg1 = tf_g.paragraphs[0]
    pg1.text = 'PANDUAN & PETUNJUK PENGGUNAAN TEMPLATE SERTIFIKAT LMSETJEN DPD RI'
    pg1.font.size = Pt(16)
    pg1.font.bold = True
    pg1.font.color.rgb = RGBColor(6, 78, 59)

    guide_text = (
        "\n1. CARA KUSTOMISASI DESAIN MELALUI POWERPOINT:\n"
        "   • Buka Slide 1, Anda dapat bebas mengganti gambar latar (background), warna garis bingkai, "
        "jenis huruf (font), ukuran font, serta memindahkan posisi kotak teks sesuai selera.\n"
        "   • Ukuran slide telah diset ke A4 Landscape (29.7 x 21.0 cm) untuk hasil cetak dan pratinjau digital optimal.\n\n"
        "2. DAFTAR VARIABEL DINAMIS SISTEM (WAJIB PERTAHANKAN FORMAT DI DALAM KURUNG KURAWAL GANDA):\n"
        "   • {{NAMA_SISWA}}           : Nama lengkap peserta pelatihan / ASN penerima sertifikat.\n"
        "   • {{NIP_PEGAWAI}}          : Nomor Induk Pegawai (Format otomatis: NIP. 19850315...).\n"
        "   • {{JABATAN_PEGAWAI}}      : Jabatan kedinasan peserta pelatihan.\n"
        "   • {{UNIT_KERJA}}           : Satuan kerja / Biro / Pusat penempatan peserta.\n"
        "   • {{JUDUL_KURSUS}}         : Judul atau nama program pelatihan.\n"
        "   • {{NOMOR_SERTIFIKAT}}     : Nomor resmi sertifikat (contoh: KP.04/LMS/211358/DPDRI/XI/2026).\n"
        "   • {{TANGGAL_LULUS}}        : Tanggal kelulusan dalam bahasa Indonesia (contoh: 06 November 2026).\n"
        "   • {{TOTAL_JP}}             : Total jam pelajaran (contoh: 2 Jam Pelatihan (JP)).\n"
        "   • {{KATEGORI_KURSUS}}      : Kategori materi kursus (contoh: Teknis, Manajerial).\n"
        "   • {{NAMA_INSTRUKTUR}}      : Nama instruktur atau fasilitator pengampu pelatihan.\n"
        "   • {{JABATAN_PENANDATANGAN}}: Jabatan resmi pengampu / verifikator kelulusan.\n"
        "   • {{NIP_PENANDATANGAN}}    : Nomor Induk Pegawai pejabat penandatangan.\n"
        "   • {{KODE_QR}}              : Posisi kode QR verifikasi keabsahan digital LMS Setjen DPD RI.\n\n"
        "3. CARA MENERAPKAN KE SISTEM:\n"
        "   • Opsi A (Upload Background): Simpan Slide 1 sebagai gambar ('Save As Picture' -> PNG), lalu unggah di halaman Pengaturan Sertifikat Admin.\n"
        "   • Opsi B (Upload PPTX): Simpan file PPTX ini, lalu unggah file ke halaman Pengaturan Sertifikat Admin sebagai template arsip master."
    )
    pg2 = tf_g.add_paragraph()
    pg2.text = guide_text
    pg2.font.size = Pt(10)
    pg2.font.color.rgb = RGBColor(30, 41, 59)

    # Save to memory buffer
    buffer = io.BytesIO()
    prs.save(buffer)
    buffer.seek(0)
    return buffer

def inspect_pptx_placeholders(file_path):
    """
    Inspect an uploaded PPTX file to verify that required certificate placeholders are present.
    Returns a dict with detected placeholders and validity.
    """
    known_placeholders = [
        '{{NAMA_SISWA}}', '{{JUDUL_KURSUS}}', '{{NOMOR_SERTIFIKAT}}',
        '{{TANGGAL_LULUS}}', '{{TOTAL_JP}}', '{{NAMA_INSTRUKTUR}}', '{{KODE_QR}}',
        '{{NIP_PEGAWAI}}', '{{NIP_SISWA}}', '{{JABATAN_PEGAWAI}}', '{{UNIT_KERJA}}',
        '{{JABATAN_PENANDATANGAN}}', '{{NIP_PENANDATANGAN}}'
    ]
    detected = []
    try:
        prs = Presentation(file_path)
        for slide in prs.slides:
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for paragraph in shape.text_frame.paragraphs:
                        text = paragraph.text
                        for p in known_placeholders:
                            if p in text and p not in detected:
                                detected.append(p)
        return {
            'success': True,
            'detected_placeholders': detected,
            'missing_placeholders': [p for p in known_placeholders if p not in detected],
            'slide_count': len(prs.slides)
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'detected_placeholders': []
        }


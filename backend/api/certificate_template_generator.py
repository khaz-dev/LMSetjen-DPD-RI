import os
import io
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def hex_to_rgb(hex_str, default_rgb=(13, 92, 58)):
    try:
        hex_clean = hex_str.lstrip('#')
        if len(hex_clean) == 6:
            return RGBColor(int(hex_clean[0:2], 16), int(hex_clean[2:4], 16), int(hex_clean[4:6], 16))
    except Exception:
        pass
    return RGBColor(*default_rgb)

def create_default_certificate_pptx(config=None, course=None):
    """
    Generate the official PowerPoint (.pptx) template for LMSetjen DPD RI certificates.
    Faithfully mirrors the 'modern-certificate-container' vector design currently active in the system:
    - Fixed A4 Landscape (29.7 x 21.0 cm / 11.693 x 8.268 inches)
    - Emerald & Gold dual borders
    - Dual circular agency logo badges (Setjen DPD RI & LMSetjen DPD RI)
    - Kop Lembaga Resmi & Divider
    - Dynamic variables for Siswa (Nama, NIP, Jabatan, Unit Kerja)
    - Course Statement & Metadata Chips
    - Digital QR Verification block with modular separated white blocks
    - Gold Medallion Seal
    - Official Stamp (Stempel Sekjen trans) & Signature (ttd-okk)
    - Slide 2: Comprehensive Guide & Variable Cheatsheet
    """
    # Attempt to load active config from database
    cfg_data = {
        'primary_color': '#0d5c3a',
        'accent_color': '#c59b27',
        'agency_sup': 'SEKRETARIAT JENDERAL',
        'agency_main': 'DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA',
        'agency_sub': 'BIRO ORGANISASI KEANGGOTAAN DAN KEPEGAWAIAN',
        'certificate_title': 'SERTIFIKAT KELULUSAN',
        'certificate_subtitle': 'Certificate of Completion',
        'statement_text': 'Telah berhasil dan berintegritas menyelesaikan seluruh materi pembelajaran mandiri, penugasan studi kasus, serta memenuhi standar evaluasi kelulusan pada program:',
        'signatory_title': 'Kepala Biro Organisasi Keanggotaan dan Kepegawaian',
        'signatory_sub_title': 'Sekretariat Jenderal DPD RI',
        'signatory_name': 'Dr. Fitriani, A.P., M.Si.',
        'signatory_nip': '19741017 199311 2 001'
    }

    try:
        from api.models import CertificateTemplateConfig
        active_config = config
        if not active_config:
            if course:
                active_config = CertificateTemplateConfig.get_template_for_course(course)
            else:
                active_config = CertificateTemplateConfig.get_active_config()

        if active_config:
            if active_config.primary_color: cfg_data['primary_color'] = active_config.primary_color
            if active_config.accent_color: cfg_data['accent_color'] = active_config.accent_color
            if active_config.agency_sup: cfg_data['agency_sup'] = active_config.agency_sup
            if active_config.agency_main: cfg_data['agency_main'] = active_config.agency_main
            if active_config.agency_sub: cfg_data['agency_sub'] = active_config.agency_sub
            if active_config.certificate_title: cfg_data['certificate_title'] = active_config.certificate_title
            if active_config.certificate_subtitle: cfg_data['certificate_subtitle'] = active_config.certificate_subtitle
            if active_config.statement_text: cfg_data['statement_text'] = active_config.statement_text
            if active_config.signatory_title: cfg_data['signatory_title'] = active_config.signatory_title
            if active_config.signatory_sub_title: cfg_data['signatory_sub_title'] = active_config.signatory_sub_title
            if active_config.signatory_name: cfg_data['signatory_name'] = active_config.signatory_name
            if active_config.signatory_nip: cfg_data['signatory_nip'] = active_config.signatory_nip
    except Exception:
        pass

    prs = Presentation()
    # A4 Landscape standard (11.693 x 8.268 inches = 29.7 x 21.0 cm)
    prs.slide_width = Inches(11.693)
    prs.slide_height = Inches(8.268)

    blank_layout = prs.slide_layouts[6]

    # Resolve image asset paths
    base_dir = Path(__file__).resolve().parent.parent.parent
    path_setjen_logo = base_dir / 'frontend' / 'src' / 'assets' / 'logo' / 'logo-setjen-dpd.png'
    path_lmsetjen_logo = base_dir / 'frontend' / 'src' / 'assets' / 'logo' / 'logo-512.png'
    path_ttd = base_dir / 'frontend' / 'src' / 'assets' / 'ttd-okk.png'
    path_stamp = base_dir / 'frontend' / 'src' / 'assets' / 'stempel-sekjen-trans.png'

    primary_rgb = hex_to_rgb(cfg_data['primary_color'], (13, 92, 58))
    accent_rgb = hex_to_rgb(cfg_data['accent_color'], (197, 155, 39))

    # =========================================================================
    # SLIDE 1: EXACT REPLICA OF modern-certificate-container
    # =========================================================================
    slide1 = prs.slides.add_slide(blank_layout)

    # 1. Subtle Paper Background Fill
    bg_shape = slide1.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(11.693), Inches(8.268)
    )
    bg_shape.fill.solid()
    bg_shape.fill.fore_color.rgb = RGBColor(253, 252, 248) # Warm parchment
    bg_shape.line.fill.background()

    # 2. Outer Deep Emerald Frame
    border_outer = slide1.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0.25), Inches(0.25), Inches(11.193), Inches(7.768)
    )
    border_outer.fill.background()
    border_outer.line.color.rgb = primary_rgb
    border_outer.line.width = Pt(4.5)

    # 3. Inner Gold Inset Frame
    border_inner = slide1.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(0.33), Inches(0.33), Inches(11.033), Inches(7.608)
    )
    border_inner.fill.background()
    border_inner.line.color.rgb = accent_rgb
    border_inner.line.width = Pt(1.5)

    # 4. Corner Ornaments (Classic Geometric Flourishes)
    corner_size = Inches(0.45)
    corners = [
        (Inches(0.35), Inches(0.35)),
        (Inches(11.693 - 0.35 - 0.45), Inches(0.35)),
        (Inches(0.35), Inches(8.268 - 0.35 - 0.45)),
        (Inches(11.693 - 0.35 - 0.45), Inches(8.268 - 0.35 - 0.45))
    ]
    for cx, cy in corners:
        c_box = slide1.shapes.add_shape(MSO_SHAPE.DIAMOND, cx, cy, corner_size, corner_size)
        c_box.fill.solid()
        c_box.fill.fore_color.rgb = RGBColor(255, 255, 255)
        c_box.line.color.rgb = accent_rgb
        c_box.line.width = Pt(1.2)

    # 5. Dual Circular Logo Badges (Left: Setjen DPD RI, Right: LMSetjen DPD RI)
    badge_diam = Inches(1.15)
    badge_inner = Inches(1.0)
    badge_y = Inches(0.50)

    # Left Badge
    badge_l_x = Inches(0.70)
    circle_l = slide1.shapes.add_shape(MSO_SHAPE.OVAL, badge_l_x, badge_y, badge_diam, badge_diam)
    circle_l.fill.solid()
    circle_l.fill.fore_color.rgb = RGBColor(255, 255, 255)
    circle_l.line.color.rgb = RGBColor(255, 255, 255)
    circle_l.line.width = Pt(4)
    if path_setjen_logo.exists():
        slide1.shapes.add_picture(str(path_setjen_logo), badge_l_x + Inches(0.075), badge_y + Inches(0.075), badge_inner, badge_inner)

    # Right Badge
    badge_r_x = Inches(9.843)
    circle_r = slide1.shapes.add_shape(MSO_SHAPE.OVAL, badge_r_x, badge_y, badge_diam, badge_diam)
    circle_r.fill.solid()
    circle_r.fill.fore_color.rgb = RGBColor(255, 255, 255)
    circle_r.line.color.rgb = RGBColor(255, 255, 255)
    circle_r.line.width = Pt(4)
    if path_lmsetjen_logo.exists():
        slide1.shapes.add_picture(str(path_lmsetjen_logo), badge_r_x + Inches(0.075), badge_y + Inches(0.075), badge_inner, badge_inner)

    # 6. Header (Kop Surat Lembaga)
    tb_header = slide1.shapes.add_textbox(Inches(1.85), Inches(0.42), Inches(7.993), Inches(1.1))
    tf_h = tb_header.text_frame
    tf_h.word_wrap = True

    ph1 = tf_h.paragraphs[0]
    ph1.text = cfg_data['agency_main'].upper()
    ph1.font.name = 'Times New Roman'
    ph1.font.size = Pt(11.5)
    ph1.font.bold = True
    ph1.font.color.rgb = RGBColor(30, 41, 59)
    ph1.alignment = PP_ALIGN.CENTER

    ph2 = tf_h.add_paragraph()
    ph2.text = cfg_data['agency_sup'].upper()
    ph2.font.name = 'Times New Roman'
    ph2.font.size = Pt(17.5)
    ph2.font.bold = True
    ph2.font.color.rgb = primary_rgb
    ph2.alignment = PP_ALIGN.CENTER

    ph3 = tf_h.add_paragraph()
    ph3.text = cfg_data['agency_sub'].upper()
    ph3.font.name = 'Arial'
    ph3.font.size = Pt(9.5)
    ph3.font.bold = True
    ph3.font.color.rgb = RGBColor(71, 85, 105)
    ph3.alignment = PP_ALIGN.CENTER

    ph4 = tf_h.add_paragraph()
    ph4.text = '✦  —  •  —  ✦'
    ph4.font.size = Pt(8.5)
    ph4.font.color.rgb = accent_rgb
    ph4.alignment = PP_ALIGN.CENTER

    # 7. Certificate Title & Registration Number Area
    tb_title = slide1.shapes.add_textbox(Inches(1.2), Inches(1.68), Inches(9.293), Inches(1.15))
    tf_t = tb_title.text_frame
    tf_t.word_wrap = True

    pt1 = tf_t.paragraphs[0]
    pt1.text = cfg_data['certificate_title'].upper()
    pt1.font.name = 'Georgia'
    pt1.font.size = Pt(28)
    pt1.font.bold = True
    pt1.font.color.rgb = primary_rgb
    pt1.alignment = PP_ALIGN.CENTER

    pt2 = tf_t.add_paragraph()
    pt2.text = cfg_data['certificate_subtitle'].upper()
    pt2.font.name = 'Arial'
    pt2.font.size = Pt(10)
    pt2.font.bold = True
    pt2.font.color.rgb = accent_rgb
    pt2.alignment = PP_ALIGN.CENTER

    pt3 = tf_t.add_paragraph()
    pt3.text = 'NOMOR: {{NOMOR_SERTIFIKAT}}'
    pt3.font.name = 'Courier New'
    pt3.font.size = Pt(10)
    pt3.font.bold = True
    pt3.font.color.rgb = RGBColor(30, 41, 59)
    pt3.alignment = PP_ALIGN.CENTER

    # 8. Recipient Section (Nama, NIP Badge, Jabatan)
    tb_rec = slide1.shapes.add_textbox(Inches(1.2), Inches(2.95), Inches(9.293), Inches(1.35))
    tf_r = tb_rec.text_frame
    tf_r.word_wrap = True

    pr1 = tf_r.paragraphs[0]
    pr1.text = 'Diberikan dengan penuh kehormatan kepada:'
    pr1.font.name = 'Georgia'
    pr1.font.size = Pt(11.5)
    pr1.font.italic = True
    pr1.font.color.rgb = RGBColor(100, 116, 139)
    pr1.alignment = PP_ALIGN.CENTER

    pr2 = tf_r.add_paragraph()
    pr2.text = '{{NAMA_SISWA}}'
    pr2.font.name = 'Georgia'
    pr2.font.size = Pt(28)
    pr2.font.bold = True
    pr2.font.color.rgb = RGBColor(4, 47, 46)
    pr2.alignment = PP_ALIGN.CENTER

    pr3 = tf_r.add_paragraph()
    pr3.text = '{{NIP_PEGAWAI}}'
    pr3.font.name = 'Courier New'
    pr3.font.size = Pt(11)
    pr3.font.bold = True
    pr3.font.color.rgb = primary_rgb
    pr3.alignment = PP_ALIGN.CENTER

    pr4 = tf_r.add_paragraph()
    pr4.text = '{{JABATAN_PEGAWAI}} • {{UNIT_KERJA}}'
    pr4.font.name = 'Arial'
    pr4.font.size = Pt(10)
    pr4.font.bold = True
    pr4.font.color.rgb = RGBColor(51, 65, 85)
    pr4.alignment = PP_ALIGN.CENTER

    # 9. Achievement & Course Statement
    tb_body = slide1.shapes.add_textbox(Inches(1.0), Inches(4.35), Inches(9.693), Inches(1.4))
    tf_b = tb_body.text_frame
    tf_b.word_wrap = True

    pb1 = tf_b.paragraphs[0]
    pb1.text = cfg_data['statement_text']
    pb1.font.name = 'Arial'
    pb1.font.size = Pt(10)
    pb1.font.color.rgb = RGBColor(51, 65, 85)
    pb1.alignment = PP_ALIGN.CENTER

    pb2 = tf_b.add_paragraph()
    pb2.text = '“{{JUDUL_KURSUS}}”'
    pb2.font.name = 'Georgia'
    pb2.font.size = Pt(18)
    pb2.font.bold = True
    pb2.font.color.rgb = primary_rgb
    pb2.alignment = PP_ALIGN.CENTER

    pb3 = tf_b.add_paragraph()
    pb3.text = '[ Beban Belajar: {{TOTAL_JP}} Jam Pelatihan (JP)  |  Kategori: {{KATEGORI_KURSUS}}  |  Predikat: Lulus Memuaskan ]'
    pb3.font.name = 'Arial'
    pb3.font.size = Pt(9)
    pb3.font.bold = True
    pb3.font.color.rgb = RGBColor(15, 118, 110)
    pb3.alignment = PP_ALIGN.CENTER

    # 10. Footer Section (Left: QR Verification, Center: Gold Seal, Right: Signature + Stamp)
    footer_y = Inches(5.95)

    # --- LEFT: QR Box with Modular Separated Elements ---
    qr_frame = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.65), footer_y + Inches(0.15), Inches(1.05), Inches(1.05))
    qr_frame.fill.solid()
    qr_frame.fill.fore_color.rgb = RGBColor(255, 255, 255)
    qr_frame.line.color.rgb = RGBColor(255, 255, 255)
    qr_frame.line.width = Pt(3)

    tb_qr_hint = slide1.shapes.add_textbox(Inches(0.65), footer_y + Inches(0.35), Inches(1.05), Inches(0.7))
    tf_qrh = tb_qr_hint.text_frame
    tf_qrh.word_wrap = True
    pqrh = tf_qrh.paragraphs[0]
    pqrh.text = '[ KODE QR ]\n{{KODE_QR}}'
    pqrh.font.size = Pt(7)
    pqrh.font.bold = True
    pqrh.font.color.rgb = RGBColor(100, 116, 139)
    pqrh.alignment = PP_ALIGN.CENTER

    tb_qr_info = slide1.shapes.add_textbox(Inches(1.80), footer_y + Inches(0.05), Inches(2.35), Inches(1.3))
    tf_qri = tb_qr_info.text_frame
    tf_qri.word_wrap = True

    pq1 = tf_qri.paragraphs[0]
    pq1.text = 'KEABSAHAN DIGITAL'
    pq1.font.name = 'Arial'
    pq1.font.size = Pt(9.5)
    pq1.font.bold = True
    pq1.font.color.rgb = primary_rgb

    pq2 = tf_qri.add_paragraph()
    pq2.text = 'Pindai kode QR untuk memverifikasi keaslian dokumen resmi di Portal LMS Setjen DPD RI.'
    pq2.font.name = 'Arial'
    pq2.font.size = Pt(8)
    pq2.font.color.rgb = RGBColor(71, 85, 105)

    pq3 = tf_qri.add_paragraph()
    pq3.text = 'ID: {{NOMOR_SERTIFIKAT}}'
    pq3.font.name = 'Courier New'
    pq3.font.size = Pt(8.5)
    pq3.font.bold = True
    pq3.font.color.rgb = RGBColor(15, 23, 42)

    # --- CENTER: Gold Medallion Rosette Seal ---
    tb_seal = slide1.shapes.add_textbox(Inches(4.45), footer_y + Inches(0.15), Inches(2.793), Inches(1.2))
    tf_s = tb_seal.text_frame
    tf_s.word_wrap = True
    ps1 = tf_s.paragraphs[0]
    ps1.text = '★ MEDALI SEGEL RESMI ★'
    ps1.font.name = 'Times New Roman'
    ps1.font.size = Pt(11)
    ps1.font.bold = True
    ps1.font.color.rgb = accent_rgb
    ps1.alignment = PP_ALIGN.CENTER

    ps2 = tf_s.add_paragraph()
    ps2.text = 'Dokumen Elektronik Sah\nSekretariat Jenderal DPD RI'
    ps2.font.name = 'Arial'
    ps2.font.size = Pt(8.5)
    ps2.font.color.rgb = RGBColor(71, 85, 105)
    ps2.alignment = PP_ALIGN.CENTER

    # --- RIGHT: Signature Area (Title, Stamp, Signature, Line, Name, NIP) ---
    tb_sig = slide1.shapes.add_textbox(Inches(8.0), footer_y, Inches(3.1), Inches(0.65))
    tf_sg = tb_sig.text_frame
    tf_sg.word_wrap = True
    psg1 = tf_sg.paragraphs[0]
    psg1.text = 'Jakarta, {{TANGGAL_LULUS}}'
    psg1.font.name = 'Arial'
    psg1.font.size = Pt(9.5)
    psg1.font.color.rgb = RGBColor(71, 85, 105)
    psg1.alignment = PP_ALIGN.CENTER

    psg2 = tf_sg.add_paragraph()
    psg2.text = cfg_data['signatory_title']
    psg2.font.name = 'Arial'
    psg2.font.size = Pt(9)
    psg2.font.color.rgb = RGBColor(51, 65, 85)
    psg2.alignment = PP_ALIGN.CENTER

    # Stamp image on left
    if path_stamp.exists():
        slide1.shapes.add_picture(str(path_stamp), Inches(8.25), footer_y + Inches(0.52), Inches(0.95), Inches(0.95))

    # Signature image overlapping on right
    if path_ttd.exists():
        slide1.shapes.add_picture(str(path_ttd), Inches(8.75), footer_y + Inches(0.55), Inches(1.95), Inches(0.85))

    # Signature baseline & Name/NIP text
    sig_line = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(8.25), footer_y + Inches(1.42), Inches(2.6), Inches(0.015))
    sig_line.fill.solid()
    sig_line.fill.fore_color.rgb = RGBColor(51, 65, 85)
    sig_line.line.color.rgb = RGBColor(51, 65, 85)

    tb_signer = slide1.shapes.add_textbox(Inches(8.0), footer_y + Inches(1.45), Inches(3.1), Inches(0.6))
    tf_sn = tb_signer.text_frame
    tf_sn.word_wrap = True

    psn1 = tf_sn.paragraphs[0]
    psn1.text = cfg_data['signatory_name']
    psn1.font.name = 'Georgia'
    psn1.font.size = Pt(11)
    psn1.font.bold = True
    psn1.font.color.rgb = RGBColor(15, 23, 42)
    psn1.alignment = PP_ALIGN.CENTER

    psn2 = tf_sn.add_paragraph()
    psn2.text = f"NIP. {cfg_data['signatory_nip']}"
    psn2.font.name = 'Arial'
    psn2.font.size = Pt(9)
    psn2.font.color.rgb = RGBColor(71, 85, 105)
    psn2.alignment = PP_ALIGN.CENTER

    # =========================================================================
    # SLIDE 2: USER GUIDE & VARIABLE CHEATSHEET
    # =========================================================================
    slide2 = prs.slides.add_slide(blank_layout)
    tb_guide = slide2.shapes.add_textbox(Inches(0.6), Inches(0.5), Inches(10.493), Inches(7.2))
    tf_g = tb_guide.text_frame
    tf_g.word_wrap = True

    pg1 = tf_g.paragraphs[0]
    pg1.text = 'PANDUAN & PETUNJUK PENGGUNAAN TEMPLATE MASTER PPTX LMSETJEN DPD RI'
    pg1.font.name = 'Arial'
    pg1.font.size = Pt(16)
    pg1.font.bold = True
    pg1.font.color.rgb = primary_rgb

    guide_text = (
        "\n1. TENTANG TEMPLATE SLIDE 1:\n"
        "   • Slide 1 adalah master blueprint resmi dari 'modern-certificate-container' yang digunakan secara default "
        "oleh sistem LMSetjen DPD RI untuk seluruh penerbitan sertifikat kursus.\n"
        "   • Seluruh elemen telah disetel dalam rasio ISO 216 A4 Landscape (29.7 x 21.0 cm / 11.693 x 8.268 inches), "
        "dilengkapi logo bulat ganda (Setjen DPD RI & LMSetjen DPD RI), QR code keabsahan digital, segel medali emas, "
        "stempel basah transparan, dan tanda tangan resmi pejabat penandatangan.\n\n"
        "2. CARA KUSTOMISASI DESAIN MELALUI POWERPOINT:\n"
        "   • Anda dapat bebas mengganti gambar latar (background), warna garis bingkai, jenis huruf (font), ukuran font, "
        "serta memindahkan posisi kotak teks sesuai kebutuhan diklat atau acara khusus.\n"
        "   • Pertahankan variabel di dalam kurung kurawal ganda (contoh: {{NAMA_SISWA}}) agar sistem dapat menginjeksi data otomatis.\n\n"
        "3. DAFTAR VARIABEL DINAMIS SISTEM:\n"
        "   • {{NAMA_SISWA}}           : Nama lengkap peserta pelatihan / ASN penerima sertifikat.\n"
        "   • {{NIP_PEGAWAI}}          : Nomor Induk Pegawai peserta (Format otomatis: NIP. 19850315...).\n"
        "   • {{JABATAN_PEGAWAI}}      : Jabatan kedinasan peserta pelatihan.\n"
        "   • {{UNIT_KERJA}}           : Satuan kerja / Biro / Pusat penempatan peserta.\n"
        "   • {{JUDUL_KURSUS}}         : Judul atau nama program pelatihan.\n"
        "   • {{NOMOR_SERTIFIKAT}}     : Nomor resmi registrasi sertifikat (contoh: KP.04/LMS/211358/DPDRI/XI/2026).\n"
        "   • {{TANGGAL_LULUS}}        : Tanggal kelulusan dalam bahasa Indonesia (contoh: 06 November 2026).\n"
        "   • {{TOTAL_JP}}             : Total jam pelajaran (contoh: 16 Jam Pelatihan (JP)).\n"
        "   • {{KATEGORI_KURSUS}}      : Kategori materi kursus (contoh: Teknis, Manajerial, Kepemimpinan).\n"
        "   • {{NAMA_INSTRUKTUR}}      : Nama instruktur atau fasilitator pengampu pelatihan.\n"
        "   • {{JABATAN_PENANDATANGAN}}: Jabatan resmi pengampu / verifikator kelulusan.\n"
        "   • {{NIP_PENANDATANGAN}}    : Nomor Induk Pegawai pejabat penandatangan.\n"
        "   • {{KODE_QR}}              : Posisi kode QR verifikasi keabsahan digital LMS Setjen DPD RI.\n\n"
        "4. CARA MENERAPKAN KE SISTEM:\n"
        "   • Opsi A (Upload Background): Simpan Slide 1 sebagai gambar ('Save As' -> PNG/JPG resolusi 1414 x 1000 px), "
        "lalu unggah di area 'Unggah Gambar Background Kustom' pada halaman Admin Manajemen Konten > Desain Sertifikat.\n"
        "   • Opsi B (Upload PPTX Master): Simpan file PPTX ini, lalu unggah berkas .pptx ke halaman Admin Manajemen Konten > Desain Sertifikat."
    )
    pg2 = tf_g.add_paragraph()
    pg2.text = guide_text
    pg2.font.name = 'Arial'
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



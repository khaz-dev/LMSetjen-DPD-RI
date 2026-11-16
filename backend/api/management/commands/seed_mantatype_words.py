from django.core.management.base import BaseCommand
from api.models import MantaTypeSetting, MantaTypeWord

INITIAL_WORDS = [
    # Wave 1: Easy
    ('DPD', 'easy', 'keparlemenan', 'Dewan Perwakilan Daerah Republik Indonesia'),
    ('BAP', 'easy', 'keparlemenan', 'Badan Akuntabilitas Publik DPD RI'),
    ('PURT', 'easy', 'keparlemenan', 'Panitia Urusan Rumah Tangga DPD RI'),
    ('RUU', 'easy', 'keparlemenan', 'Rancangan Undang-Undang'),
    ('ASN', 'easy', 'berakhlak', 'Aparatur Sipil Negara'),
    ('DEWAN', 'easy', 'keparlemenan', 'Majelis/lembaga perwakilan rakyat'),
    ('KUIS', 'easy', 'lms', 'Evaluasi pemahaman materi pembelajaran'),
    ('MODUL', 'easy', 'lms', 'Unit materi belajar mandiri pada LMS'),
    ('MANTA', 'easy', 'lms', 'Asisten Cerdas & Maskot Pembelajaran DPD RI'),
    ('ASIH', 'easy', 'umum', 'Kasih sayang dan kepedulian antarsesama'),
    ('HAK', 'easy', 'umum', 'Kewenangan atau milik yang sah menurut hukum'),
    ('ERA', 'easy', 'umum', 'Kurun waktu atau babak baru dalam sejarah'),
    ('IBA', 'easy', 'umum', 'Rasa belas kasihan terhadap sesama'),
    ('KAF', 'easy', 'umum', 'Huruf abjad ke-22 dalam abjad Arab'),
    ('SAH', 'easy', 'umum', 'Sesuai dengan ketentuan atau hukum yang berlaku'),
    ('AKAL', 'easy', 'umum', 'Daya pikir untuk memahami dan menimbang kebenaran'),
    ('AKSI', 'easy', 'umum', 'Tindakan nyata untuk mencapai sasaran'),
    ('ASAS', 'easy', 'umum', 'Prinsip dasar atau pedoman kebenaran hukum'),
    ('BAKU', 'easy', 'umum', 'Standar pokok atau tolok ukur resmi'),
    ('DATA', 'easy', 'lms', 'Kumpulan fakta dan angka dasar informasi'),
    ('ETOS', 'easy', 'berakhlak', 'Semangat kerja keras dan dedikasi profesional'),
    ('KAJI', 'easy', 'keparlemenan', 'Penelitian dan telaah mendalam atas kebijakan'),
    ('VISI', 'easy', 'keparlemenan', 'Pandangan dan cita-cita strategis masa depan'),
    ('SANI', 'easy', 'umum', 'Suci, luhur, atau terpuji'),
    ('POLA', 'easy', 'umum', 'Bentuk atau model kerja yang teratur'),
    ('IDP', 'easy', 'lms', 'Individual Development Plan (Rencana Pengembangan Diri)'),
    ('NUSA', 'easy', 'keparlemenan', 'Tanah air dan kepulauan nusantara Indonesia'),
    ('SDM', 'easy', 'berakhlak', 'Sumber Daya Manusia aparatur negara'),
    ('OKK', 'easy', 'umum', 'Organisasi, Keanggotaan, dan Kaderisasi'),

    # Wave 2-3: Medium
    ('SENATOR', 'medium', 'keparlemenan', 'Anggota Dewan Perwakilan Daerah (DPD) RI'),
    ('SIDANG', 'medium', 'keparlemenan', 'Pertemuan resmi untuk membahas agenda penting'),
    ('KOMITE', 'medium', 'keparlemenan', 'Alat Kelengkapan DPD RI bidang legislasi/pengawasan'),
    ('PLENO', 'medium', 'keparlemenan', 'Sidang paripurna yang dihadiri seluruh anggota'),
    ('DAERAH', 'medium', 'keparlemenan', 'Wilayah perwakilan konstituen anggota DPD RI'),
    ('BELAJAR', 'medium', 'lms', 'Proses menimba ilmu dan peningkatan kompetensi'),
    ('KURSUS', 'medium', 'lms', 'Program pelatihan tematik di platform LMS'),
    ('MATERI', 'medium', 'lms', 'Bahan ajar dan referensi kurikulum'),
    ('LENCANA', 'medium', 'lms', 'Penghargaan atas pencapaian belajar (Badge)'),
    ('INOVASI', 'medium', 'berakhlak', 'Terobosan baru untuk perbaikan berkelanjutan (Adaptif)'),
    ('DIGITAL', 'medium', 'lms', 'Transformasi teknologi dan sistem informasi modern'),
    ('PORTAL', 'medium', 'lms', 'Pintu gerbang akses layanan aplikasi terpadu'),
    ('SCORM', 'medium', 'lms', 'Standar internasional konten pembelajaran interaktif'),
    ('VIDEO', 'medium', 'lms', 'Media visual pendukung pembelajaran multimedia'),
    ('HARMONIS', 'medium', 'berakhlak', 'Saling peduli dan menghargai perbedaan (BerAKHLAK)'),
    ('LOYAL', 'medium', 'berakhlak', 'Berdedikasi dan mengutamakan kepentingan bangsa'),
    ('ADAPTIF', 'medium', 'berakhlak', 'Terus berinovasi dan antusias menghadapi perubahan'),
    ('AMANAH', 'medium', 'berakhlak', 'Memegang teguh kepercayaan yang diberikan'),
    ('SINERGI', 'medium', 'berakhlak', 'Membangun kerja sama strategis yang produktif'),
    ('DISIPLIN', 'medium', 'berakhlak', 'Kepatuhan terhadap aturan dan integritas waktu'),
    ('KINERJA', 'medium', 'berakhlak', 'Hasil capaian kerja terukur aparatur negara'),
    ('MAGER', 'medium', 'umum', 'Malas gerak - harus dilawan dengan belajar giat!'),
    ('GABUT', 'medium', 'umum', 'Gaji buta - ASN Setjen DPD RI selalu produktif'),
    ('SOLID', 'medium', 'umum', 'Kekompakan tim kerja Sekretariat Jenderal'),
    ('LOGIS', 'medium', 'umum', 'Sesuai dengan logika dan kaidah penalaran'),
    ('NALAR', 'medium', 'umum', 'Pertimbangan akal sehat dalam mengambil keputusan'),
    ('OPINI', 'medium', 'umum', 'Pendapat atau pandangan atas suatu isu'),
    ('SAHIH', 'medium', 'umum', 'Benar, sah, dan dapat dipertanggungjawabkan'),
    ('JUARA', 'medium', 'umum', 'Pemenang atau yang terbaik dalam pencapaian'),
    ('DIKSI', 'medium', 'umum', 'Pilihan kata yang tepat dalam komunikasi dinas'),
    ('FASID', 'medium', 'umum', 'Batal atau tidak sah secara hukum'),
    ('ANOMALI', 'medium', 'umum', 'Penyimpangan dari keadaan biasa atau standar'),
    ('EMPIRIS', 'medium', 'umum', 'Berdasarkan fakta dan pengalaman nyata lapangan'),

    # Wave 4+: Hard
    ('BERAKHLAK', 'hard', 'berakhlak', 'Core Values ASN: Berorientasi Pelayanan, Akuntabel, Kompeten, Harmonis, Loyal, Adaptif, Kolaboratif'),
    ('INTEGRITAS', 'hard', 'berakhlak', 'Konsistensi antara ucapan, tindakan, dan nilai moral'),
    ('AKUNTABEL', 'hard', 'berakhlak', 'Bertanggung jawab atas kepercayaan yang diberikan'),
    ('KOMPETEN', 'hard', 'berakhlak', 'Terus belajar dan mengembangkan kapabilitas diri'),
    ('KOLABORATIF', 'hard', 'berakhlak', 'Membangun kerja sama yang sinergis antarsatker'),
    ('LEGISLASI', 'hard', 'keparlemenan', 'Fungsi pembentukan dan perancangan perundang-undangan'),
    ('ASPIRASI', 'hard', 'keparlemenan', 'Harapan dan suara masyarakat daerah yang diperjuangkan'),
    ('PARLEMEN', 'hard', 'keparlemenan', 'Lembaga perwakilan rakyat tempat musyawarah kenegaraan'),
    ('SEKRETARIAT', 'hard', 'keparlemenan', 'Satuan pendukung administrasi dan keahlian parlemen'),
    ('PROTOKOL', 'hard', 'keparlemenan', 'Tata aturan keprotokolan resmi kenegaraan'),
    ('REGULASI', 'hard', 'keparlemenan', 'Aturan hukum formal yang mengikat tata kelola'),
    ('KEBIJAKAN', 'hard', 'keparlemenan', 'Arah dan ketetapan strategis untuk publik'),
    ('DEMOKRASI', 'hard', 'keparlemenan', 'Kedaulatan rakyat berlandaskan Pancasila & UUD 1945'),
    ('KONSTITUSI', 'hard', 'keparlemenan', 'Hukum dasar tertinggi negara Republik Indonesia'),
    ('PROFESIONAL', 'hard', 'berakhlak', 'Bekerja sesuai keahlian, standar, dan kode etik'),
    ('REFORMASI', 'hard', 'berakhlak', 'Pembaruan tata kelola menuju birokrasi berkelas dunia'),
    ('BIROKRASI', 'hard', 'berakhlak', 'Sistem administrasi pemerintahan yang melayani masyarakat'),
    ('PELAYANAN', 'hard', 'berakhlak', 'Komitmen memberikan pelayanan prima demi kepuasan publik'),
    ('SERTIFIKAT', 'hard', 'lms', 'Bukti kelulusan dan kompetensi resmi pelatihan LMS'),
    ('KOMPETENSI', 'hard', 'lms', 'Kombinasi pengetahuan, keterampilan, dan sikap kerja'),
    ('KNOWLEDGE', 'hard', 'lms', 'Manajemen pengetahuan kelembagaan Setjen DPD RI'),
    ('PRESTASI', 'hard', 'umum', 'Capaian kinerja unggul yang membanggakan institusi'),
    ('KONTRIBUTIF', 'hard', 'berakhlak', 'Memberikan sumbangsih nyata bagi kemajuan bangsa'),
    ('LEGISLATIF', 'hard', 'keparlemenan', 'Kewenangan membuat undang-undang bersama DPR'),
    ('AKUNTABILITAS', 'hard', 'berakhlak', 'Kewajiban mempertanggungjawabkan pengelolaan sumber daya'),
    ('SIMANTAP', 'hard', 'lms', 'Sistem Terintegrasi Manta Pintar Setjen DPD RI'),
    ('PERWAKILAN', 'hard', 'keparlemenan', 'Mandat mewakili kepentingan masyarakat dan daerah'),
    ('MENYALAABANGKU', 'hard', 'umum', 'Semangat membara dan penuh antusiasme positif'),
]

class Command(BaseCommand):
    help = "Seed initial MantaType settings and word bank"

    def handle(self, *args, **options):
        # 1. Setup Setting
        setting = MantaTypeSetting.get_settings()
        self.stdout.write(self.style.SUCCESS(f"Setting loaded/created: {setting}"))

        # 2. Seed Words
        created_count = 0
        updated_count = 0
        for word_str, difficulty, category, meaning in INITIAL_WORDS:
            clean_word = word_str.strip().replace(' ', '').upper()
            obj, created = MantaTypeWord.objects.update_or_create(
                word=clean_word,
                defaults={
                    'difficulty': difficulty,
                    'category': category,
                    'meaning': meaning,
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded MantaType Words! Added: {created_count}, Updated/Existing: {updated_count}, Total in DB: {MantaTypeWord.objects.count()}"
            )
        )


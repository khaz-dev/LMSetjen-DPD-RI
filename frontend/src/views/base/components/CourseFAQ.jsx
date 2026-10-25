import React, { useState } from "react";

const CourseFAQ = () => {
    const [activeIndex, setActiveIndex] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    const toggleFAQ = (index) => {
        setActiveIndex(activeIndex === index ? null : index);
    };

    const faqs = [
        {
            question: "Apa prasyarat untuk mengikuti kursus ini?",
            answer: "Kursus ini dirancang untuk seluruh aparatur sipil dan pegawai di lingkungan Setjen DPD RI. Tidak memerlukan keahlian teknis khusus; cukup perangkat komputer atau ponsel pintar dengan koneksi internet yang stabil."
        },
        {
            question: "Berapa lama akses modul pembelajaran diberikan?",
            answer: "Anda mendapatkan akses tanpa batas waktu (seumur hidup) setelah terdaftar. Anda dapat meninjau kembali modul dan materi kapan saja untuk keperluan penguatan kompetensi tugas kedinasan."
        },
        {
            question: "Apakah tersedia sertifikat resmi kelulusan?",
            answer: "Ya, sertifikat resmi kelulusan berlisensi Bagian Pengembangan Sumber Daya Manusia akan terbit secara otomatis dalam format digital (PDF) begitu seluruh materi dan evaluasi terselesaikan dengan nilai ambang batas kelulusan."
        },
        {
            question: "Bagaimana cara kerja modul interaktif SCORM?",
            answer: "Modul SCORM memungkinkan materi pembelajaran disajikan secara dinamis dengan interaktivitas penuh, bookmarking posisi belajar otomatis, serta kuis langsung di dalam paket modul."
        },
        {
            question: "Bisakah materi dipelajari melalui ponsel / smartphone?",
            answer: "Tentu saja. Platform LMS Setjen DPD RI sepenuhnya responsif dan kompatibel dengan browser seluler (Android dan iOS), sehingga Anda dapat belajar secara fleksibel."
        },
        {
            question: "Berapa jam estimasi waktu belajar per minggu?",
            answer: "Pembelajaran bersifat mandiri (self-paced). Disarankan meluangkan waktu 2-3 jam per minggu agar pemahaman materi dapat terserap secara optimal."
        },
        {
            question: "Bagaimana jika mengalami kendala teknis saat belajar?",
            answer: "Anda dapat memanfaatkan fitur forum diskusi kursus atau menghubungi tim bantuan teknis Bagian Pengembangan Sumber Daya Manusia melalui menu Bantuan pada portal LMS."
        },
        {
            question: "Apakah ada ujian akhir atau kuis evaluasi?",
            answer: "Setiap modul dapat memuat kuis pengujian pemahaman atau evaluasi akhir yang wajib diselesaikan sebagai salah satu syarat penerbitan sertifikat."
        },
        {
            question: "Apakah materi dapat diulang kembali setelah selesai?",
            answer: "Ya, seluruh materi yang telah Anda selesaikan tetap dapat diakses dan diulang kembali sewaktu-waktu tanpa batasan kuota akses."
        }
    ];

    const filteredFaqs = faqs.filter(faq =>
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="card border-0 shadow-xs rounded-3 bg-white mb-3 overflow-hidden">
            <div className="card-body p-3 p-md-4">
                {/* Header */}
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 pb-2 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                        <div
                            className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                            style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" }}
                        >
                            <i className="fas fa-circle-question" style={{ fontSize: "0.8rem" }}></i>
                        </div>
                        <div>
                            <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "0.98rem" }}>
                                Pertanyaan Umum (FAQ)
                            </h5>
                        </div>
                    </div>

                    {/* Quick Search Box */}
                    <div className="position-relative" style={{ maxWidth: "260px", width: "100%" }}>
                        <i
                            className="fas fa-search position-absolute top-50 translate-middle-y text-muted"
                            style={{ left: "12px", fontSize: "0.78rem", pointerEvents: "none" }}
                        ></i>
                        <input
                            type="text"
                            className="form-control form-control-sm pe-3 py-1 rounded-pill bg-light border-0"
                            placeholder="Cari FAQ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ fontSize: "0.8rem", paddingLeft: "34px" }}
                        />
                    </div>
                </div>

                {/* 2-Column Responsive FAQ List */}
                <div className="row g-3">
                    {filteredFaqs.map((faq, index) => {
                        const isOpen = activeIndex === index;
                        return (
                            <div key={index} className="col-md-6">
                                <div
                                    className={`rounded-3 border transition-all h-100 ${isOpen ? 'bg-light border-teal-subtle shadow-xs' : 'bg-white'
                                        }`}
                                    style={{ borderColor: isOpen ? '#0d9488' : '#e2e8f0' }}
                                >
                                    <button
                                        type="button"
                                        className="btn btn-sm w-100 text-start p-3 px-3 d-flex align-items-center justify-content-between gap-2 border-0"
                                        onClick={() => toggleFAQ(index)}
                                    >
                                        <div className="d-flex align-items-center gap-2 min-w-0">
                                            <i
                                                className={`fas fa-circle-question flex-shrink-0 ${isOpen ? 'text-teal' : 'text-muted'}`}
                                                style={{ fontSize: "0.85rem", color: isOpen ? '#0d9488' : '#94a3b8' }}
                                            ></i>
                                            <span className="fw-semibold text-dark" style={{ fontSize: "0.86rem", lineHeight: "1.45" }}>
                                                {faq.question}
                                            </span>
                                        </div>
                                        <i
                                            className={`fas fa-chevron-down flex-shrink-0 text-muted transition-all ${isOpen ? 'rotate-180 text-teal' : ''}`}
                                            style={{
                                                fontSize: "0.75rem",
                                                transform: isOpen ? 'rotate(180deg)' : 'none',
                                                transition: 'transform 0.2s ease',
                                                color: isOpen ? '#0d9488' : '#94a3b8'
                                            }}
                                        ></i>
                                    </button>

                                    {isOpen && (
                                        <div className="px-3 pb-3 pt-1">
                                            <div
                                                className="p-3 rounded-2 bg-white border-top text-secondary"
                                                style={{ fontSize: "0.83rem", lineHeight: "1.65" }}
                                            >
                                                {faq.answer}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredFaqs.length === 0 && (
                    <div className="text-center py-4 text-muted small">
                        <i className="fas fa-search mb-2 text-muted" style={{ fontSize: "1.3rem" }}></i>
                        <p className="mb-0">Tidak ada pertanyaan yang sesuai dengan kata kunci "{searchQuery}".</p>
                    </div>
                )}

                {/* Help Callout Banner */}
                <div
                    className="mt-3 p-3 px-3 rounded-3 d-flex align-items-center justify-content-between gap-2 flex-wrap"
                    style={{ background: "#f0fdfa", border: "1px solid #ccfbf1" }}
                >
                    <div className="d-flex align-items-center gap-2">
                        <i className="fas fa-headset text-teal" style={{ color: "#0d9488", fontSize: "1rem" }}></i>
                        <span className="text-dark small" style={{ fontSize: "0.82rem" }}>
                            Masih memiliki pertanyaan seputar modul pembelajaran ini?
                        </span>
                    </div>
                    <span className="badge bg-teal text-white fw-medium py-1 px-3 rounded-pill small" style={{ background: "#0d9488", fontSize: "0.75rem" }}>
                        Bagian Pengembangan Sumber Daya Manusia
                    </span>
                </div>
            </div>
        </div>
    );
};

export default CourseFAQ;


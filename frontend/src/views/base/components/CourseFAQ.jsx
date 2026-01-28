import React, { useState } from "react";
import { useComingSoon } from "../../../components/ComingSoonModal";

const CourseFAQ = () => {
    const [activeIndex, setActiveIndex] = useState(null);
    const handleComingSoon = useComingSoon("Bonus Materials");

    const toggleFAQ = (index) => {
        setActiveIndex(activeIndex === index ? null : index);
    };

    const faqs = [
        {
            question: "Apa prasyarat untuk kursus ini?",
            answer: "Kursus ini dirancang untuk pemula dan tidak memerlukan pengalaman pemrograman sebelumnya. Literasi komputer dasar dan keakraban dengan peramban web akan membantu tetapi tidak diperlukan. Kami akan memandu Anda melalui segalanya langkah demi langkah."
        },
        {
            question: "Berapa lama saya memiliki akses ke kursus?",
            answer: "Anda mendapatkan akses seumur hidup ke kursus ini! Setelah terdaftar, Anda dapat mengakses semua materi kursus, termasuk pembaruan di masa depan, kapan saja dan di mana saja. Tidak ada batasan waktu atau tenggat waktu."
        },
        {
            question: "Bisakah saya mengunduh video kursus?",
            answer: "Ya, semua video kursus dapat diunduh sehingga Anda dapat belajar secara offline. Anda juga akan mendapatkan akses ke sumber daya yang dapat diunduh termasuk kode sumber, file proyek, dan materi bacaan tambahan."
        },
        {
            question: "Apakah ada sertifikat penyelesaian?",
            answer: "Tentu saja! Setelah berhasil menyelesaikan kursus, Anda akan menerima sertifikat penyelesaian yang dapat Anda tambahkan ke profil LinkedIn, resume, atau portofolio Anda untuk menampilkan keterampilan baru Anda."
        },
        {
            question: "Bagaimana jika saya tidak puas dengan kursusnya?",
            answer: "Kami menawarkan jaminan uang kembali 30 hari. Jika Anda tidak sepenuhnya puas dengan kursus dalam 30 hari pertama, Anda dapat meminta pengembalian dana penuh tanpa pertanyaan."
        },
        {
            question: "Berapa banyak waktu yang harus saya dedikasikan untuk kursus ini?",
            answer: "Kursus dapat disesuaikan dengan kecepatan Anda sendiri, tetapi kami merekomendasikan untuk mendedikasikan 3-5 jam per minggu. Sebagian besar siswa menyelesaikan kursus dalam 4-6 minggu. Anda dapat belajar lebih cepat atau lebih lambat berdasarkan jadwal dan kecepatan belajar Anda."
        },
        {
            question: "Apakah saya memerlukan perangkat lunak atau alat khusus?",
            answer: "Yang Anda butuhkan adalah komputer dengan koneksi internet dan peramban web. Kami akan memandu Anda melalui penginstalan alat dan perangkat lunak gratis apa pun selama kursus. Tidak ada lisensi perangkat lunak mahal yang diperlukan."
        },
        {
            question: "Apakah dukungan instruktur tersedia?",
            answer: "Ya! Anda akan memiliki akses ke dukungan instruktur melalui forum diskusi kursus. Kami biasanya merespons pertanyaan dalam waktu 24 jam. Anda juga akan memiliki akses ke komunitas sesama siswa."
        },
        {
            question: "Bisakah saya mengakses kursus ini di perangkat seluler?",
            answer: "Tentu saja! Kursus ini sepenuhnya responsif untuk perangkat seluler. Anda dapat menonton video, membaca materi, dan berpartisipasi dalam diskusi dari smartphone, tablet, atau perangkat apa pun dengan akses internet."
        }
    ];

    return (
        <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
                <div className="text-center mb-5">
                    <h3 className="h4 fw-bold text-primary mb-3">
                        <i className="fas fa-question-circle me-3"></i>
                        Pertanyaan yang Sering Diajukan
                    </h3>
                    <p className="text-muted">
                        Dapatkan jawaban atas pertanyaan paling umum tentang kursus ini
                    </p>
                </div>

                <div className="row">
                    <div className="col-lg-8 mx-auto">
                        <div className="accordion" id="courseAccordion">
                            {faqs.map((faq, index) => (
                                <div key={index} className="accordion-item border border-light rounded-3 mb-3 shadow-sm">
                                    <h2 className="accordion-header">
                                        <button
                                            className={`accordion-button ${activeIndex !== index ? "collapsed" : ""} bg-light fw-semibold`}
                                            type="button"
                                            onClick={() => toggleFAQ(index)}
                                            style={{ borderRadius: "0.375rem" }}
                                        >
                                            <span className="me-3 text-primary">
                                                <i className={`fas fa-${activeIndex === index ? "minus" : "plus"}-circle`}></i>
                                            </span>
                                            {faq.question}
                                        </button>
                                    </h2>
                                    <div className={`accordion-collapse collapse ${activeIndex === index ? "show" : ""}`}>
                                        <div className="accordion-body p-4 pt-0">
                                            <div className="text-muted" style={{ lineHeight: "1.7" }}>
                                                {faq.answer}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseFAQ;

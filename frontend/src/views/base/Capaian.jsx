import React, { memo } from "react";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import "./Capaian.css";

function Capaian() {
  const achievements = [
    {
      year: "2021",
      title: "Peluncuran Platform LMSetjen DPD RI",
      description: "Platform e-learning LMSetjen DPD RI resmi diluncurkan untuk mendukung pembelajaran digital pegawai Setjen DPD RI.",
      icon: "🚀"
    },
    {
      year: "2022",
      title: "Pertumbuhan Pengguna 100%",
      description: "Mencapai 1.000+ pengguna terdaftar dengan 500+ kursus tersedia dan tingkat kepuasan pengguna 95%.",
      icon: "📈"
    },
    {
      year: "2022",
      title: "Integrasi SSO Pemerintah",
      description: "Implementasi Single Sign-On (SSO) untuk memudahkan akses dan manajemen pengguna yang lebih aman.",
      icon: "🔐"
    },
    {
      year: "2023",
      title: "Sertifikasi Internasional",
      description: "Sistem sertifikasi profesional yang diakui secara internasional dan terintegasi dengan BNSP.",
      icon: "🏅"
    },
    {
      year: "2023",
      title: "Modul Pembelajaran Interaktif",
      description: "Pengembangan 50+ modul pembelajaran interaktif dengan video, kuis, dan diskusi real-time.",
      icon: "📚"
    },
    {
      year: "2024",
      title: "Dashboard Analytics Canggih",
      description: "Peluncuran dashboard analytics untuk melacak progres pembelajaran, trending searches, dan insights data pembelajaran.",
      icon: "📊"
    },
    {
      year: "2024",
      title: "Fitur Kolaborasi Pembelajaran",
      description: "Penambahan fitur Q&A, forum diskusi, dan wishlist untuk meningkatkan kolaborasi antar pengguna.",
      icon: "💬"
    },
    {
      year: "2025",
      title: "Ekspansi ke 50+ Instansi",
      description: "Perluasan penggunaan platform ke 50+ instansi pemerintah lainnya dengan adaptasi kurikulum lokal.",
      icon: "🌐"
    }
  ];

  const stats = [
    { value: "500+", label: "Kursus Tersedia", icon: "📖" },
    { value: "1000+", label: "Pengguna Aktif", icon: "👥" },
    { value: "50+", label: "Instruktur", icon: "👨‍🏫" },
    { value: "95%", label: "Kepuasan Pengguna", icon: "⭐" }
  ];

  return (
    <>
      <BaseHeader />
      <div className="capaian-container">
        <div className="container py-5">
          <div className="capaian-content">
            <h1 className="capaian-title">Capaian & Pencapaian</h1>
            <p className="capaian-subtitle">
              Perjalanan kesuksesan LMSetjen DPD RI dalam mendukung pembelajaran digital
            </p>

            {/* Statistics Section */}
            <div className="row mt-5 mb-5">
              <div className="col-12">
                <h2 className="section-title mb-4">Statistik Utama</h2>
              </div>
              {stats.map((stat, index) => (
                <div key={index} className="col-lg-3 col-md-6 col-12 mb-4">
                  <div className="stat-card">
                    <div className="stat-icon">{stat.icon}</div>
                    <h3 className="stat-value">{stat.value}</h3>
                    <p className="stat-label">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Timeline Section */}
            <div className="row">
              <div className="col-12">
                <h2 className="section-title mb-5">Timeline Pencapaian</h2>
                <div className="timeline">
                  {achievements.map((achievement, index) => (
                    <div key={index} className={`timeline-item ${index % 2 === 0 ? "left" : "right"}`}>
                      <div className="timeline-content">
                        <div className="timeline-icon">{achievement.icon}</div>
                        <div className="timeline-body">
                          <div className="timeline-year">{achievement.year}</div>
                          <h3 className="timeline-title">{achievement.title}</h3>
                          <p className="timeline-description">{achievement.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Milestones Section */}
            <div className="row mt-5">
              <div className="col-12">
                <h2 className="section-title mb-4">Pencapaian Khusus</h2>
              </div>
              <div className="col-md-6 mb-4">
                <div className="milestone-card">
                  <h3>🏆 Penghargaan Terbaik</h3>
                  <p>Mendapatkan penghargaan sebagai platform e-learning terbaik untuk institusi pemerintah di tahun 2024.</p>
                </div>
              </div>
              <div className="col-md-6 mb-4">
                <div className="milestone-card">
                  <h3>🔐 Keamanan Terjamin</h3>
                  <p>Sertifikasi keamanan data internasional (ISO 27001) untuk melindungi privasi pengguna dan data pembelajaran.</p>
                </div>
              </div>
              <div className="col-md-6 mb-4">
                <div className="milestone-card">
                  <h3>🌍 Aksesibilitas Global</h3>
                  <p>Platform dapat diakses 24/7 dari mana saja dengan uptime 99.9% dan dukungan multi-bahasa.</p>
                </div>
              </div>
              <div className="col-md-6 mb-4">
                <div className="milestone-card">
                  <h3>📱 Responsive Design</h3>
                  <p>Dirancang responsif untuk semua perangkat (desktop, tablet, smartphone) dengan pengalaman pengguna yang optimal.</p>
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div className="row mt-5">
              <div className="col-12">
                <div className="contact-section">
                  <h2>Ingin Tahu Lebih Lanjut?</h2>
                  <p>Hubungi tim kami untuk informasi lebih detail tentang capaian dan fitur terbaru LMSetjen DPD RI.</p>
                  <div className="contact-info mt-4">
                    <p><strong>Email:</strong> <a href="mailto:sdm@dpd.go.id">sdm@dpd.go.id</a></p>
                    <p><strong>Telepon:</strong> <a href="tel:+6285315869799">(+62) 853 1586 9799</a></p>
                    <p><strong>Lokasi:</strong> Setjen DPD RI Senayan, Jakarta, Indonesia</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default memo(Capaian);

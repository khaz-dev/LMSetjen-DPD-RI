import React, { memo } from "react";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import "./Tentang.css";

function Tentang() {
  return (
    <>
      <BaseHeader />
      <div className="tentang-container">
        <div className="container py-5">
          <div className="tentang-content">
            <h1 className="tentang-title">Tentang LMSetjen DPD RI</h1>
            <p className="tentang-subtitle">
              Platform e-learning untuk mendukung pengembangan SDM Setjen DPD RI
            </p>

            <div className="row mt-5">
              {/* About Section */}
              <div className="col-lg-8">
                <section className="tentang-section">
                  <h2>Apa itu LMSetjen DPD RI?</h2>
                  <p>
                    LMSetjen DPD RI adalah platform e-learning yang dikembangkan oleh Bagian Pengembangan Sumber Daya Manusia (BPSDM) 
                    Sekretariat Jenderal (Setjen) DPD RI. Platform ini dirancang khusus untuk mendukung pembelajaran digital 
                    dan pengembangan kompetensi bagi seluruh pegawai dan anggota Setjen DPD RI.
                  </p>
                  <p>
                    Dengan teknologi Learning Management System (LMS) terkini, LMSetjen DPD RI menyediakan akses mudah ke berbagai 
                    kursus pelatihan, materi pembelajaran, dan sertifikasi profesional yang disesuaikan dengan kebutuhan organisasi.
                  </p>
                </section>

                <section className="tentang-section">
                  <h2>Visi dan Misi</h2>
                  
                  <h3>Visi</h3>
                  <p>
                    Menjadi platform pembelajaran digital terdepan dalam mendukung pengembangan SDM yang berkualitas, 
                    kompeten, dan profesional di lingkungan Setjen DPD RI.
                  </p>

                  <h3>Misi</h3>
                  <ul>
                    <li>Menyediakan akses pembelajaran yang mudah, terjangkau, dan berkualitas tinggi</li>
                    <li>Mendukung pengembangan kompetensi pegawai sesuai dengan standar nasional</li>
                    <li>Meningkatkan efisiensi proses pembelajaran melalui teknologi digital</li>
                    <li>Memfasilitasi kolaborasi dan berbagi pengetahuan antar pegawai</li>
                    <li>Mengukur dan mengevaluasi efektivitas program pembelajaran</li>
                  </ul>
                </section>

                <section className="tentang-section">
                  <h2>Fitur Utama</h2>
                  <ul>
                    <li>
                      <strong>Katalog Kursus Lengkap:</strong> Ratusan kursus tersedia mencakup berbagai topik pengembangan SDM
                    </li>
                    <li>
                      <strong>Pembelajaran Fleksibel:</strong> Belajar kapan saja dan di mana saja sesuai kecepatan Anda
                    </li>
                    <li>
                      <strong>Forum Diskusi:</strong> Interaksi langsung dengan instruktur melalui Q&A forum
                    </li>
                    <li>
                      <strong>Sertifikat Digital:</strong> Dapatkan sertifikat terakui setelah menyelesaikan kursus
                    </li>
                    <li>
                      <strong>Tracking Progress:</strong> Pantau progress pembelajaran Anda secara real-time
                    </li>
                    <li>
                      <strong>Wishlist Kursus:</strong> Simpan kursus favorit untuk pembelajaran di kemudian hari
                    </li>
                    <li>
                      <strong>Search Canggih:</strong> Pencarian full-text untuk menemukan kursus dengan mudah
                    </li>
                  </ul>
                </section>

                <section className="tentang-section">
                  <h2>Pengembang</h2>
                  <p>
                    LMSetjen DPD RI dikembangkan oleh Bagian Pengembangan Sumber Daya Manusia (BPSDM) Setjen DPD RI 
                    dengan dukungan teknologi terkini dan tim profesional yang berpengalaman.
                  </p>
                </section>
              </div>

              {/* Info Box */}
              <div className="col-lg-4">
                <div className="info-box">
                  <h3 className="info-box-title">Informasi Kontak</h3>
                  <div className="info-item">
                    <i className="fas fa-envelope"></i>
                    <div>
                      <strong>Email</strong>
                      <p><a href="mailto:sdm@dpd.go.id">sdm@dpd.go.id</a></p>
                    </div>
                  </div>
                  <div className="info-item">
                    <i className="fas fa-phone"></i>
                    <div>
                      <strong>Telepon</strong>
                      <p>(+62) 853 1586 9799</p>
                    </div>
                  </div>
                  <div className="info-item">
                    <i className="fas fa-map-marker-alt"></i>
                    <div>
                      <strong>Lokasi</strong>
                      <p>Setjen DPD RI Senayan, Jakarta</p>
                    </div>
                  </div>
                </div>

                <div className="quick-stats mt-4">
                  <div className="stat-card">
                    <div className="stat-number">500+</div>
                    <div className="stat-label">Kursus Tersedia</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">1000+</div>
                    <div className="stat-label">Peserta Aktif</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">50+</div>
                    <div className="stat-label">Instruktur Berpengalaman</div>
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

export default memo(Tentang);

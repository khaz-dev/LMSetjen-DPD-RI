import React, { memo } from "react";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import "./Contact.css";

function Contact() {
  return (
    <>
      <BaseHeader />
      <div className="contact-container">
        <div className="container py-5">
          <div className="contact-content">
            <h1 className="contact-title">Hubungi Kami</h1>
            <p className="contact-subtitle">
              Kami siap membantu Anda dengan pertanyaan atau feedback tentang LMSetjen DPD RI
            </p>

            <div className="row mt-5">
              {/* Contact Information */}
              <div className="col-lg-6 mb-4 mb-lg-0">
                <div className="contact-card">
                  <h2 className="contact-card-title">Informasi Kontak</h2>
                  
                  <div className="contact-item">
                    <div className="contact-icon">
                      <i className="fas fa-envelope"></i>
                    </div>
                    <div className="contact-details">
                      <h5>Email</h5>
                      <p>
                        <a href="mailto:sdm@dpd.go.id">sdm@dpd.go.id</a>
                      </p>
                      <small className="text-muted">Respon dalam 1-2 hari kerja</small>
                    </div>
                  </div>

                  <div className="contact-item">
                    <div className="contact-icon">
                      <i className="fas fa-map-marker-alt"></i>
                    </div>
                    <div className="contact-details">
                      <h5>Lokasi</h5>
                      <p>
                        Gedung B lantai 4 | Sekretariat Jenderal DPD RI<br/>
                        Kompleks Parlemen Senayan, Jl. Gatot Subroto, Jakarta Selatan (10270)
                        Jalan Gatot Subroto, Jakarta Pusat
                      </p>
                    </div>
                  </div>

                  <div className="contact-item">
                    <div className="contact-icon">
                      <i className="fas fa-building"></i>
                    </div>
                    <div className="contact-details">
                      <h5>Organisasi</h5>
                      <p>
                        Bagian Pengembangan SDM (BPSDM)<br/>
                        Biro Organisasi Keanggotaan dan Kepegawaian<br/>
                        Deputi Administrasi | Sekretariat Jenderal DPD RI
                      </p>
                    </div>
                  </div>

                  <div className="contact-item">
                    <div className="contact-icon">
                      <i className="fas fa-clock"></i>
                    </div>
                    <div className="contact-details">
                      <h5>Jam Kerja</h5>
                      <p>
                        Senin - Jumat: 08:00 - 16:00 WIB<br/>
                        (Hari libur nasional tutup)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ and Support */}
              <div className="col-lg-6">
                <div className="contact-card">
                  <h2 className="contact-card-title">Pertanyaan Umum</h2>
                  
                  <div className="faq-item">
                    <h5>Bagaimana cara mendaftar akun?</h5>
                    <p>
                      Akun Anda dibuat secara otomatis saat pertama kali login menggunakan 
                      Google atau Nusa DPD. Anda tidak perlu mendaftar secara manual.
                    </p>
                  </div>

                  <div className="faq-item">
                    <h5>Bagaimana cara mengajukan feedback?</h5>
                    <p>
                      Kirimkan feedback Anda langsung ke email kami di 
                      <a href="mailto:sdm@dpd.go.id"> sdm@dpd.go.id</a>. 
                      Kami sangat menghargai masukan Anda untuk perbaikan platform.
                    </p>
                  </div>

                  <div className="faq-item">
                    <h5>Berapa lama sertifikat dikirim setelah kursus selesai?</h5>
                    <p>
                      Sertifikat otomatis diterbitkan setelah Anda menyelesaikan semua 
                      komponen kursus. Anda dapat mengunduhnya langsung dari dashboard Anda.
                    </p>
                  </div>

                  <div className="faq-item">
                    <h5>Bagaimana cara menghubungi instruktur kursus?</h5>
                    <p>
                      Gunakan fitur "Q&A" di halaman detail kursus untuk bertanya kepada instruktur. 
                      Instruktur biasanya merespon dalam 24-48 jam.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Support Message */}
            <div className="support-message mt-5">
              <div className="alert alert-info">
                <i className="fas fa-lightbulb me-2"></i>
                <strong>Tips:</strong> Sebelum menghubungi kami, silakan cek halaman 
                <a href="/user-guide/" className="ms-1">Panduan Pengguna </a> 
                untuk mendapatkan bantuan lebih cepat.
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default memo(Contact);

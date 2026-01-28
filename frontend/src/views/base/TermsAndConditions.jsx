import React, { memo } from "react";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import "./TermsAndConditions.css";

function TermsAndConditions() {
  return (
    <>
      <BaseHeader />
      <div className="policy-container">
        <div className="container py-5">
          <div className="policy-content">
            <h1 className="policy-title">Ketentuan Penggunaan</h1>
            <p className="policy-last-updated">
              Terakhir Diperbarui: Januari 2026
            </p>

            <section className="policy-section">
              <h2>1. Penerimaan Ketentuan</h2>
              <p>
                Dengan mengakses dan menggunakan LMSetjen DPD RI, Anda menerima dan setuju untuk terikat 
                oleh ketentuan dan kebijakan yang tercantum di sini.
              </p>
            </section>

            <section className="policy-section">
              <h2>2. Penggunaan Layanan</h2>
              <p>LMSetjen DPD RI disediakan untuk:</p>
              <ul>
                <li>Pegawai Setjen DPD RI dan pengguna yang berwenang</li>
                <li>Tujuan pembelajaran dan pengembangan profesional</li>
                <li>Aktivitas yang sah dan sesuai dengan peraturan pemerintah</li>
              </ul>
              <p>
                Anda setuju untuk tidak menggunakan platform untuk aktivitas ilegal, tidak etis, 
                atau yang melanggar kebijakan kami.
              </p>
            </section>

            <section className="policy-section">
              <h2>3. Akun Pengguna</h2>
              <p>
                Anda bertanggung jawab atas semua aktivitas yang terjadi di akun Anda. 
                Anda setuju untuk:
              </p>
              <ul>
                <li>Memberikan informasi yang akurat dan lengkap saat pendaftaran</li>
                <li>Menjaga kerahasiaan kredensial login Anda</li>
                <li>Memberi tahu kami segera tentang akses tidak sah</li>
                <li>Mematuhi semua peraturan yang berlaku</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>4. Konten dan Kursus</h2>
              <p>
                Semua konten pembelajaran, materi kursus, dan sertifikat yang tersedia di LMSetjen DPD RI 
                adalah milik BPSDM Setjen DPD RI atau penyedia konten yang ditunjuk.
              </p>
              <p>
                Anda dapat menggunakan konten untuk tujuan pembelajaran pribadi tetapi tidak boleh 
                mendistribusikan, menjual, atau memproduksi kembali tanpa izin tertulis.
              </p>
            </section>

            <section className="policy-section">
              <h2>5. Sertifikat dan Kredensial</h2>
              <p>
                Sertifikat diterbitkan setelah menyelesaikan kursus sesuai persyaratan. 
                Sertifikat adalah bukti keikutsertaan dan bukan jaminan kompetensi.
              </p>
              <p>
                Kami berhak untuk membatalkan sertifikat jika terdeteksi kecurangan atau pelanggaran ketentuan.
              </p>
            </section>

            <section className="policy-section">
              <h2>6. Pembatasan Tanggung Jawab</h2>
              <p>
                LMSetjen DPD RI disediakan "sebagaimana adanya" tanpa jaminan. 
                Kami tidak bertanggung jawab atas:
              </p>
              <ul>
                <li>Kehilangan atau kerusakan data</li>
                <li>Gangguan layanan atau waktu henti</li>
                <li>Kerugian tidak langsung atau konsekuensial</li>
                <li>Akses tidak sah ke sistem Anda</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>7. Modifikasi dan Penghentian</h2>
              <p>
                Kami berhak untuk mengubah, menunda, atau menghentikan layanan kapan saja dengan pemberitahuan. 
                Kami juga berhak untuk menonaktifkan akun yang melanggar ketentuan ini.
              </p>
            </section>

            <section className="policy-section">
              <h2>8. Larangan Kegiatan</h2>
              <p>Anda tidak boleh:</p>
              <ul>
                <li>Menggunakan bot, spider, atau alat otomasi lainnya</li>
                <li>Mencoba mengakses area yang tidak diizinkan</li>
                <li>Mengganggu atau merusak fungsi platform</li>
                <li>Berbagi akun dengan orang lain</li>
                <li>Melakukan kegiatan yang dapat membahayakan sistem</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>9. Hak Kekayaan Intelektual</h2>
              <p>
                Semua materi di LMSetjen DPD RI, termasuk teks, grafis, logo, dan konten pembelajaran, 
                dilindungi oleh hak kekayaan intelektual. Penggunaan tanpa izin adalah pelanggaran.
              </p>
            </section>

            <section className="policy-section">
              <h2>10. Penyelesaian Sengketa</h2>
              <p>
                Ketentuan ini diatur oleh hukum Republik Indonesia. 
                Setiap sengketa akan diselesaikan melalui jalur yang ditentukan oleh BPSDM Setjen DPD RI.
              </p>
            </section>

            <section className="policy-section">
              <h2>11. Kontak Dukungan</h2>
              <p>
                Untuk pertanyaan tentang ketentuan ini, silakan hubungi:
              </p>
              <ul>
                <li>Email: <a href="mailto:sdm@dpd.go.id">sdm@dpd.go.id</a></li>
                <li>Bagian Pengembangan Sumber Daya Manusia (BPSDM) <br/>
                Biro OKK | Deputi Administrasi | Setjen DPD RI</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default memo(TermsAndConditions);

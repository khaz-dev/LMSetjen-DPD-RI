import React, { memo } from "react";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import "./CookiePolicy.css";

function CookiePolicy() {
  return (
    <>
      <BaseHeader />
      <div className="policy-container">
        <div className="container py-5">
          <div className="policy-content">
            <h1 className="policy-title">Informasi Cookie</h1>
            <p className="policy-last-updated">
              Terakhir Diperbarui: Januari 2026
            </p>

            <section className="policy-section">
              <h2>1. Apa Itu Cookie?</h2>
              <p>
                Cookie adalah file kecil yang disimpan di komputer atau perangkat Anda ketika Anda mengunjungi situs web. 
                Cookie membantu situs web mengingat informasi tentang kunjungan Anda.
              </p>
            </section>

            <section className="policy-section">
              <h2>2. Jenis Cookie yang Kami Gunakan</h2>
              
              <h3>Cookies Esensial</h3>
              <p>
                Cookies ini diperlukan untuk fungsi dasar platform, seperti:
              </p>
              <ul>
                <li>Autentikasi dan keamanan login</li>
                <li>Mengelola sesi pengguna</li>
                <li>Melindungi dari serangan keamanan</li>
                <li>Mengingat preferensi bahasa</li>
              </ul>

              <h3>Cookies Analitik</h3>
              <p>
                Cookies ini membantu kami memahami bagaimana pengguna berinteraksi dengan platform:
              </p>
              <ul>
                <li>Melacak halaman yang dikunjungi</li>
                <li>Mengukur durasi sesi</li>
                <li>Mengidentifikasi fitur yang paling digunakan</li>
                <li>Meningkatkan pengalaman pengguna</li>
              </ul>

              <h3>Cookies Preferensi</h3>
              <p>
                Cookies ini mengingat pilihan dan preferensi Anda:
              </p>
              <ul>
                <li>Tema tampilan (terang/gelap)</li>
                <li>Pengaturan notifikasi</li>
                <li>Pilihan bahasa</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>3. Token JWT</h2>
              <p>
                LMSetjen DPD RI menggunakan JSON Web Token (JWT) untuk autentikasi. 
                Token disimpan di localStorage atau sessionStorage browser Anda untuk:
              </p>
              <ul>
                <li>Menjaga Anda tetap login</li>
                <li>Memverifikasi identitas untuk setiap permintaan</li>
                <li>Mengelola sesi keamanan</li>
              </ul>
              <p>
                Token ini penting untuk fungsi platform dan tidak dapat dinonaktifkan.
              </p>
            </section>

            <section className="policy-section">
              <h2>4. Cara Kami Menggunakan Cookie</h2>
              <ul>
                <li>
                  <strong>Peningkatan Layanan:</strong> Memahami bagaimana Anda menggunakan platform
                </li>
                <li>
                  <strong>Personalisasi:</strong> Menyesuaikan pengalaman berdasarkan preferensi Anda
                </li>
                <li>
                  <strong>Keamanan:</strong> Mendeteksi dan mencegah aktivitas mencurigakan
                </li>
                <li>
                  <strong>Fungsionalitas:</strong> Memastikan fitur platform berfungsi dengan baik
                </li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>5. Kontrol Cookie</h2>
              <p>
                Anda dapat mengelola pengaturan cookie melalui browser Anda:
              </p>
              <ul>
                <li>Menerima atau menolak cookie tertentu</li>
                <li>Menghapus cookie yang tersimpan</li>
                <li>Menetapkan browser untuk memberi tahu sebelum menerima cookie</li>
              </ul>
              <p>
                <strong>Catatan:</strong> Menonaktifkan cookies esensial dapat mengganggu 
                fungsi platform dan pengalaman login Anda.
              </p>
            </section>

            <section className="policy-section">
              <h2>6. Cookie Pihak Ketiga</h2>
              <p>
                Platform kami mengintegrasikan layanan pihak ketiga yang mungkin menggunakan cookie:
              </p>
              <ul>
                <li><strong>Google OAuth:</strong> Untuk autentikasi login Google</li>
                <li><strong>Nusa DPD:</strong> Untuk verifikasi SSO pemerintah</li>
              </ul>
              <p>
                Layanan pihak ketiga ini memiliki kebijakan cookie mereka sendiri. 
                Kami merekomendasikan untuk meninjau kebijakan mereka.
              </p>
            </section>

            <section className="policy-section">
              <h2>7. Retensi Cookie</h2>
              <p>
                Cookie disimpan untuk periode berikut:
              </p>
              <ul>
                <li><strong>Cookies Sesi:</strong> Dihapus ketika Anda menutup browser</li>
                <li><strong>Cookies Permanen:</strong> Dapat bertahan hingga 1 tahun</li>
                <li><strong>Token Autentikasi:</strong> Diperbarui sesuai kebutuhan keamanan</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>8. Privasi dan Keamanan</h2>
              <p>
                Cookie yang kami gunakan tidak mengandung informasi pribadi yang sensitif. 
                Semua data dikenkripsi dan hanya dapat diakses oleh sistem kami.
              </p>
            </section>

            <section className="policy-section">
              <h2>9. Perubahan Kebijakan Cookie</h2>
              <p>
                Kami dapat mengubah kebijakan cookie ini. Perubahan akan diumumkan di platform, 
                dan penggunaan berkelanjutan berarti penerimaan Anda.
              </p>
            </section>

            <section className="policy-section">
              <h2>10. Kontak Kami</h2>
              <p>
                Jika Anda memiliki pertanyaan tentang penggunaan cookie kami:
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

export default memo(CookiePolicy);

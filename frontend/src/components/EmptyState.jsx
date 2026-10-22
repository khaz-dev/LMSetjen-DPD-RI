import React, { memo } from "react";
import { Link } from "react-router-dom";

const EmptyState = ({ onReset, isFilterActive = false }) => {
    return (
        <div className="modern-empty-state">
            <div className="empty-state-icon mb-3">
                <i className={`fas ${isFilterActive ? "fa-search" : "fa-graduation-cap"}`}></i>
            </div>
            <h4 className="empty-state-title mb-2">
                {isFilterActive ? "Tidak Ada Kursus yang Sesuai" : "Belum Ada Kursus Dibuat"}
            </h4>
            <p className="empty-state-desc mb-3">
                {isFilterActive 
                    ? "Tidak ditemukan kursus yang cocok dengan kata kunci pencarian atau filter yang Anda pilih. Coba sesuaikan kriteria pencarian." 
                    : "Anda belum memiliki daftar kursus. Mulai bangun materi dan program pelatihan pertama Anda untuk pegawai Setjen DPD RI."}
            </p>
            {isFilterActive ? (
                <button 
                    type="button" 
                    className="btn btn-sm btn-outline-teal"
                    onClick={onReset}
                >
                    <i className="fas fa-undo me-1.5"></i>
                    Reset Filter Pencarian
                </button>
            ) : (
                <Link 
                    to="/instructor/create-course/" 
                    className="btn btn-sm btn-teal"
                >
                    <i className="fas fa-plus me-1.5"></i>
                    Buat Kursus Pertama
                </Link>
            )}
        </div>
    );
};

export default memo(EmptyState);
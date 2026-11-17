import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import apiInstance from '../../utils/axios';
import UserData from '../../views/plugin/UserData';
import Toast from '../../views/plugin/Toast';
import './MantaTypeGame.css';

// Import sprite Manta untuk aktor utama
import mantaIdleWebp from '../../assets/avatar/manta-idle.webp';
import mantaHappyWebp from '../../assets/avatar/manta-happy.webp';

// ============================================================================
// 📚 BANK KOSAKATA MANTATYPE (BERAKHLAK, DPD RI, KEPARLEMENAN, LMS, & UMUM)
// Semua kata dipastikan utuh tanpa spasi agar ritme mengetik lancar tanpa macet!
// ============================================================================
const WORD_BANK = {
    // Wave 1: Kata-kata pendek & bersahabat (3 - 4 huruf)
    easy: [
        'DPD', 'BAP', 'PURT', 'RUU', 'ASN', 'DEWAN', 'KUIS', 'MODUL',
        'MANTA', 'ASIH', 'HAK', 'ERA', 'IBA', 'KAF', 'SAH', 'AKAL', 'AKSI',
        'ASAS', 'BAKU', 'DATA', 'ETOS', 'KAJI', 'VISI', 'SANI', 'POLA', 'IDP',
        'NUSA', 'SDM', 'OKK'
    ],
    // Wave 2-3: Kata-kata sedang keparlemenan & nilai ASN (5 - 7 huruf)
    medium: [
        'SENATOR', 'SIDANG', 'KOMITE', 'PLENO', 'DAERAH', 'BELAJAR', 'KURSUS',
        'MATERI', 'LENCANA', 'INOVASI', 'DIGITAL', 'PORTAL', 'SCORM', 'VIDEO',
        'HARMONIS', 'LOYAL', 'ADAPTIF', 'AMANAH', 'SINERGI', 'DISIPLIN', 'KINERJA',
        'MAGER', 'GABUT', 'SOLID', 'LOGIS', 'NALAR', 'OPINI', 'SAHIH',
        'JUARA', 'DIKSI', 'FASID', 'ANOMALI', 'INOVASI', 'EMPIRIS', 'SENATOR'
    ],
    // Wave 4+: Kata-kata panjang, nilai BerAKHLAK, tata kelola & tantangan tinggi (8 - 14 huruf)
    hard: [
        'BERAKHLAK', 'INTEGRITAS', 'AKUNTABEL', 'KOMPETEN', 'KOLABORATIF',
        'LEGISLASI', 'ASPIRASI', 'PARLEMEN', 'SEKRETARIAT', 'PROTOKOL', 'REGULASI',
        'KEBIJAKAN', 'DEMOKRASI', 'KONSTITUSI', 'PROFESIONAL', 'REFORMASI',
        'BIROKRASI', 'PELAYANAN', 'SERTIFIKAT', 'KOMPETENSI', 'KNOWLEDGE',
        'PRESTASI', 'SAYAAKANLAWAN', 'ANTEKANTEKASING', 'JANGANYADEKYA', 'ILOVEYOU',
        'KONTRIBUTIF', 'LEGISLATIF', 'AKUNTABILITAS', 'KAPALLAUT', 'MENYALAABANGKU', 'SIMANTAP',
        'SEKRETARIAT', 'PERWAKILAN'

    ]
};

// ============================================================================
// 🔄 BANK KATA DINAMIS (Dapat diubah Admin tanpa rebuild/redeploy)
// ============================================================================
let DYNAMIC_WORD_BANK = {
    easy: [...WORD_BANK.easy],
    medium: [...WORD_BANK.medium],
    hard: [...WORD_BANK.hard]
};
let DYNAMIC_WORD_MEANINGS = {};

export const updateActiveWordBank = (backendWords, backendMeanings) => {
    if (backendWords) {
        if (Array.isArray(backendWords.easy) && backendWords.easy.length > 0) {
            DYNAMIC_WORD_BANK.easy = backendWords.easy;
        }
        if (Array.isArray(backendWords.medium) && backendWords.medium.length > 0) {
            DYNAMIC_WORD_BANK.medium = backendWords.medium;
        }
        if (Array.isArray(backendWords.hard) && backendWords.hard.length > 0) {
            DYNAMIC_WORD_BANK.hard = backendWords.hard;
        }
    }
    if (backendMeanings && typeof backendMeanings === 'object') {
        DYNAMIC_WORD_MEANINGS = { ...backendMeanings };
    }
};

// Ambil kata acak berdasarkan tingkat kesulitan / wave dengan pencegahan bentrok huruf awal
const getRandomWord = (wave, existingEnemies = []) => {
    let pool = DYNAMIC_WORD_BANK.easy;
    const roll = Math.random();

    if (wave >= 7) {
        // Wave 7+: Komposisi seimbang 35% hard, 45% medium, 20% easy agar ritme ketik manusiawi
        if (roll < 0.35) pool = DYNAMIC_WORD_BANK.hard;
        else if (roll < 0.80) pool = DYNAMIC_WORD_BANK.medium;
        else pool = DYNAMIC_WORD_BANK.easy;
    } else if (wave >= 4) {
        // Wave 4-6: 30% hard, 50% medium, 20% easy
        if (roll < 0.30) pool = DYNAMIC_WORD_BANK.hard;
        else if (roll < 0.80) pool = DYNAMIC_WORD_BANK.medium;
        else pool = DYNAMIC_WORD_BANK.easy;
    } else if (wave >= 2) {
        // Wave 2-3: 15% hard, 60% medium, 25% easy
        if (roll < 0.15) pool = DYNAMIC_WORD_BANK.hard;
        else if (roll < 0.75) pool = DYNAMIC_WORD_BANK.medium;
        else pool = DYNAMIC_WORD_BANK.easy;
    } else {
        // Wave 1: 80% easy, 20% medium
        if (roll < 0.80) pool = DYNAMIC_WORD_BANK.easy;
        else pool = DYNAMIC_WORD_BANK.medium;
    }

    if (!pool || pool.length === 0) pool = WORD_BANK.easy;

    // Filter agar huruf pertama tidak bentrok dengan musuh yang sedang ada di layar
    const existingFirstChars = new Set((existingEnemies || []).map(en => en.word && en.word[0]).filter(Boolean));
    const distinctCandidates = pool.filter(w => {
        const clean = w.replace(/\s+/g, '').toUpperCase();
        return clean.length > 0 && !existingFirstChars.has(clean[0]);
    });

    const chosenPool = distinctCandidates.length > 0 ? distinctCandidates : pool;
    const word = chosenPool[Math.floor(Math.random() * chosenPool.length)];
    // Jaminan: Hapus spasi jika ada agar tidak macet di tengah permainan
    return word.replace(/\s+/g, '').toUpperCase();
};

// ============================================================================
// 🔊 SOUND & BGM SYNTHESIZER (WEB AUDIO API - ZERO ASSET DEPENDENCY)
// ============================================================================
class ArcadeAudioEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.bgmVolume = 0.65;
        this.sfxVolume = 0.85;
        this.bgmPlaying = false;
        this.bgmTimer = null;
        this.droneOsc = null;
        this.droneGain = null;
        this.bgmGain = null;
        this.bgmFilter = null;
        this.bgmStep = 0;

        try {
            const saved = localStorage.getItem('mantatype_audio_volumes');
            if (saved) {
                const p = JSON.parse(saved);
                if (typeof p.bgm === 'number') this.bgmVolume = p.bgm;
                if (typeof p.sfx === 'number') this.sfxVolume = p.sfx;
                if (typeof p.muted === 'boolean') this.isMuted = p.muted;
            }
        } catch (_) {}
    }

    setBgmVolume(val) {
        this.bgmVolume = Math.max(0, Math.min(1, val));
        if (this.bgmGain && this.ctx) {
            try {
                this.bgmGain.gain.setValueAtTime(this.isMuted ? 0 : 0.32 * this.bgmVolume, this.ctx.currentTime);
            } catch (_) {}
        }
        this.saveAudioConfig();
    }

    setSfxVolume(val) {
        this.sfxVolume = Math.max(0, Math.min(1, val));
        this.saveAudioConfig();
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (this.bgmGain && this.ctx) {
            try {
                this.bgmGain.gain.setValueAtTime(muted ? 0 : 0.32 * this.bgmVolume, this.ctx.currentTime);
            } catch (_) {}
        }
        this.saveAudioConfig();
    }

    saveAudioConfig() {
        try {
            localStorage.setItem('mantatype_audio_volumes', JSON.stringify({
                bgm: this.bgmVolume,
                sfx: this.sfxVolume,
                muted: this.isMuted
            }));
        } catch (_) {}
    }

    init() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => { });
        }
        return this.ctx;
    }

    // 🌊 AMBIENT OCEAN BGM (AQUATIC SYNTH RETRO ARCADE LOOP)
    startBGM() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        if (this.bgmPlaying) return;
        this.bgmPlaying = true;
        this.bgmStep = 0;

        try {
            // Master BGM Gain (Terdengar Jelas, Hangat, & Lembut)
            this.bgmGain = this.ctx.createGain();
            this.bgmGain.gain.setValueAtTime(0.32 * this.bgmVolume, this.ctx.currentTime);
            this.bgmGain.connect(this.ctx.destination);

            // Submerged Acoustic Lowpass Filter (Nuansa Bawah Air yang Jernih)
            this.bgmFilter = this.ctx.createBiquadFilter();
            this.bgmFilter.type = 'lowpass';
            this.bgmFilter.frequency.setValueAtTime(1350, this.ctx.currentTime);
            this.bgmFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);
            this.bgmFilter.connect(this.bgmGain);

            // Ambient Water Drone Pad (A2 110Hz Warm Sine)
            this.droneOsc = this.ctx.createOscillator();
            this.droneOsc.type = 'sine';
            this.droneOsc.frequency.setValueAtTime(110, this.ctx.currentTime);

            this.droneGain = this.ctx.createGain();
            this.droneGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

            this.droneOsc.connect(this.droneGain);
            this.droneGain.connect(this.bgmFilter);
            this.droneOsc.start();

            // Tangga Nada Pentatonik Aquatik (F Major / D Minor Pentatonic)
            const melodyNotes = [
                146.83, 174.61, 196.00, 220.00, 261.63,
                293.66, 349.23, 392.00, 440.00, 523.25, 587.33
            ];

            // Melodi riak air 16 langkah
            const melodySeq = [
                5, 7, 8, 7, 5, 6, 7, 9,
                8, 7, 5, 7, 6, 5, 4, 5
            ];

            // Bassline pengiring bawah laut (D2, F2, G2, A2)
            const bassNotes = [
                73.42, 87.31, 98.00, 110.00
            ];
            const bassSeq = [
                0, 0, 1, 1, 2, 2, 3, 3,
                0, 0, 1, 1, 2, 2, 3, 3
            ];

            const stepDuration = 0.22;
            let nextNoteTime = this.ctx.currentTime + 0.05;
            const scheduleAheadTime = 0.28;

            const scheduler = () => {
                if (!this.bgmPlaying || !this.ctx || this.isMuted) return;

                if (nextNoteTime < this.ctx.currentTime) {
                    nextNoteTime = this.ctx.currentTime + 0.05;
                }

                while (nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
                    const step = this.bgmStep;
                    const noteTime = nextNoteTime;

                    // 1. Melodi Arpeggio Lembut (Triangle Wave)
                    const mIdx = melodySeq[step % melodySeq.length];
                    const mFreq = melodyNotes[mIdx % melodyNotes.length];

                    const mOsc = this.ctx.createOscillator();
                    const mGain = this.ctx.createGain();
                    mOsc.type = 'triangle';
                    mOsc.frequency.setValueAtTime(mFreq, noteTime);

                    mGain.gain.setValueAtTime(0.0001, noteTime);
                    mGain.gain.exponentialRampToValueAtTime(0.24, noteTime + 0.025);
                    mGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + stepDuration * 0.90);

                    mOsc.connect(mGain);
                    mGain.connect(this.bgmFilter);
                    mOsc.start(noteTime);
                    mOsc.stop(noteTime + stepDuration);

                    // 2. Bassline Denyut Bawah Laut (Tiap 2 step)
                    if (step % 2 === 0) {
                        const bIdx = bassSeq[(step / 2) % bassSeq.length];
                        const bFreq = bassNotes[bIdx % bassNotes.length];

                        const bOsc = this.ctx.createOscillator();
                        const bGain = this.ctx.createGain();
                        bOsc.type = 'triangle';
                        bOsc.frequency.setValueAtTime(bFreq, noteTime);

                        bGain.gain.setValueAtTime(0.0001, noteTime);
                        bGain.gain.exponentialRampToValueAtTime(0.20, noteTime + 0.03);
                        bGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + stepDuration * 1.8);

                        bOsc.connect(bGain);
                        bGain.connect(this.bgmFilter);
                        bOsc.start(noteTime);
                        bOsc.stop(noteTime + stepDuration * 1.9);
                    }

                    // 3. Sonar Radar Ping Bawah Laut (Aksen setiap 8 step)
                    if (step % 8 === 0) {
                        const pingOsc = this.ctx.createOscillator();
                        const pingGain = this.ctx.createGain();
                        pingOsc.type = 'sine';
                        pingOsc.frequency.setValueAtTime(880, noteTime);
                        pingOsc.frequency.exponentialRampToValueAtTime(1320, noteTime + 0.14);

                        pingGain.gain.setValueAtTime(0.08, noteTime);
                        pingGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.38);

                        pingOsc.connect(pingGain);
                        pingGain.connect(this.bgmGain);
                        pingOsc.start(noteTime);
                        pingOsc.stop(noteTime + 0.4);
                    }

                    this.bgmStep++;
                    nextNoteTime += stepDuration;
                }
            };

            // Lookahead scheduler interval 60ms yang stabil
            this.bgmTimer = setInterval(scheduler, 60);
        } catch (_) { }
    }

    stopBGM() {
        this.bgmPlaying = false;
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
        if (this.droneOsc) {
            try { this.droneOsc.stop(); } catch (_) { }
            this.droneOsc = null;
        }
        if (this.bgmGain && this.ctx) {
            try {
                this.bgmGain.gain.setValueAtTime(0, this.ctx.currentTime);
                this.bgmGain.disconnect();
            } catch (_) { }
            this.bgmGain = null;
        }
    }

    playKeyHit(combo = 0) {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const baseFreq = 540 + Math.min(combo * 28, 480);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, this.ctx.currentTime + 0.06);

            gain.gain.setValueAtTime(0.09 * this.sfxVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.06);
        } catch (_) { }
    }

    playWordExplode() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const notes = [440, 554, 659, 880];
            notes.forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.03);
                osc.frequency.exponentialRampToValueAtTime(freq * 1.25, this.ctx.currentTime + i * 0.03 + 0.12);

                gain.gain.setValueAtTime(0.12 * this.sfxVolume, this.ctx.currentTime + i * 0.03);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.03 + 0.15);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(this.ctx.currentTime + i * 0.03);
                osc.stop(this.ctx.currentTime + i * 0.03 + 0.15);
            });
        } catch (_) { }
    }

    // 💥 POWER-UP: EMP BOMB BLAST
    playEmpBomb() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.45);

            gain.gain.setValueAtTime(0.28 * this.sfxVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.45);

            const chord = [880, 1108, 1318, 1760];
            chord.forEach((freq, idx) => {
                const hOsc = this.ctx.createOscillator();
                const hGain = this.ctx.createGain();
                hOsc.type = 'sine';
                hOsc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.04);
                hGain.gain.setValueAtTime(0.12 * this.sfxVolume, this.ctx.currentTime + idx * 0.04);
                hGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.04 + 0.25);
                hOsc.connect(hGain);
                hGain.connect(this.ctx.destination);
                hOsc.start(this.ctx.currentTime + idx * 0.04);
                hOsc.stop(this.ctx.currentTime + idx * 0.04 + 0.25);
            });
        } catch (_) { }
    }

    // ❄️ POWER-UP: SLOW-MO ARUS TENANG
    playSlowMo() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const freqs = [1046, 1318, 1567, 2093];
            freqs.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.05);
                gain.gain.setValueAtTime(0.15 * this.sfxVolume, this.ctx.currentTime + idx * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.05 + 0.35);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(this.ctx.currentTime + idx * 0.05);
                osc.stop(this.ctx.currentTime + idx * 0.05 + 0.35);
            });
        } catch (_) { }
    }

    // 💚 POWER-UP: HEAL +1 NYAWA
    playHeal() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const freqs = [523, 659, 784, 1046];
            freqs.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.06);
                gain.gain.setValueAtTime(0.15 * this.sfxVolume, this.ctx.currentTime + idx * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.06 + 0.28);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(this.ctx.currentTime + idx * 0.06);
                osc.stop(this.ctx.currentTime + idx * 0.06 + 0.28);
            });
        } catch (_) { }
    }

    playWrongKey() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, this.ctx.currentTime);
            osc.frequency.setValueAtTime(110, this.ctx.currentTime + 0.05);

            gain.gain.setValueAtTime(0.08 * this.sfxVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.09);
        } catch (_) { }
    }

    playLifeLost() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(260, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.28);

            gain.gain.setValueAtTime(0.16 * this.sfxVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.28);
        } catch (_) { }
    }

    playGameOver() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const notes = [392, 349, 311, 261];
            notes.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.12);

                gain.gain.setValueAtTime(0.14 * this.sfxVolume, this.ctx.currentTime + idx * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.12 + 0.2);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(this.ctx.currentTime + idx * 0.12);
                osc.stop(this.ctx.currentTime + idx * 0.12 + 0.2);
            });
        } catch (_) { }
    }

    // 🎖️ FANFARE BONUS XP & LEVEL UP PEGAWAI
    playLevelUpFanfare() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const notes = [
                { f: 523.25, t: 0.00, d: 0.14 },
                { f: 659.25, t: 0.12, d: 0.14 },
                { f: 783.99, t: 0.24, d: 0.18 },
                { f: 1046.50, t: 0.38, d: 0.50 }
            ];
            notes.forEach(n => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(n.f, this.ctx.currentTime + n.t);
                gain.gain.setValueAtTime(0.22 * this.sfxVolume, this.ctx.currentTime + n.t);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + n.t + n.d);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(this.ctx.currentTime + n.t);
                osc.stop(this.ctx.currentTime + n.t + n.d);
            });
        } catch (_) { }
    }

    // 🚨 ALARM SIRENE KEDATANGAN BOS APEX
    playBossAlarm() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            [0, 0.45].forEach(delay => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(140, this.ctx.currentTime + delay);
                osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + delay + 0.35);
                gain.gain.setValueAtTime(0.24 * this.sfxVolume, this.ctx.currentTime + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + 0.35);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(this.ctx.currentTime + delay);
                osc.stop(this.ctx.currentTime + delay + 0.35);
            });
        } catch (_) { }
    }

    // 💥 BENTURAN SERANGAN KE PERISAI BOS
    playBossHit() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(240, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.22);
            gain.gain.setValueAtTime(0.22 * this.sfxVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.22);
        } catch (_) { }
    }

    // 🏆 FANFARE KEMENANGAN TOTAL MENAKLUKKAN BOS
    playBossDefeated() {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const notes = [
                { f: 392.00, t: 0.00, d: 0.16 },
                { f: 523.25, t: 0.14, d: 0.16 },
                { f: 659.25, t: 0.28, d: 0.16 },
                { f: 783.99, t: 0.42, d: 0.22 },
                { f: 1046.50, t: 0.60, d: 0.65 }
            ];
            notes.forEach(n => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(n.f, this.ctx.currentTime + n.t);
                gain.gain.setValueAtTime(0.28 * this.sfxVolume, this.ctx.currentTime + n.t);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + n.t + n.d);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(this.ctx.currentTime + n.t);
                osc.stop(this.ctx.currentTime + n.t + n.d);
            });
        } catch (_) { }
    }

    // ⏱️ AUDIO HITUNG MUNDUR (COUNTDOWN 3.. 2.. 1.. MENYELAM!)
    playCountdown(isFinal = false) {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = isFinal ? 'triangle' : 'sine';
            const freq = isFinal ? 880 : 493.88; // B4 (494 Hz) untuk 3-2-1, A5 (880 Hz) untuk GO
            const dur = isFinal ? 0.38 : 0.18;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            if (isFinal) {
                osc.frequency.exponentialRampToValueAtTime(1046.5, this.ctx.currentTime + 0.18);
            }
            gain.gain.setValueAtTime((isFinal ? 0.28 : 0.22) * this.sfxVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + dur);
        } catch (_) { }
    }
}

const audio = new ArcadeAudioEngine();

// ============================================================================
// 🎨 RENDER KARAKTER MUSUH YANG DETAIL & MENARIK
// ============================================================================

// 1. Tipe Apex Cyber Shark
const drawShark = (ctx, en, now) => {
    const tailWiggle = Math.sin(now * 0.009 + en.wiggle) * 8;
    const bodyLen = en.size * 1.5;
    const bodyHeight = en.size * 0.65;

    const bodyGrad = ctx.createLinearGradient(0, -bodyHeight, 0, bodyHeight);
    bodyGrad.addColorStop(0, '#0284c7');
    bodyGrad.addColorStop(0.5, '#0369a1');
    bodyGrad.addColorStop(1, '#38bdf8');

    // Body
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.7, 0);
    ctx.quadraticCurveTo(-bodyLen * 0.2, -bodyHeight, bodyLen * 0.4, -bodyHeight * 0.4);
    ctx.lineTo(bodyLen * 0.75 + tailWiggle * 0.5, -bodyHeight * 0.2);
    ctx.lineTo(bodyLen * 0.75 + tailWiggle * 0.5, bodyHeight * 0.2);
    ctx.quadraticCurveTo(-bodyLen * 0.1, bodyHeight, -bodyLen * 0.7, 0);
    ctx.closePath();
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Shark Dorsal Fin
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.15, -bodyHeight * 0.8);
    ctx.lineTo(-bodyLen * 0.35, -bodyHeight * 1.5);
    ctx.quadraticCurveTo(-bodyLen * 0.1, -bodyHeight * 1.3, bodyLen * 0.15, -bodyHeight * 0.6);
    ctx.closePath();
    ctx.fillStyle = '#0369a1';
    ctx.fill();
    ctx.stroke();

    // Caudal Tail Fin
    ctx.beginPath();
    const tailX = bodyLen * 0.75 + tailWiggle;
    ctx.moveTo(bodyLen * 0.6, 0);
    ctx.lineTo(tailX + 16, -bodyHeight * 1.1);
    ctx.quadraticCurveTo(tailX + 6, 0, tailX + 16, bodyHeight * 1.1);
    ctx.closePath();
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.stroke();

    // Pectoral Fin
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.2, bodyHeight * 0.2);
    ctx.lineTo(-bodyLen * 0.45, bodyHeight * 0.9);
    ctx.lineTo(-bodyLen * 0.05, bodyHeight * 0.4);
    ctx.closePath();
    ctx.fillStyle = '#0284c7';
    ctx.fill();

    // Gills
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5;
    for (let g = 0; g < 3; g++) {
        ctx.beginPath();
        const gx = -bodyLen * 0.25 - g * 4;
        ctx.moveTo(gx, -bodyHeight * 0.3);
        ctx.lineTo(gx - 2, bodyHeight * 0.3);
        ctx.stroke();
    }

    // Glowing Predator Eye
    ctx.beginPath();
    ctx.arc(-bodyLen * 0.5, -bodyHeight * 0.2, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-bodyLen * 0.51, -bodyHeight * 0.2, 2, 0, Math.PI * 2);
    ctx.fill();
};

// 2. Tipe Armored Hammerhead Shark
const drawHammerhead = (ctx, en, now) => {
    const tailWiggle = Math.sin(now * 0.007 + en.wiggle) * 10;
    const bodyLen = en.size * 1.6;
    const bodyHeight = en.size * 0.7;

    const grad = ctx.createLinearGradient(0, -bodyHeight, 0, bodyHeight);
    grad.addColorStop(0, '#e11d48');
    grad.addColorStop(0.5, '#881337');
    grad.addColorStop(1, '#f43f5e');

    // Body
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.5, 0);
    ctx.quadraticCurveTo(-bodyLen * 0.1, -bodyHeight, bodyLen * 0.4, -bodyHeight * 0.4);
    ctx.lineTo(bodyLen * 0.8 + tailWiggle * 0.5, -bodyHeight * 0.2);
    ctx.lineTo(bodyLen * 0.8 + tailWiggle * 0.5, bodyHeight * 0.2);
    ctx.quadraticCurveTo(-bodyLen * 0.1, bodyHeight, -bodyLen * 0.5, 0);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Hammer T-Head Bar
    ctx.beginPath();
    ctx.roundRect(-bodyLen * 0.78, -bodyHeight * 1.3, 14, bodyHeight * 2.6, 5);
    ctx.fillStyle = '#be123c';
    ctx.fill();
    ctx.stroke();

    // Twin Eyes on Hammer
    [-bodyHeight * 1.15, bodyHeight * 1.15].forEach(ey => {
        ctx.beginPath();
        ctx.arc(-bodyLen * 0.72, ey, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Tall Dorsal Fin
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.15, -bodyHeight * 0.8);
    ctx.lineTo(-bodyLen * 0.35, -bodyHeight * 1.6);
    ctx.lineTo(bodyLen * 0.1, -bodyHeight * 0.6);
    ctx.closePath();
    ctx.fillStyle = '#881337';
    ctx.fill();
    ctx.stroke();

    // Tail Fin
    const tailX = bodyLen * 0.8 + tailWiggle;
    ctx.beginPath();
    ctx.moveTo(bodyLen * 0.7, 0);
    ctx.lineTo(tailX + 18, -bodyHeight * 1.25);
    ctx.quadraticCurveTo(tailX + 5, 0, tailX + 18, bodyHeight * 1.25);
    ctx.closePath();
    ctx.fillStyle = '#be123c';
    ctx.fill();
    ctx.stroke();
};

// 3. Tipe Bioluminescent Jellyfish
const drawJelly = (ctx, en, now) => {
    const pulse = Math.sin(now * 0.007 + en.wiggle) * 4;
    const domeR = en.size * 0.9 + pulse;

    const domeGrad = ctx.createRadialGradient(0, -8, 2, 0, -8, domeR);
    domeGrad.addColorStop(0, '#c084fc');
    domeGrad.addColorStop(0.6, '#0ea5e9');
    domeGrad.addColorStop(1, 'rgba(14, 165, 233, 0.25)');

    // Bell Dome
    ctx.beginPath();
    ctx.arc(0, -6, domeR, Math.PI, 0, false);
    ctx.quadraticCurveTo(domeR * 0.5, 8, 0, 4);
    ctx.quadraticCurveTo(-domeR * 0.5, 8, -domeR, -6);
    ctx.closePath();
    ctx.fillStyle = domeGrad;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glowing Core
    ctx.beginPath();
    ctx.arc(0, -8, domeR * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Tentacles
    ctx.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
        const tx = i * (domeR / 4.2);
        const wavePhase = now * 0.006 + i * 0.8;
        ctx.strokeStyle = i % 2 === 0 ? '#38bdf8' : '#c084fc';
        ctx.beginPath();
        ctx.moveTo(tx, 4);
        const cp1x = tx + Math.sin(wavePhase) * 12;
        const cp1y = 16;
        const cp2x = tx + Math.cos(wavePhase) * 12;
        const cp2y = 30;
        const endX = tx + Math.sin(wavePhase + 1) * 15;
        const endY = 40 + (Math.abs(i) % 2) * 8;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        ctx.stroke();
    }
};

// 4. Tipe Viper Piranha / Anglerfish
const drawViper = (ctx, en, now) => {
    const finFlutter = Math.sin(now * 0.025 + en.wiggle) * 5;
    const bodyR = en.size * 0.85;

    const bodyGrad = ctx.createRadialGradient(-4, -4, 3, 0, 0, bodyR * 1.2);
    bodyGrad.addColorStop(0, '#a855f7');
    bodyGrad.addColorStop(0.7, '#581c87');
    bodyGrad.addColorStop(1, '#020617');

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyR * 1.15, bodyR * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sharp Teeth
    ctx.fillStyle = '#ffffff';
    for (let t = 0; t < 4; t++) {
        const toothX = -bodyR * 1.1 + t * 6;
        ctx.beginPath();
        ctx.moveTo(toothX, -2);
        ctx.lineTo(toothX + 3, 5);
        ctx.lineTo(toothX + 6, -2);
        ctx.fill();
    }

    // Angler Lure (Esca)
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-bodyR * 0.4, -bodyR * 0.8);
    const lureTipX = -bodyR * 1.4;
    const lureTipY = -bodyR * 1.2 + Math.sin(now * 0.008) * 4;
    ctx.quadraticCurveTo(-bodyR * 0.8, -bodyR * 1.5, lureTipX, lureTipY);
    ctx.stroke();

    // Glowing Bulb
    ctx.beginPath();
    ctx.arc(lureTipX, lureTipY, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Glowing Eye
    ctx.beginPath();
    ctx.arc(-bodyR * 0.4, -bodyR * 0.25, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ec4899';
    ctx.shadowColor = '#ec4899';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-bodyR * 0.42, -bodyR * 0.25, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Tail Fin
    ctx.beginPath();
    const tailX = bodyR * 1.1 + finFlutter;
    ctx.moveTo(bodyR * 0.9, 0);
    ctx.lineTo(tailX + 12, -bodyR * 0.9);
    ctx.lineTo(tailX + 12, bodyR * 0.9);
    ctx.closePath();
    ctx.fillStyle = '#a855f7';
    ctx.fill();
    ctx.stroke();
};

// ============================================================================
// 🦑 RENDER APEX BOSS WAVE 5: KRAKEN REGULASI
// ============================================================================
const drawKrakenBoss = (ctx, boss, now) => {
    const pulse = Math.sin(now * 0.004) * 6;
    const bodyW = boss.size * 1.3 + pulse;
    const bodyH = boss.size * 1.5;

    // Tentakel Kolosal Berliuk
    const tentacleCount = 6;
    for (let i = 0; i < tentacleCount; i++) {
        const isUpper = i < 3;
        const tIndex = isUpper ? i : (i - 3);
        const sign = isUpper ? -1 : 1;
        const phase = now * 0.003 + i * 1.1;

        const startX = -bodyW * 0.2;
        const startY = sign * (25 + tIndex * 24);

        const cp1x = startX - 50 - Math.sin(phase) * 35;
        const cp1y = startY + sign * (40 + Math.cos(phase) * 30);
        const cp2x = startX - 120 - Math.cos(phase) * 45;
        const cp2y = startY + sign * (20 + Math.sin(phase) * 35);
        const endX = startX - 190 - Math.sin(phase + 1) * 30;
        const endY = startY + sign * (55 + Math.cos(phase + 1) * 40);

        // Tentacle Shadow / Outer Glow
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        ctx.strokeStyle = '#581c87';
        ctx.lineWidth = 18 - tIndex * 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 10 - tIndex * 1.5;
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Suction cups
        for (let s = 1; s <= 4; s++) {
            const ratio = s / 5;
            const sx = startX + (endX - startX) * ratio + Math.sin(phase + s) * 12;
            const sy = startY + (endY - startY) * ratio + Math.cos(phase + s) * 12;
            ctx.beginPath();
            ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = '#22d3ee';
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    // Kepala Gurita Raksasa (Mantle Dome)
    ctx.save();
    const domeGrad = ctx.createRadialGradient(-15, -15, 10, 0, 0, bodyW);
    domeGrad.addColorStop(0, '#7e22ce');
    domeGrad.addColorStop(0.5, '#581c87');
    domeGrad.addColorStop(0.9, '#3b0764');
    domeGrad.addColorStop(1, '#020617');

    ctx.beginPath();
    ctx.ellipse(0, 0, bodyW * 0.9, bodyH * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = domeGrad;
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Bio-rune Pattern Lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    for (let r = 0; r < 4; r++) {
        ctx.beginPath();
        const rx = -bodyW * 0.4 + r * 22;
        ctx.arc(rx, 0, 24 + r * 6, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();
    }

    // Mata Raksasa Predator Kraken
    [-bodyH * 0.28, bodyH * 0.28].forEach(ey => {
        // Outer socket
        ctx.beginPath();
        ctx.arc(-bodyW * 0.42, ey, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#1e1b4b';
        ctx.fill();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Glowing Iris
        ctx.beginPath();
        ctx.arc(-bodyW * 0.42, ey, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#f97316';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Slit Pupil
        ctx.beginPath();
        ctx.ellipse(-bodyW * 0.43, ey, 3, 9, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
    });

    // Hit Flash Overlay
    if (boss.hitFlash > 0) {
        ctx.beginPath();
        ctx.ellipse(0, 0, bodyW * 0.9, bodyH * 0.85, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${boss.hitFlash * 0.75})`;
        ctx.fill();
    }
    ctx.restore();
};

// ============================================================================
// 🦈 RENDER APEX BOSS WAVE 10: MEGALODON BIROKRASI
// ============================================================================
const drawMegalodonBoss = (ctx, boss, now) => {
    const tailWiggle = Math.sin(now * 0.006) * 14;
    const bodyLen = boss.size * 2.2;
    const bodyHeight = boss.size * 0.95;

    ctx.save();
    // Cyber-Plated Gold & Crimson Body Gradient
    const bodyGrad = ctx.createLinearGradient(0, -bodyHeight, 0, bodyHeight);
    bodyGrad.addColorStop(0, '#f59e0b');
    bodyGrad.addColorStop(0.3, '#b45309');
    bodyGrad.addColorStop(0.7, '#78350f');
    bodyGrad.addColorStop(1, '#e11d48');

    // Body Contour
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.65, 0);
    ctx.quadraticCurveTo(-bodyLen * 0.2, -bodyHeight * 1.1, bodyLen * 0.4, -bodyHeight * 0.45);
    ctx.lineTo(bodyLen * 0.85 + tailWiggle * 0.5, -bodyHeight * 0.25);
    ctx.lineTo(bodyLen * 0.85 + tailWiggle * 0.5, bodyHeight * 0.25);
    ctx.quadraticCurveTo(-bodyLen * 0.1, bodyHeight * 1.1, -bodyLen * 0.65, 0);
    ctx.closePath();
    ctx.fillStyle = bodyGrad;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Giant Armored Dorsal Fin
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.1, -bodyHeight * 0.9);
    ctx.lineTo(-bodyLen * 0.35, -bodyHeight * 1.9);
    ctx.quadraticCurveTo(-bodyLen * 0.05, -bodyHeight * 1.5, bodyLen * 0.2, -bodyHeight * 0.7);
    ctx.closePath();
    ctx.fillStyle = '#b45309';
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Massive Caudal Tail Fin
    const tailX = bodyLen * 0.85 + tailWiggle;
    ctx.beginPath();
    ctx.moveTo(bodyLen * 0.7, 0);
    ctx.lineTo(tailX + 32, -bodyHeight * 1.4);
    ctx.quadraticCurveTo(tailX + 12, 0, tailX + 32, bodyHeight * 1.4);
    ctx.closePath();
    ctx.fillStyle = '#ca8a04';
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pectoral Heavy Cyber Fin
    ctx.beginPath();
    ctx.moveTo(-bodyLen * 0.15, bodyHeight * 0.25);
    ctx.lineTo(-bodyLen * 0.45, bodyHeight * 1.25);
    ctx.lineTo(0, bodyHeight * 0.55);
    ctx.closePath();
    ctx.fillStyle = '#ca8a04';
    ctx.fill();
    ctx.stroke();

    // Glowing Gills Laser Reactor
    for (let g = 0; g < 4; g++) {
        ctx.beginPath();
        const gx = -bodyLen * 0.25 - g * 7;
        ctx.moveTo(gx, -bodyHeight * 0.35);
        ctx.lineTo(gx - 4, bodyHeight * 0.35);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Razor-Sharp Teeth Array
    ctx.fillStyle = '#ffffff';
    for (let t = 0; t < 6; t++) {
        const tx = -bodyLen * 0.6 + t * 9;
        ctx.beginPath();
        ctx.moveTo(tx, -4);
        ctx.lineTo(tx + 4, 8);
        ctx.lineTo(tx + 8, -4);
        ctx.fill();
    }

    // Apex Crimson Predator Eye
    ctx.beginPath();
    ctx.arc(-bodyLen * 0.48, -bodyHeight * 0.22, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-bodyLen * 0.50, -bodyHeight * 0.22, 3, 0, Math.PI * 2);
    ctx.fill();

    // Hit Flash Overlay
    if (boss.hitFlash > 0) {
        ctx.beginPath();
        ctx.moveTo(-bodyLen * 0.65, 0);
        ctx.quadraticCurveTo(-bodyLen * 0.2, -bodyHeight * 1.1, bodyLen * 0.4, -bodyHeight * 0.45);
        ctx.lineTo(bodyLen * 0.85 + tailWiggle * 0.5, -bodyHeight * 0.25);
        ctx.lineTo(bodyLen * 0.85 + tailWiggle * 0.5, bodyHeight * 0.25);
        ctx.quadraticCurveTo(-bodyLen * 0.1, bodyHeight * 1.1, -bodyLen * 0.65, 0);
        ctx.closePath();
        ctx.fillStyle = `rgba(255, 255, 255, ${boss.hitFlash * 0.75})`;
        ctx.fill();
    }
    ctx.restore();
};

// ============================================================================
// 🏷️ RENDER GOLDEN APEX WORD BADGE KHUSUS BOS
// ============================================================================
const drawBossWordBadge = (ctx, boss) => {
    const fullWord = boss.word;
    const typedPart = fullWord.substring(0, boss.typedIndex);
    const remainingPart = fullWord.substring(boss.typedIndex);

    ctx.font = '900 22px "Plus Jakarta Sans", system-ui, sans-serif';
    const totalWidth = ctx.measureText(fullWord).width;
    const badgePadding = 20;
    const badgeWidth = Math.max(totalWidth + badgePadding * 2, 220);
    const badgeHeight = 44;
    const badgeY = -boss.size - 55;

    ctx.save();

    // Tag Gelar Bos Emas
    const headerTag = `👑 TARGET APEX BOS: ${boss.name.toUpperCase()}`;
    ctx.font = '800 11px "Plus Jakarta Sans", system-ui, sans-serif';
    const tagW = ctx.measureText(headerTag).width + 18;
    ctx.fillStyle = 'rgba(234, 179, 8, 0.35)';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-tagW / 2, badgeY - 22, tagW, 18, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.fillText(headerTag, 0, badgeY - 8);
    ctx.textAlign = 'left';

    // Golden Box Outer Glow
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 24;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(-badgeWidth / 2, badgeY, badgeWidth, badgeHeight, 10);
    ctx.fill();
    ctx.stroke();

    // Triangle Pointer ke Bos
    ctx.beginPath();
    ctx.moveTo(-10, badgeY + badgeHeight);
    ctx.lineTo(10, badgeY + badgeHeight);
    ctx.lineTo(0, badgeY + badgeHeight + 10);
    ctx.closePath();
    ctx.fillStyle = '#facc15';
    ctx.fill();

    ctx.shadowBlur = 0;

    let cursorX = -badgeWidth / 2 + badgePadding;
    const textBaselineY = badgeY + 31;
    ctx.font = '900 22px "Plus Jakarta Sans", system-ui, sans-serif';

    // Bagian yang SUDAH diketik (Hijau Neon Emas)
    if (typedPart.length > 0) {
        ctx.fillStyle = '#34d399';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 14;
        ctx.fillText(typedPart, cursorX, textBaselineY);
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cursorX, textBaselineY + 4);
        ctx.lineTo(cursorX + ctx.measureText(typedPart).width, textBaselineY + 4);
        ctx.stroke();

        cursorX += ctx.measureText(typedPart).width;
    }

    // Bagian yang BELUM diketik (Emas Kuning Terang)
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 5;
    ctx.fillText(remainingPart, cursorX, textBaselineY);
    ctx.shadowBlur = 0;

    // Crosshair Target di atas Badge
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, badgeY - 12, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
};

// ============================================================================
// 📊 RENDER BOSS HEALTH BAR & STATUS PLATE DI ATAS CANVAS
// ============================================================================
const drawBossHUD = (ctx, boss, width) => {
    ctx.save();
    const hudW = 440;
    const hudH = 50;
    const hudX = (width - hudW) / 2;
    const hudY = 16;

    // Outer Plate Glassmorphism
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(234, 179, 8, 0.3)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Boss Name & Title
    ctx.font = '800 12px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#fde047';
    const bossLabel = `${boss.type === 'KRAKEN' ? '🦑' : '🦈'} APEX BOSS: ${boss.name.toUpperCase()} [${boss.title}]`;
    ctx.fillText(bossLabel, hudX + 16, hudY + 18);

    // HP Text on Right
    ctx.font = '700 11px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`PERISAI: ${boss.hp}/${boss.maxHp}`, hudX + hudW - 16, hudY + 18);
    ctx.textAlign = 'left';

    // Segmented Health Bar
    const barX = hudX + 16;
    const barY = hudY + 26;
    const barW = hudW - 32;
    const barH = 14;

    const gap = 4;
    const segW = (barW - (boss.maxHp - 1) * gap) / boss.maxHp;

    for (let s = 0; s < boss.maxHp; s++) {
        const sx = barX + s * (segW + gap);
        ctx.beginPath();
        ctx.roundRect(sx, barY, segW, barH, 3);
        if (s < boss.hp) {
            const grad = ctx.createLinearGradient(sx, barY, sx, barY + barH);
            grad.addColorStop(0, '#facc15');
            grad.addColorStop(0.5, '#f59e0b');
            grad.addColorStop(1, '#b45309');
            ctx.fillStyle = grad;
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            ctx.fillStyle = 'rgba(51, 65, 85, 0.6)';
            ctx.fill();
        }
    }
    ctx.restore();
};

// ============================================================================
// ⚠️ RENDER BANNER PERINGATAN KEDATANGAN BOS APEX
// ============================================================================
// ⚠️ RENDER BANNER PERINGATAN KEDATANGAN BOS APEX
// ============================================================================
const drawBossWarningBanner = (ctx, boss, width, height, now) => {
    if (!boss) return;
    ctx.save();
    const flash = Math.sin((now || performance.now()) * 0.015) > 0;
    const bannerH = 90;
    const bannerY = (height - bannerH) / 2;

    const bossName = typeof boss === 'string'
        ? boss
        : (boss.name ? String(boss.name) : 'BOS LAUT DALAM');

    // Red/Gold Strobe Background
    ctx.fillStyle = flash ? 'rgba(185, 28, 28, 0.88)' : 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = flash ? '#facc15' : '#ef4444';
    ctx.lineWidth = 3;
    ctx.shadowColor = flash ? '#facc15' : '#ef4444';
    ctx.shadowBlur = 30;
    ctx.fillRect(0, bannerY, width, bannerH);
    ctx.strokeRect(0, bannerY, width, bannerH);
    ctx.shadowBlur = 0;

    // Hazard Stripes Top & Bottom
    ctx.fillStyle = flash ? '#facc15' : '#ef4444';
    ctx.fillRect(0, bannerY, width, 5);
    ctx.fillRect(0, bannerY + bannerH - 5, width, 5);

    // Alert Typography
    ctx.font = '900 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ PERINGATAN KEDALAMAN LAUT EKSTRIM! ⚠️', width / 2, bannerY + 38);

    ctx.font = '800 16px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`APEX PREDATOR MENDEKAT: ${bossName.toUpperCase()}!`, width / 2, bannerY + 68);
    ctx.textAlign = 'left';

    ctx.restore();
};

// ============================================================================
// 🏷️ RENDER WORD BADGE YANG BESAR, JELAS, & MUDAH DIBACA
// ============================================================================
const drawWordBadge = (ctx, en) => {
    const fullWord = en.word;
    const typedPart = fullWord.substring(0, en.typedIndex);
    const remainingPart = fullWord.substring(en.typedIndex);
    const hasPowerup = !!en.powerup;

    // Font Modern Bold Sans-Serif: Ikan pembawa bonus diberi font jauh lebih besar & tebal (22px) agar sangat mudah dibaca
    const fontSize = hasPowerup ? 22 : 19;
    ctx.font = `${hasPowerup ? '900' : '800'} ${fontSize}px "Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const totalWidth = ctx.measureText(fullWord).width;

    const badgePadding = hasPowerup ? 18 : 14;
    const badgeWidth = totalWidth + badgePadding * 2;
    const badgeHeight = hasPowerup ? 42 : 34;
    const badgeY = -en.size - (hasPowerup ? 46 : 34);

    ctx.save();

    // 🌟 Render Tag Power-up Besar & Berkontras Tinggi di atas Badge Kata
    if (hasPowerup) {
        let tagText = '💣 EMP BOM';
        let tagColor = '#fef08a';
        let tagBg = 'rgba(15, 23, 42, 0.96)';
        let tagBorder = '#f59e0b';
        let tagGlow = 'rgba(245, 158, 11, 0.75)';

        if (en.powerup === 'SLOW') {
            tagText = '❄️ ARUS TENANG';
            tagColor = '#bae6fd';
            tagBg = 'rgba(15, 23, 42, 0.96)';
            tagBorder = '#0ea5e9';
            tagGlow = 'rgba(56, 189, 248, 0.75)';
        } else if (en.powerup === 'HEAL') {
            tagText = '💚 +1 NYAWA';
            tagColor = '#bbf7d0';
            tagBg = 'rgba(15, 23, 42, 0.96)';
            tagBorder = '#10b981';
            tagGlow = 'rgba(52, 211, 153, 0.75)';
        }

        // Font Tag Power-up diperbesar drastis (dari 10px menjadi 13.5px bold)
        ctx.font = '900 13.5px "Plus Jakarta Sans", system-ui, sans-serif';
        const tagTextW = ctx.measureText(tagText).width;
        const tagW = tagTextW + 22;
        const tagH = 25;
        const tagY = badgeY - 29;

        ctx.shadowColor = tagGlow;
        ctx.shadowBlur = 14;
        ctx.fillStyle = tagBg;
        ctx.strokeStyle = tagBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-tagW / 2, tagY, tagW, tagH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = tagColor;
        ctx.textAlign = 'center';
        ctx.fillText(tagText, 0, tagY + 18);
        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;

        // Kembalikan font untuk teks kata
        ctx.font = `${hasPowerup ? '900' : '800'} ${fontSize}px "Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    }

    // Shadow & Contrast Pill Box
    let strokeColor = en.isTargeted ? '#38bdf8' : 'rgba(148, 163, 184, 0.45)';
    if (en.powerup === 'BOMB') strokeColor = en.isTargeted ? '#fef08a' : '#f59e0b';
    else if (en.powerup === 'SLOW') strokeColor = en.isTargeted ? '#a5f3fc' : '#0ea5e9';
    else if (en.powerup === 'HEAL') strokeColor = en.isTargeted ? '#86efac' : '#10b981';

    ctx.shadowColor = en.isTargeted ? strokeColor : (hasPowerup ? strokeColor : 'rgba(0, 0, 0, 0.8)');
    ctx.shadowBlur = en.isTargeted ? 18 : (hasPowerup ? 14 : 8);
    ctx.fillStyle = en.isTargeted
        ? 'rgba(6, 12, 26, 0.98)'
        : (hasPowerup ? 'rgba(8, 16, 34, 0.96)' : 'rgba(15, 23, 42, 0.92)');
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = en.isTargeted ? 3 : (hasPowerup ? 2.5 : 1.5);

    // Rounded Box
    ctx.beginPath();
    ctx.roundRect(-badgeWidth / 2, badgeY, badgeWidth, badgeHeight, hasPowerup ? 10 : 8);
    ctx.fill();
    ctx.stroke();

    // Pointer Triangle Menunjuk ke Karakter Musuh
    ctx.beginPath();
    ctx.moveTo(-8, badgeY + badgeHeight);
    ctx.lineTo(8, badgeY + badgeHeight);
    ctx.lineTo(0, badgeY + badgeHeight + 8);
    ctx.closePath();
    ctx.fillStyle = strokeColor;
    ctx.fill();

    ctx.shadowBlur = 0;

    let cursorX = -badgeWidth / 2 + badgePadding;
    const textBaselineY = badgeY + (hasPowerup ? 29 : 24);

    // Bagian yang SUDAH diketik (Hijau Emerald Neon Bercahaya)
    if (typedPart.length > 0) {
        ctx.fillStyle = '#34d399';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 12;
        ctx.fillText(typedPart, cursorX, textBaselineY);
        ctx.shadowBlur = 0;

        // Garis bawah hijau penanda progres
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cursorX, textBaselineY + 4);
        ctx.lineTo(cursorX + ctx.measureText(typedPart).width, textBaselineY + 4);
        ctx.stroke();

        cursorX += ctx.measureText(typedPart).width;
    }

    // Bagian yang BELUM diketik (Warna Terang Bersinar & Kontras Tinggi)
    let remainingColor = '#ffffff';
    if (hasPowerup) {
        if (en.powerup === 'BOMB') remainingColor = '#fef08a'; // Kuning emas terang
        else if (en.powerup === 'SLOW') remainingColor = '#e0f2fe'; // Cyan es terang
        else if (en.powerup === 'HEAL') remainingColor = '#ecfdf5'; // Mint hijau terang
    } else {
        remainingColor = en.isTargeted ? '#ffffff' : '#f8fafc';
    }

    ctx.fillStyle = remainingColor;
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 6;
    ctx.fillText(remainingPart, cursorX, textBaselineY);
    ctx.shadowBlur = 0;

    // Crosshair Target Reticle di atas badge jika sedang dikunci
    if (en.isTargeted) {
        const reticleY = hasPowerup ? (badgeY - 34) : (badgeY - 8);
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, reticleY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, reticleY, 10, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
};

// ============================================================================
// 🎮 HELPER SPAWN MUSUH & PENYEIMBANG KEPADATAN LAYAR (FAIR PLAY BALANCING)
// ============================================================================
const getMaxEnemiesForWave = (wave) => {
    if (wave <= 2) return 2; // Wave 1-2: Maksimal 2 musuh di layar
    if (wave <= 5) return 3; // Wave 3-5: Maksimal 3 musuh di layar
    return 4;                // Wave 6+: Dibatasi maksimal 4 musuh di layar agar tidak pernah menumpuk
};

const spawnEnemy = (width, height, currentWave, initialX = null, existingEnemies = [], currentLives = 3) => {
    const word = getRandomWord(currentWave, existingEnemies);
    let type = 'JELLY';
    // Kecepatan gerak musuh yang manusiawi dan proporsional (memberi waktu reaksi 7-12 detik per kata)
    let speed = 0.65 + (currentWave - 1) * 0.08 + (Math.random() * 0.15);
    let color = '#38bdf8';
    let size = 26;

    if (word.length >= 8) {
        type = 'HAMMERHEAD';
        speed = 0.55 + (currentWave - 1) * 0.07;
        color = '#f43f5e';
        size = 38;
    } else if (word.length >= 5) {
        type = 'SHARK';
        speed = 0.75 + (currentWave - 1) * 0.09;
        color = '#fbbf24';
        size = 32;
    } else if (currentWave >= 3 && Math.random() < 0.28) {
        type = 'VIPER';
        speed = 1.05 + (currentWave - 1) * 0.11;
        color = '#a855f7';
        size = 24;
    }

    // 🌟 Adaptive Pity Power-up System: Bantuan saat situasi kritis / musuh menumpuk
    let powerup = null;
    const pRoll = Math.random();
    const activeCount = existingEnemies ? existingEnemies.length : 0;
    const isCrisis = activeCount >= 3 || currentLives <= 1;
    const powerupChance = isCrisis ? 0.48 : (currentWave >= 4 ? 0.32 : 0.22);

    if (pRoll < powerupChance) {
        if (currentLives <= 1 && Math.random() < 0.55) {
            powerup = 'HEAL'; // Bantuan pemulihan nyawa darurat saat sekarat
        } else if (activeCount >= 3 && Math.random() < 0.55) {
            powerup = 'BOMB'; // Bantuan bom pembersih darurat saat musuh banyak
        } else {
            const subRoll = Math.random();
            if (subRoll < 0.38) powerup = 'BOMB';
            else if (subRoll < 0.72) powerup = 'SLOW';
            else powerup = 'HEAL';
        }
    }

    const marginY = 70;
    const safeHeight = Math.max(height - marginY * 2, 90);
    const y = marginY + Math.random() * safeHeight;
    const x = initialX !== null ? initialX : (width + 40);

    return {
        id: Math.random().toString(36).substr(2, 9),
        type,
        word,
        typedIndex: 0,
        x,
        y,
        baseY: y,
        speed,
        color,
        size,
        wiggle: Math.random() * Math.PI * 2,
        isTargeted: false,
        powerup // 'BOMB' | 'SLOW' | 'HEAL' | null
    };
};

const initBubbles = (width, height) => {
    const bubbles = [];
    const count = Math.floor(width / 35);
    for (let i = 0; i < count; i++) {
        bubbles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 4 + 2,
            speed: Math.random() * 0.8 + 0.4,
            wobble: Math.random() * Math.PI * 2,
            opacity: Math.random() * 0.4 + 0.15
        });
    }
    return bubbles;
};

// ============================================================================
// 🎮 KOMPONEN UTAMA MANTATYPE GAME
// ============================================================================
const MantaTypeGame = ({ isOpen, onClose, onSwitchToChat }) => {
    const currentUser = UserData();

    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const animationFrameRef = useRef(null);
    const mantaImgRef = useRef(null);
    const mantaHappyImgRef = useRef(null);

    const [gameState, setGameState] = useState('MENU');
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [wave, setWave] = useState(1);
    const [depth, setDepth] = useState(50);
    const [wordsTyped, setWordsTyped] = useState(0);
    const [correctKeystrokes, setCorrectKeystrokes] = useState(0);
    const [totalKeystrokes, setTotalKeystrokes] = useState(0);
    const [combo, setCombo] = useState(0);
    const [maxCombo, setMaxCombo] = useState(0);
    const [isMuted, setIsMuted] = useState(() => audio.isMuted);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [leaderboard, setLeaderboard] = useState([]);
    const [seasonalLeaderboard, setSeasonalLeaderboard] = useState([]);
    const [lifetimeLeaderboard, setLifetimeLeaderboard] = useState([]);
    const [rankedViewType, setRankedViewType] = useState('seasonal'); // 'seasonal' | 'lifetime'
    const [seasonInfo, setSeasonInfo] = useState(null);
    const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
    const [guestPlayerName, setGuestPlayerName] = useState('');
    const [isSubmittingScore, setIsSubmittingScore] = useState(false);
    const [scoreSubmitted, setScoreSubmitted] = useState(false);
    const [playerRankInfo, setPlayerRankInfo] = useState(null);

    // 🔒 Jadwal Jam Kerja & Glosarium Edukatif
    const [lockInfo, setLockInfo] = useState({ is_accessible: true, message: '', schedule: null });
    const [lastLearnedWord, setLastLearnedWord] = useState(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(false);

    // 🏎️ Realtime WPM Speedometer, Power-up & Audio Controls
    const [liveWpm, setLiveWpm] = useState(0);
    const [slowMoRemaining, setSlowMoRemaining] = useState(0);
    const [showAudioPopover, setShowAudioPopover] = useState(false);
    const [bgmVolume, setBgmVolume] = useState(() => audio.bgmVolume);
    const [sfxVolume, setSfxVolume] = useState(() => audio.sfxVolume);

    // ⏱️ Countdown & Audio Popover Click-Outside Refs
    const [countdown, setCountdown] = useState(null); // null | 3 | 2 | 1 | 'MENYELAM!'
    const countdownRef = useRef(null);
    const countdownTimerRef = useRef(null);
    const audioWrapperRef = useRef(null);

    const gameLoopRef = useRef({
        manta: {
            x: 90,
            y: 260,
            targetY: 260,
            width: 90,
            height: 70,
            glow: 0,
            isHappy: false
        },
        enemies: [],
        particles: [],
        torpedoes: [],
        bubbles: [],
        targetEnemy: null,
        boss: null,
        bossPendingWave: null,
        bossWarningTimer: 0,
        invincibleTimer: 0,
        lastSpawnTime: 0,
        spawnInterval: 3200,
        startTime: 0,
        screenShake: 0,
        slowMoTimer: 0,
        shockwave: null,
        floatingTexts: [],
        recentKeystrokes: [],
        lastWpmUpdate: 0,
        waveNotice: null,
        stats: {
            score: 0,
            lives: 3,
            wave: 1,
            depth: 50,
            wordsTyped: 0,
            correctKeys: 0,
            totalKeys: 0,
            combo: 0,
            maxCombo: 0
        }
    });

    // 🔒 1. Kunci Scroll Halaman Latar Belakang & Tangkap Fokus Input
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        const originalOverscroll = document.body.style.overscrollBehavior;
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';

        if (containerRef.current) {
            containerRef.current.focus();
        }

        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.overscrollBehavior = originalOverscroll;
        };
    }, [isOpen]);

    // Muat Konfigurasi Dinamis & Aturan Jam Kerja
    const fetchGameConfig = async () => {
        setIsLoadingConfig(true);
        try {
            const res = await apiInstance.get('manta-game/config/');
            if (res.data?.status === 'success') {
                updateActiveWordBank(res.data.words, res.data.word_meanings);
                const isAccessible = Boolean(res.data.is_accessible && res.data.is_enabled);
                setLockInfo({
                    is_accessible: isAccessible,
                    message: res.data.access_message,
                    schedule: res.data.schedule_info
                });
                if (!isAccessible) {
                    setGameState('LOCKED');
                } else {
                    setGameState(prev => prev === 'LOCKED' ? 'MENU' : prev);
                }
            }
        } catch (err) {
            console.warn('Gagal memuat konfigurasi MantaType, menggunakan fallback statis:', err);
        } finally {
            setIsLoadingConfig(false);
        }
    };

    // Muat Sprite Awal
    useEffect(() => {
        const imgIdle = new Image();
        imgIdle.src = mantaIdleWebp;
        mantaImgRef.current = imgIdle;

        const imgHappy = new Image();
        imgHappy.src = mantaHappyWebp;
        mantaHappyImgRef.current = imgHappy;
    }, []);

    // Inisialisasi saat Modal Terbuka
    useEffect(() => {
        if (isOpen) {
            setIsMuted(audio.isMuted);
            setBgmVolume(audio.bgmVolume);
            setSfxVolume(audio.sfxVolume);
            fetchGameConfig();
            fetchLeaderboard();
        } else {
            audio.stopBGM();
            if (countdownTimerRef.current) {
                clearTimeout(countdownTimerRef.current);
            }
            setCountdown(null);
            countdownRef.current = null;
        }
    }, [isOpen]);

    // Tutup popover audio jika klik di luar
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showAudioPopover && audioWrapperRef.current && !audioWrapperRef.current.contains(e.target)) {
                setShowAudioPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAudioPopover]);

    const handleToggleMute = () => {
        const nextMute = !isMuted;
        setIsMuted(nextMute);
        audio.setMuted(nextMute);
        if (nextMute) {
            audio.stopBGM();
        } else {
            audio.startBGM();
            audio.playKeyHit(2);
        }
    };

    const fetchLeaderboard = async () => {
        setIsLoadingLeaderboard(true);
        try {
            const res = await apiInstance.get('manta-game/leaderboard/');
            if (res.data) {
                const seasonal = res.data.seasonal_leaderboard || res.data.leaderboard || [];
                const lifetime = res.data.lifetime_leaderboard || res.data.leaderboard || [];
                setSeasonalLeaderboard(seasonal);
                setLifetimeLeaderboard(lifetime);
                setLeaderboard(seasonal);
                if (res.data.season_info) {
                    setSeasonInfo(res.data.season_info);
                }
                try {
                    localStorage.setItem('mantatype_local_seasonal_leaderboard', JSON.stringify(seasonal));
                    localStorage.setItem('mantatype_local_lifetime_leaderboard', JSON.stringify(lifetime));
                } catch (_) { }
            }
        } catch (err) {
            console.warn('Leaderboard fallback ke localStorage:', err);
            try {
                const localSeasonal = localStorage.getItem('mantatype_local_seasonal_leaderboard') || localStorage.getItem('mantatype_local_leaderboard');
                const localLifetime = localStorage.getItem('mantatype_local_lifetime_leaderboard');
                if (localSeasonal) {
                    const parsed = JSON.parse(localSeasonal);
                    setSeasonalLeaderboard(parsed);
                    setLeaderboard(parsed);
                }
                if (localLifetime) {
                    setLifetimeLeaderboard(JSON.parse(localLifetime));
                }
            } catch (_) { }
        } finally {
            setIsLoadingLeaderboard(false);
        }
    };

    const handleAutoSubmitScore = useCallback(async () => {
        if (scoreSubmitted || isSubmittingScore) return;

        const g = gameLoopRef.current?.stats;
        if (!g || (g.score || 0) <= 0) return;

        const startTime = gameLoopRef.current?.startTime || performance.now();
        const accuracy = g.totalKeys > 0 ? ((g.correctKeys / g.totalKeys) * 100) : 100;
        const durationMin = Math.max((performance.now() - startTime) / 60000, 0.2);
        const wpm = Math.round(g.wordsTyped / durationMin);

        const storedGuest = typeof window !== 'undefined' ? localStorage.getItem('mantatype_guest_name') : '';
        const playerName = currentUser?.full_name || currentUser?.username || guestPlayerName || storedGuest || 'Pelaut Manta';

        setIsSubmittingScore(true);
        try {
            const payload = {
                score: g.score,
                words_typed: g.wordsTyped,
                accuracy: parseFloat(accuracy.toFixed(2)),
                wpm: wpm,
                wave_reached: g.wave,
                user_id: currentUser?.user_id || currentUser?.id,
                player_name: playerName
            };

            const res = await apiInstance.post('manta-game/leaderboard/', payload);
            if (res.data) {
                const seasonal = res.data.seasonal_leaderboard || res.data.leaderboard || [];
                const lifetime = res.data.lifetime_leaderboard || [];
                setSeasonalLeaderboard(seasonal);
                setLifetimeLeaderboard(lifetime);
                setLeaderboard(seasonal);
                if (res.data.season_info) {
                    setSeasonInfo(res.data.season_info);
                }
                setPlayerRankInfo({
                    rank: res.data.current_rank || res.data.player_seasonal_rank,
                    seasonalRank: res.data.player_seasonal_rank,
                    lifetimeRank: res.data.player_lifetime_rank,
                    isTop10: res.data.is_top_10,
                    isSeasonalTop10: res.data.is_seasonal_top_10,
                    isLifetimeTop10: res.data.is_lifetime_top_10
                });
            }
            setScoreSubmitted(true);
        } catch (err) {
            console.warn('Fallback offline leaderboard submission:', err);
            const fallbackEntry = {
                id: Date.now(),
                rank: 1,
                player_name: playerName,
                score: g.score,
                words_typed: g.wordsTyped,
                accuracy: parseFloat(accuracy.toFixed(2)),
                wpm: wpm,
                wave_reached: g.wave,
                is_guest: !currentUser,
                season_number: 1,
                season_label: 'Musim Aktif',
                created_at: 'Baru saja',
                is_current_player: true
            };
            const updated = [fallbackEntry, ...leaderboard]
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((item, idx) => ({ ...item, rank: idx + 1 }));
            setSeasonalLeaderboard(updated);
            setLifetimeLeaderboard(updated);
            setLeaderboard(updated);
            setScoreSubmitted(true);
            setPlayerRankInfo({
                rank: 1,
                seasonalRank: 1,
                lifetimeRank: 1,
                isTop10: true,
                isSeasonalTop10: true,
                isLifetimeTop10: true
            });
        } finally {
            setIsSubmittingScore(false);
        }
    }, [currentUser, guestPlayerName, isSubmittingScore, scoreSubmitted, leaderboard]);

    // ⚡ Auto-submit skor ke Ranked seketika saat permainan berakhir
    useEffect(() => {
        if (gameState === 'GAMEOVER') {
            handleAutoSubmitScore();
        }
    }, [gameState, handleAutoSubmitScore]);

    const handleToggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(() => { });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen().catch(() => { });
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const onFsChange = () => {
            const fsActive = !!document.fullscreenElement;
            setIsFullscreen(fsActive);

            // Re-sync canvas resolusi tepat saat mode fullscreen berganti
            [40, 120, 260].forEach((delay) => {
                setTimeout(() => {
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const rect = canvas.getBoundingClientRect();
                    const dpr = window.devicePixelRatio || 1;
                    canvas.width = Math.floor(rect.width * dpr);
                    canvas.height = Math.floor(rect.height * dpr);
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.scale(dpr, dpr);
                    }
                }, delay);
            });
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    const startCountdown = useCallback((onComplete) => {
        if (countdownTimerRef.current) {
            clearTimeout(countdownTimerRef.current);
        }
        audio.init();
        audio.playCountdown(false);
        setCountdown(3);
        countdownRef.current = 3;

        countdownTimerRef.current = setTimeout(() => {
            audio.playCountdown(false);
            setCountdown(2);
            countdownRef.current = 2;

            countdownTimerRef.current = setTimeout(() => {
                audio.playCountdown(false);
                setCountdown(1);
                countdownRef.current = 1;

                countdownTimerRef.current = setTimeout(() => {
                    audio.playCountdown(true);
                    setCountdown('MENYELAM!');
                    countdownRef.current = 'MENYELAM!';

                    countdownTimerRef.current = setTimeout(() => {
                        setCountdown(null);
                        countdownRef.current = null;
                        if (gameLoopRef.current) {
                            gameLoopRef.current.lastSpawnTime = performance.now();
                            gameLoopRef.current.lastWpmUpdate = performance.now();
                        }
                        if (onComplete) onComplete();
                    }, 450);
                }, 800);
            }, 800);
        }, 800);
    }, []);

    const handlePauseGame = useCallback(() => {
        if (countdownTimerRef.current) {
            clearTimeout(countdownTimerRef.current);
        }
        setCountdown(null);
        countdownRef.current = null;
        audio.stopBGM();
        setGameState('PAUSED');
    }, []);

    const handleResumeGame = useCallback(() => {
        setGameState('PLAYING');
        startCountdown(() => {
            audio.startBGM();
        });
    }, [startCountdown]);

    const startGame = () => {
        if (!lockInfo.is_accessible) {
            setGameState('LOCKED');
            return;
        }

        audio.init();
        audio.stopBGM();

        const canvas = canvasRef.current;
        const rect = canvas ? canvas.getBoundingClientRect() : { width: 900, height: 540 };
        const width = rect.width || 900;
        const height = rect.height || 540;

        const now = performance.now();

        // Spawn 2 musuh awal secara instan di sisi kanan agar langsung aksi!
        const initialEnemy1 = spawnEnemy(width, height, 1, width * 0.72);
        const initialEnemy2 = spawnEnemy(width, height, 1, width * 0.94, [initialEnemy1]);
        const initialEnemies = [initialEnemy1, initialEnemy2];

        gameLoopRef.current = {
            manta: {
                x: 90,
                y: height / 2,
                targetY: height / 2,
                width: 90,
                height: 70,
                glow: 0,
                isHappy: false
            },
            enemies: initialEnemies,
            particles: [],
            torpedoes: [],
            bubbles: initBubbles(width, height),
            targetEnemy: null,
            boss: null,
            bossPendingWave: null,
            bossWarningTimer: 0,
            invincibleTimer: 0,
            lastSpawnTime: now,
            spawnInterval: 3200,
            startTime: now,
            screenShake: 0,
            slowMoTimer: 0,
            shockwave: null,
            floatingTexts: [],
            recentKeystrokes: [],
            lastWpmUpdate: now,
            waveNotice: { text: '🌊 WAVE 1: KEDALAMAN 50M', timer: 120 },
            stats: {
                score: 0,
                lives: 3,
                wave: 1,
                depth: 50,
                wordsTyped: 0,
                correctKeys: 0,
                totalKeys: 0,
                combo: 0,
                maxCombo: 0
            }
        };

        setScore(0);
        setLives(3);
        setWave(1);
        setDepth(50);
        setWordsTyped(0);
        setCorrectKeystrokes(0);
        setTotalKeystrokes(0);
        setCombo(0);
        setMaxCombo(0);
        setLiveWpm(0);
        setSlowMoRemaining(0);
        setScoreSubmitted(false);
        setPlayerRankInfo(null);
        setGameState('PLAYING');
        startCountdown(() => {
            audio.startBGM();
        });
    };



    const fireSonarProjectile = (g, target) => {
        g.manta.targetY = target.y;
        g.manta.glow = 1.0;
        g.torpedoes.push({
            x: g.manta.x + 40,
            y: g.manta.y,
            targetX: target.x,
            targetY: target.y,
            progress: 0,
            speed: 0.22,
            color: '#38bdf8'
        });
    };

    // 👑 INISIASI PERTARUNGAN BOS APEX (WAVE 5: KRAKEN & WAVE 10: MEGALODON)
    const startBossBattle = (g, waveNum, width, height) => {
        g.targetEnemy = null;

        audio.playBossAlarm();
        g.screenShake = 1.8;
        g.bossWarningTimer = 3.2;

        const isKraken = waveNum === 5;
        const bossWords = isKraken
            ? ['INTEGRITAS', 'PARLEMEN', 'AKUNTABEL', 'REFORMASI']
            : ['TRANSPARANSI', 'PROFESIONAL', 'KOLABORATIF', 'KEBIJAKAN', 'LEGISLASI', 'KELEMBAGAAN'];

        g.boss = {
            isBoss: true,
            wave: waveNum,
            type: isKraken ? 'KRAKEN' : 'MEGALODON',
            name: isKraken ? 'Kraken Regulasi' : 'Megalodon Birokrasi',
            title: isKraken ? 'Penjaga Palung Regulasi' : 'Apex Sovereign Birokrasi',
            words: bossWords,
            currentWordIndex: 0,
            word: bossWords[0],
            typedIndex: 0,
            hp: bossWords.length,
            maxHp: bossWords.length,
            bonusScore: isKraken ? 1000 : 2500,
            x: width + 140,
            targetX: width * 0.74,
            y: height / 2,
            baseY: height / 2,
            speed: 0.16,
            size: isKraken ? 75 : 90,
            wiggle: 0,
            isTargeted: false, // Target aktif setelah intro peringatan selesai
            hitFlash: 0,
            shake: 0
        };
    };

    const defeatEnemy = (g, target) => {
        audio.playWordExplode();
        g.manta.isHappy = true;
        setTimeout(() => { if (g.manta) g.manta.isHappy = false; }, 600);

        // 👑 APEX BOSS HIT & DEFEAT LOGIC
        if (target.isBoss) {
            target.hp--;
            target.hitFlash = 1.0;
            target.shake = 12;
            audio.playBossHit();

            for (let i = 0; i < 20; i++) {
                const angle = Math.random() * Math.PI * 2;
                const spd = Math.random() * 5 + 2;
                g.particles.push({
                    x: target.x - 20,
                    y: target.y,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd,
                    radius: Math.random() * 4 + 2,
                    color: target.type === 'KRAKEN' ? '#c084fc' : '#fbbf24',
                    alpha: 1.0,
                    decay: 0.03
                });
            }

            g.stats.score += 250;
            g.stats.wordsTyped++;
            setScore(g.stats.score);
            setWordsTyped(g.stats.wordsTyped);

            if (target.hp > 0) {
                target.currentWordIndex++;
                target.word = target.words[target.currentWordIndex];
                target.typedIndex = 0;
                target.isTargeted = true;
                g.targetEnemy = target;

                g.floatingTexts.push({
                    text: `💥 HIT! PERISAI BOS: ${target.hp}/${target.maxHp}`,
                    x: target.x - 30,
                    y: target.y - 70,
                    color: '#f59e0b',
                    life: 60,
                    vy: -1.2,
                    scale: 1.2
                });
                return;
            } else {
                audio.playBossDefeated();
                g.screenShake = 2.4;
                g.stats.score += target.bonusScore;
                setScore(g.stats.score);

                if (g.stats.lives < 3) {
                    g.stats.lives++;
                    setLives(g.stats.lives);
                }

                for (let i = 0; i < 50; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const spd = Math.random() * 7 + 2;
                    g.particles.push({
                        x: target.x,
                        y: target.y,
                        vx: Math.cos(angle) * spd,
                        vy: Math.sin(angle) * spd,
                        radius: Math.random() * 6 + 3,
                        color: ['#facc15', '#f59e0b', '#ec4899', '#38bdf8', '#34d399', '#ffffff'][i % 6],
                        alpha: 1.0,
                        decay: Math.random() * 0.02 + 0.015
                    });
                }

                g.floatingTexts.push({
                    text: `🏆 ${target.name.toUpperCase()} DITAKLUKKAN! +${target.bonusScore.toLocaleString('id-ID')} POIN!`,
                    x: target.x - 60,
                    y: target.y - 80,
                    color: '#facc15',
                    life: 120,
                    vy: -0.8,
                    scale: 1.5
                });

                g.boss = null;
                g.targetEnemy = null;

                g.stats.wave++;
                g.stats.depth += 50;
                setWave(g.stats.wave);
                setDepth(g.stats.depth);
                g.waveNotice = {
                    text: `🌊 WAVE ${g.stats.wave}: KEDALAMAN ${g.stats.depth}M! SELAMAT!`,
                    timer: 120
                };
                g.lastSpawnTime = performance.now();
                return;
            }
        }

        for (let i = 0; i < 22; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * 4 + 1.5;
            g.particles.push({
                x: target.x,
                y: target.y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                radius: Math.random() * 5 + 2,
                color: ['#38bdf8', '#34d399', '#fef08a', '#ec4899', '#a78bfa'][i % 5],
                alpha: 1.0,
                decay: Math.random() * 0.03 + 0.02
            });
        }

        const wordBase = target.word.length * 15;
        const comboBonus = Math.min(g.stats.combo * 5, 100);
        const waveMultiplier = 1 + (g.stats.wave - 1) * 0.2;
        const earned = Math.round((wordBase + comboBonus) * waveMultiplier);

        g.stats.score += earned;
        g.stats.wordsTyped++;
        g.stats.depth += 15;

        if (g.stats.wordsTyped % 8 === 0) {
            g.stats.wave++;
            // Interval spawn yang seimbang (tidak pernah kurang dari 1900ms agar pemain tidak kewalahan)
            g.spawnInterval = Math.max(1900, 3200 - (g.stats.wave - 1) * 160);

            // 💚 Wave Mastery Recovery: Beri +1 nyawa gratis saat menembus Wave 3 & Wave 7 jika nyawa berkurang
            if ((g.stats.wave === 3 || g.stats.wave === 7) && g.stats.lives < 3) {
                g.stats.lives++;
                setLives(g.stats.lives);
                audio.playHeal();
            }

            // 👑 PERSIAPAN PERTARUNGAN BOS EPISODIK (WAVE 5 & WAVE 10)
            if (g.stats.wave === 5 || g.stats.wave === 10) {
                // Periksa apakah masih ada musuh lain di layar.
                // Jika masih ada, JANGAN langsung hapus musuh!
                // Biarkan user menyelesaikan ketikan musuh yang sedang dihadapi secara mulus.
                if (g.enemies.length > 1) { // > 1 karena musuh saat ini (target) belum di-filter keluar
                    g.bossPendingWave = g.stats.wave;
                    g.waveNotice = {
                        text: `⚠️ SIRENE DARURAT: APEX PREDATOR MENDEKAT! SELESAIKAN MUSUH!`,
                        timer: 140
                    };
                } else {
                    const canvas = canvasRef.current;
                    const rect = canvas ? canvas.getBoundingClientRect() : { width: 900, height: 540 };
                    startBossBattle(g, g.stats.wave, rect.width || 900, rect.height || 540);
                }
            } else {
                g.waveNotice = {
                    text: `🌊 WAVE ${g.stats.wave}: KEDALAMAN ${g.stats.depth}M!`,
                    timer: 100
                };
            }
        }

        setScore(g.stats.score);
        setWordsTyped(g.stats.wordsTyped);
        setWave(g.stats.wave);
        setDepth(g.stats.depth);

        // 💡 Glosarium Edukatif ASN
        const meaning = DYNAMIC_WORD_MEANINGS[target.word];
        if (meaning) {
            setLastLearnedWord({ word: target.word, meaning });
        }

        // 🌟 EKSEKUSI POWER-UP ITEM
        if (target.powerup === 'BOMB') {
            audio.playEmpBomb();
            g.screenShake = 1.3;
            g.shockwave = { x: target.x, y: target.y, radius: 10, maxRadius: 850, alpha: 1.0 };
            g.waveNotice = { text: '💥 EMP BIO-SONAR BLAST: SAPU BERSIH MUSUH!', timer: 80 };

            // Musuh lain yang ada di layar dihancurkan dan beri bonus skor
            const otherEnemies = g.enemies.filter(en => en.id !== target.id);
            otherEnemies.forEach(other => {
                for (let i = 0; i < 14; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const spd = Math.random() * 4 + 1.5;
                    g.particles.push({
                        x: other.x,
                        y: other.y,
                        vx: Math.cos(angle) * spd,
                        vy: Math.sin(angle) * spd,
                        radius: Math.random() * 4 + 2,
                        color: '#f59e0b',
                        alpha: 1.0,
                        decay: 0.03
                    });
                }
            });
            const bonus = otherEnemies.length * 60;
            g.stats.score += bonus;
            g.stats.wordsTyped += otherEnemies.length;
            setScore(g.stats.score);
            setWordsTyped(g.stats.wordsTyped);
            g.enemies = [];
            g.targetEnemy = null;
        } else if (target.powerup === 'SLOW') {
            audio.playSlowMo();
            g.slowMoTimer = 8.0;
            setSlowMoRemaining(8);
            g.waveNotice = { text: '❄️ ARUS TENANG: KECEPATAN MUSUH MELAMBAT 50%!', timer: 80 };
            g.enemies = g.enemies.filter(en => en.id !== target.id);
            g.targetEnemy = null;
        } else if (target.powerup === 'HEAL') {
            audio.playHeal();
            if (g.stats.lives < 3) {
                g.stats.lives++;
                setLives(g.stats.lives);
            }
            g.waveNotice = { text: '💚 +1 NYAWA: TERUMBU KARANG MEMULIHKAN MANTA!', timer: 80 };
            g.enemies = g.enemies.filter(en => en.id !== target.id);
            g.targetEnemy = null;
        } else {
            g.enemies = g.enemies.filter(en => en.id !== target.id);
            g.targetEnemy = null;
        }

        // 👑 Transisi Mulus ke Wave Bos jika bossPendingWave aktif dan layar sudah bersih dari musuh
        if (g.bossPendingWave && g.enemies.length === 0 && !g.boss) {
            const canvas = canvasRef.current;
            const rect = canvas ? canvas.getBoundingClientRect() : { width: 900, height: 540 };
            startBossBattle(g, g.bossPendingWave, rect.width || 900, rect.height || 540);
            g.bossPendingWave = null;
        }
    };

    // 🏎️ Helper Kecepatan WPM Tier
    const getWpmTier = (wpm) => {
        if (wpm >= 85) return { label: 'Senator Speed! 🔥', class: 'tier-magenta' };
        if (wpm >= 55) return { label: 'Turbo ⚡', class: 'tier-amber' };
        if (wpm >= 30) return { label: 'Kilas 🌊', class: 'tier-cyan' };
        return { label: 'Santai 🐚', class: 'tier-emerald' };
    };

    // 💬 Helper Efek Teks Kombo Bergaya Komik
    const triggerComboEffect = (g) => {
        let comboText = '';
        if (g.stats.combo === 5) comboText = 'BAGUS! 5x';
        else if (g.stats.combo === 10) comboText = 'MANTAP! 10x 🔥';
        else if (g.stats.combo === 15) comboText = 'LUAR BIASA! 15x ⚡';
        else if (g.stats.combo === 20) comboText = 'MENYALA ABANGKU! 20x 💥';
        else if (g.stats.combo === 30) comboText = 'SENATOR SPEED! 30x 🚀';
        else if (g.stats.combo >= 40 && g.stats.combo % 10 === 0) comboText = `LEGENDA DPD RI! ${g.stats.combo}x 👑`;

        if (comboText) {
            g.floatingTexts = g.floatingTexts || [];
            g.floatingTexts.push({
                text: comboText,
                x: g.manta.x + 85,
                y: g.manta.y - 30,
                vy: -1.2,
                alpha: 1.0,
                color: ['#fef08a', '#38bdf8', '#34d399', '#f472b6', '#c084fc'][Math.floor(Math.random() * 5)]
            });
        }
    };

    // 🔒 2. Input Keyboard & Penanganan Anti-Macet Spasi
    const handleKeyDown = useCallback((e) => {
        if (!isOpen) return;

        // Cegah tombol space atau panah menggulirkan halaman web di latar belakang
        if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Tab'].includes(e.key)) {
            e.preventDefault();
        }

        // Jika user sedang mengetik di input text nama guest, jangan intercept
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            return;
        }

        if (countdownRef.current !== null) {
            // Sedang hitung mundur (countdown), abaikan input ketikan agar pemain siap
            return;
        }

        if (gameState === 'MENU') {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                startGame();
            }
            return;
        }

        if (gameState !== 'PLAYING') {
            if (e.key === 'Escape' && gameState === 'PAUSED') {
                handleResumeGame();
            }
            return;
        }

        if (e.key === 'Escape') {
            handlePauseGame();
            return;
        }

        const rawKey = e.key;
        const key = rawKey.toUpperCase();

        // Izinkan spasi, huruf A-Z, angka 0-9, atau tanda hubung
        if (rawKey !== ' ' && (key.length !== 1 || !/^[A-Z0-9\-]$/.test(key))) {
            return;
        }

        e.preventDefault();

        // Jamin AudioContext aktif dan BGM mengalun saat bermain
        if (audio.ctx && audio.ctx.state === 'suspended') {
            audio.ctx.resume().catch(() => {});
        }
        if (!audio.bgmPlaying && !audio.isMuted) {
            audio.startBGM();
        }

        const g = gameLoopRef.current;
        g.stats.totalKeys++;
        setTotalKeystrokes(g.stats.totalKeys);

        // Catat timestamp keystroke untuk perhitungan Live WPM
        (g.recentKeystrokes = g.recentKeystrokes || []).push(performance.now());

        // Helper untuk memajukan spasi otomatis jika ada di tengah kata
        const advanceSpaces = (target) => {
            while (target && target.typedIndex < target.word.length && target.word[target.typedIndex] === ' ') {
                target.typedIndex++;
            }
        };

        // 👑 APEX BOSS TYPING LOCK: Jika ada Bos, input pemain otomatis menarget Bos
        if (g.boss) {
            // Jika fase intro sirene & peringatan kedatangan bos masih berlangsung,
            // amankan ketikan pemain agar tidak terjadi pengetikan invalid / kombo terputus
            if (g.bossWarningTimer > 0) {
                return;
            }

            const target = g.boss;
            advanceSpaces(target);
            const expectedChar = target.word[target.typedIndex];

            if (key === expectedChar || (expectedChar === ' ' && rawKey === ' ')) {
                target.typedIndex++;
                advanceSpaces(target);
                g.stats.correctKeys++;
                g.stats.combo++;
                if (g.stats.combo > g.stats.maxCombo) g.stats.maxCombo = g.stats.combo;
                setCorrectKeystrokes(g.stats.correctKeys);
                setCombo(g.stats.combo);
                setMaxCombo(g.stats.maxCombo);

                triggerComboEffect(g);
                fireSonarProjectile(g, target);
                audio.playKeyHit(g.stats.combo);

                if (target.typedIndex >= target.word.length) {
                    defeatEnemy(g, target);
                }
            } else {
                g.stats.combo = 0;
                setCombo(0);
                audio.playWrongKey();
            }
            return;
        }

        if (!g.targetEnemy) {
            const candidates = g.enemies.filter(en => {
                const firstChar = en.word[0];
                return (firstChar === key || (firstChar === ' ' && rawKey === ' ')) && en.x > g.manta.x;
            });

            if (candidates.length > 0) {
                candidates.sort((a, b) => a.x - b.x);
                const chosen = candidates[0];
                chosen.isTargeted = true;
                chosen.typedIndex = 1;
                advanceSpaces(chosen);
                g.targetEnemy = chosen;

                fireSonarProjectile(g, chosen);
                g.stats.correctKeys++;
                g.stats.combo++;
                if (g.stats.combo > g.stats.maxCombo) g.stats.maxCombo = g.stats.combo;
                setCorrectKeystrokes(g.stats.correctKeys);
                setCombo(g.stats.combo);
                setMaxCombo(g.stats.maxCombo);

                triggerComboEffect(g);
                audio.playKeyHit(g.stats.combo);

                if (chosen.typedIndex >= chosen.word.length) {
                    defeatEnemy(g, chosen);
                }
            } else {
                g.stats.combo = 0;
                setCombo(0);
                audio.playWrongKey();
            }
        } else {
            const target = g.targetEnemy;
            advanceSpaces(target);
            const expectedChar = target.word[target.typedIndex];

            // Cocokkan karakter (baik huruf, angka, maupun spasi)
            if (key === expectedChar || (expectedChar === ' ' && rawKey === ' ')) {
                target.typedIndex++;
                advanceSpaces(target);
                g.stats.correctKeys++;
                g.stats.combo++;
                if (g.stats.combo > g.stats.maxCombo) g.stats.maxCombo = g.stats.combo;
                setCorrectKeystrokes(g.stats.correctKeys);
                setCombo(g.stats.combo);
                setMaxCombo(g.stats.maxCombo);

                triggerComboEffect(g);
                fireSonarProjectile(g, target);
                audio.playKeyHit(g.stats.combo);

                if (target.typedIndex >= target.word.length) {
                    defeatEnemy(g, target);
                }
            } else {
                g.stats.combo = 0;
                setCombo(0);
                audio.playWrongKey();
            }
        }
    }, [isOpen, gameState, handleResumeGame, handlePauseGame]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // ========================================================================
    // 🎨 CANVAS ANIMATION & RENDERING ENGINE (60 FPS ARCADE)
    // ========================================================================
    useEffect(() => {
        if (!isOpen) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);

            if (gameLoopRef.current.bubbles.length === 0) {
                gameLoopRef.current.bubbles = initBubbles(rect.width, rect.height);
            }
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        let resizeObserver = null;
        if (typeof window !== 'undefined' && window.ResizeObserver && canvas.parentElement) {
            resizeObserver = new ResizeObserver(() => {
                resizeCanvas();
            });
            resizeObserver.observe(canvas.parentElement);
        }

        let lastTime = performance.now();

        const render = (now) => {
            const dt = Math.min((now - lastTime) / 1000, 0.1);
            lastTime = now;

            const rect = canvas.getBoundingClientRect();
            const width = rect.width || 900;
            const height = rect.height || 540;

            const g = gameLoopRef.current;

            ctx.save();
            if (g.screenShake > 0) {
                const shakeX = (Math.random() - 0.5) * g.screenShake * 10;
                const shakeY = (Math.random() - 0.5) * g.screenShake * 10;
                ctx.translate(shakeX, shakeY);
                g.screenShake -= dt * 2.5;
                if (g.screenShake < 0) g.screenShake = 0;
            }

            // 1. Gambar Gradasi Kedalaman Laut
            const depthFactor = Math.min((g.stats.wave - 1) * 0.12, 0.7);
            const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
            const topColor = `rgb(${Math.floor(12 * (1 - depthFactor))}, ${Math.floor(74 * (1 - depthFactor))}, ${Math.floor(110 * (1 - depthFactor))})`;
            const botColor = `rgb(${Math.floor(4 * (1 - depthFactor))}, ${Math.floor(20 * (1 - depthFactor))}, ${Math.floor(38 * (1 - depthFactor))})`;
            oceanGrad.addColorStop(0, topColor);
            oceanGrad.addColorStop(1, botColor);
            ctx.fillStyle = oceanGrad;
            ctx.fillRect(0, 0, width, height);

            // 2. Sinar Matahari Bawah Air (Caustic Rays)
            ctx.fillStyle = 'rgba(56, 189, 248, 0.035)';
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                const rayX = (width * 0.25 * i) + Math.sin(now * 0.001 + i) * 30;
                ctx.moveTo(rayX, 0);
                ctx.lineTo(rayX + 90, 0);
                ctx.lineTo(rayX + 160 + Math.sin(now * 0.0012 + i) * 40, height);
                ctx.lineTo(rayX - 30, height);
                ctx.closePath();
                ctx.fill();
            }

            // 3. Gelembung Udara
            g.bubbles.forEach(b => {
                b.y -= b.speed;
                b.wobble += 0.04;
                const wx = b.x + Math.sin(b.wobble) * 8;
                if (b.y < -10) {
                    b.y = height + 10;
                    b.x = Math.random() * width;
                }
                ctx.beginPath();
                ctx.arc(wx, b.y, b.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(186, 230, 253, ${b.opacity})`;
                ctx.fill();
            });

            // 4. Terumbu Karang Siluet di Dasar Laut
            ctx.fillStyle = 'rgba(2, 44, 34, 0.4)';
            ctx.beginPath();
            ctx.moveTo(0, height);
            for (let x = 0; x <= width; x += 40) {
                const reefY = height - 25 - Math.sin(x * 0.03 + now * 0.0006) * 12;
                ctx.lineTo(x, reefY);
            }
            ctx.lineTo(width, height);
            ctx.closePath();
            ctx.fill();

            // 5. UPDATE GAME LOGIC (Saat PLAYING dan tidak sedang Countdown)
            if (gameState === 'PLAYING' && !countdownRef.current) {
                const maxEnemies = getMaxEnemiesForWave(g.stats.wave);
                if (!g.boss && !g.bossPendingWave && g.enemies.length < maxEnemies && now - g.lastSpawnTime > g.spawnInterval) {
                    g.enemies.push(spawnEnemy(width, height, g.stats.wave, null, g.enemies, g.stats.lives));
                    g.lastSpawnTime = now;
                }

                g.manta.y += (g.manta.targetY - g.manta.y) * 0.08;
                g.manta.glow = Math.max(0, g.manta.glow - dt * 2.2);

                g.torpedoes.forEach(tp => {
                    tp.progress += tp.speed;
                    const curX = tp.x + (tp.targetX - tp.x) * tp.progress;
                    const curY = tp.y + (tp.targetY - tp.y) * tp.progress;

                    ctx.beginPath();
                    ctx.arc(curX, curY, 6, 0, Math.PI * 2);
                    ctx.fillStyle = '#38bdf8';
                    ctx.shadowColor = '#38bdf8';
                    ctx.shadowBlur = 12;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                });
                g.torpedoes = g.torpedoes.filter(tp => tp.progress < 1.0);

                // Hitung durasi Arus Tenang (Slow-Mo) jika aktif
                if (g.slowMoTimer > 0) {
                    g.slowMoTimer -= dt;
                }
                const speedMultiplier = g.slowMoTimer > 0 ? 0.45 : 1.0;

                // Hitung durasi Perisai Darurat Kebal Sementara (Invulnerability)
                if (g.invincibleTimer > 0) {
                    g.invincibleTimer = Math.max(0, g.invincibleTimer - dt);
                }

                for (let i = g.enemies.length - 1; i >= 0; i--) {
                    const en = g.enemies[i];
                    en.x -= en.speed * speedMultiplier;
                    en.wiggle += 0.05;
                    en.y = en.baseY + Math.sin(en.wiggle) * 10;

                    if (en.x <= g.manta.x + 35) {
                        // Jika dalam masa kebal perisai darurat, singkirkan musuh tanpa kurangi nyawa
                        if (g.invincibleTimer > 0) {
                            if (g.targetEnemy && g.targetEnemy.id === en.id) {
                                g.targetEnemy = null;
                            }
                            g.enemies.splice(i, 1);
                            continue;
                        }

                        audio.playLifeLost();
                        g.screenShake = 1.2;
                        g.stats.lives--;
                        g.stats.combo = 0;
                        setLives(g.stats.lives);
                        setCombo(0);

                        // 🛡️ Berikan Perisai Darurat Kebal 2.0 detik agar tidak mati instan berturut-turut
                        g.invincibleTimer = 2.0;

                        // Dorong mundur musuh lain yang terlalu mepet 140px ke kanan agar ada ruang napas
                        g.enemies.forEach(other => {
                            if (other.id !== en.id && other.x < width * 0.72) {
                                other.x = Math.min(width - 50, other.x + 140);
                            }
                        });

                        g.shockwave = { x: g.manta.x, y: g.manta.y, radius: 10, maxRadius: 360, alpha: 0.95 };
                        g.waveNotice = { text: '🛡️ PERISAI DARURAT AKTIF (2 DETIK)! AMBIL NAFAS!', timer: 80 };

                        if (g.targetEnemy && g.targetEnemy.id === en.id) {
                            g.targetEnemy = null;
                        }
                        g.enemies.splice(i, 1);

                        // Transisi mulus ke Boss Wave jika ada bossPendingWave dan musuh di layar sudah habis
                        if (g.bossPendingWave && g.enemies.length === 0 && !g.boss && g.stats.lives > 0) {
                            startBossBattle(g, g.bossPendingWave, width, height);
                            g.bossPendingWave = null;
                        }

                        if (g.stats.lives <= 0) {
                            audio.playGameOver();
                            audio.stopBGM();
                            setGameState('GAMEOVER');
                            break;
                        }
                    }
                }

                for (let i = g.particles.length - 1; i >= 0; i--) {
                    const p = g.particles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.alpha -= p.decay;
                    if (p.alpha <= 0) {
                        g.particles.splice(i, 1);
                    }
                }

                // Update Logika Gerak & Benturan Bos Kolosal
                if (g.boss) {
                    const boss = g.boss;
                    boss.x -= boss.speed * speedMultiplier;
                    boss.wiggle += 0.04;
                    boss.y = boss.baseY + Math.sin(boss.wiggle) * 16;

                    if (boss.shake > 0) boss.shake = Math.max(0, boss.shake - dt * 2.5);
                    if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt * 3.5);

                    if (boss.x <= g.manta.x + 65) {
                        if (g.invincibleTimer > 0) {
                            boss.x = Math.min(width - 160, boss.x + 120);
                        } else {
                            audio.playLifeLost();
                            g.screenShake = 1.3;
                            g.stats.lives--;
                            g.stats.combo = 0;
                            setLives(g.stats.lives);
                            setCombo(0);
                            g.invincibleTimer = 2.5;

                            // Terpental mundur sedikit untuk memberi ruang napas
                            boss.x = Math.min(width - 160, boss.x + 150);
                            g.shockwave = { x: g.manta.x, y: g.manta.y, radius: 10, maxRadius: 400, alpha: 0.95 };
                            g.waveNotice = { text: '🛡️ PERISAI DARURAT AKTIF (2.5 DETIK)!', timer: 90 };

                            if (g.stats.lives <= 0) {
                                audio.playGameOver();
                                audio.stopBGM();
                                setGameState('GAMEOVER');
                            }
                        }
                    }
                }

                if (g.bossWarningTimer > 0) {
                    g.bossWarningTimer -= dt;
                    // Animasi Bos meluncur anggun dari kanan ke posisinya
                    if (g.boss && g.boss.x > g.boss.targetX) {
                        g.boss.x += (g.boss.targetX - g.boss.x) * 0.05;
                    }
                    if (g.bossWarningTimer <= 0) {
                        g.bossWarningTimer = 0;
                        if (g.boss) {
                            g.boss.isTargeted = true;
                            g.targetEnemy = g.boss;
                            audio.playKeyHit(1);
                        }
                    }
                }
            }

            // 6. GAMBAR PARTIKEL LEDAKAN
            g.particles.forEach(p => {
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
                ctx.restore();
            });

            // 6.5. GAMBAR SHOCKWAVE EMP LEDAKAN
            if (g.shockwave && g.shockwave.alpha > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(g.shockwave.x, g.shockwave.y, g.shockwave.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(251, 191, 36, ${g.shockwave.alpha})`;
                ctx.lineWidth = 10 * g.shockwave.alpha;
                ctx.shadowColor = '#f59e0b';
                ctx.shadowBlur = 25;
                ctx.stroke();
                ctx.restore();

                g.shockwave.radius += dt * 950;
                g.shockwave.alpha -= dt * 1.6;
                if (g.shockwave.alpha <= 0) g.shockwave = null;
            }

            // 6.6. GAMBAR EFEK ARUS TENANG (ICY FROST VIGNETTE)
            if (g.slowMoTimer > 0) {
                ctx.save();
                ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
                ctx.fillRect(0, 0, width, height);
                ctx.strokeStyle = 'rgba(103, 232, 249, 0.35)';
                ctx.lineWidth = 4;
                ctx.strokeRect(4, 4, width - 8, height - 8);
                ctx.restore();
            }

            // 6.7. GAMBAR FLOATING COMBO TEXTS
            if (g.floatingTexts && g.floatingTexts.length > 0) {
                g.floatingTexts.forEach(ft => {
                    ctx.save();
                    ctx.font = '900 22px "Plus Jakarta Sans", system-ui, sans-serif';
                    ctx.fillStyle = ft.color;
                    ctx.shadowColor = ft.color;
                    ctx.shadowBlur = 14;
                    ctx.globalAlpha = Math.max(0, ft.alpha);
                    ctx.textAlign = 'center';
                    ctx.fillText(ft.text, ft.x, ft.y);
                    ctx.restore();

                    ft.y += ft.vy;
                    ft.alpha -= dt * 0.9;
                });
                g.floatingTexts = g.floatingTexts.filter(ft => ft.alpha > 0);
            }

            // Hitung Kecepatan Ketik Realtime (Live WPM) secara berkala
            if (now - (g.lastWpmUpdate || 0) > 300) {
                g.recentKeystrokes = (g.recentKeystrokes || []).filter(t => now - t < 5000);
                const currentInstantWpm = Math.round((g.recentKeystrokes.length / 5) * 12);
                setLiveWpm(currentInstantWpm);
                setSlowMoRemaining(g.slowMoTimer > 0 ? Math.ceil(g.slowMoTimer) : 0);
                g.lastWpmUpdate = now;
            }

            // 7. GAMBAR AKTOR UTAMA: MANTA
            const m = g.manta;
            const mantaImg = m.isHappy ? mantaHappyImgRef.current : mantaImgRef.current;
            ctx.save();
            ctx.translate(m.x, m.y);

            // Efek kedip saat dalam kondisi perisai kebal darurat
            if (g.invincibleTimer > 0) {
                ctx.globalAlpha = Math.sin(now * 0.035) > 0 ? 0.35 : 0.95;
            }

            if (m.glow > 0) {
                ctx.shadowColor = '#06b6d4';
                ctx.shadowBlur = 25 * m.glow;
            }

            const bobOffset = Math.sin(now * 0.003) * 6;
            if (mantaImg && mantaImg.complete && mantaImg.naturalWidth > 0) {
                ctx.drawImage(mantaImg, -m.width / 2, -m.height / 2 + bobOffset, m.width, m.height);
            } else {
                ctx.fillStyle = '#0284c7';
                ctx.beginPath();
                ctx.ellipse(0, bobOffset, 38, 24, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // 🛡️ Gambar Kubah Gelembung Perisai Pelindung saat Kebal
            if (g.invincibleTimer > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(0, bobOffset, m.width * 0.68, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
                ctx.fill();
                ctx.lineWidth = 3.5;
                ctx.strokeStyle = '#38bdf8';
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 18;
                ctx.stroke();

                // Cincin energi berputar tipis di sekeliling perisai
                ctx.beginPath();
                ctx.arc(0, bobOffset, m.width * 0.76, now * 0.004, now * 0.004 + Math.PI * 1.3);
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.stroke();
                ctx.restore();
            }

            ctx.restore();

            // 8. GAMBAR KARAKTER MUSUH YANG DETAIL & BADGE KATA BESAR
            g.enemies.forEach(en => {
                ctx.save();
                ctx.translate(en.x, en.y);

                // 🌟 Aura Neon Berdenyut di Sekeliling Musuh Pembawa Bonus (Mencolok dari Kejauhan)
                if (en.powerup) {
                    const haloColor = en.powerup === 'BOMB' ? 'rgba(245, 158, 11, 0.45)' :
                                      en.powerup === 'SLOW' ? 'rgba(56, 189, 248, 0.45)' :
                                      'rgba(52, 211, 153, 0.45)';
                    const haloPulse = Math.sin(now * 0.008 + en.wiggle) * 5;
                    ctx.beginPath();
                    ctx.arc(0, 0, en.size + 16 + haloPulse, 0, Math.PI * 2);
                    ctx.fillStyle = haloColor;
                    ctx.shadowColor = haloColor;
                    ctx.shadowBlur = 24;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }

                // Gambar Siluet Predator Laut Berdasarkan Tipe
                if (en.type === 'HAMMERHEAD') {
                    drawHammerhead(ctx, en, now);
                } else if (en.type === 'JELLY') {
                    drawJelly(ctx, en, now);
                } else if (en.type === 'VIPER') {
                    drawViper(ctx, en, now);
                } else {
                    drawShark(ctx, en, now);
                }

                // Gambar Word Badge yang Besar, Jelas & Berkontras Tinggi
                drawWordBadge(ctx, en);

                ctx.restore();
            });

            // 8.5. GAMBAR KARAKTER BOS KOLOSAL (JIKA ADA)
            if (g.boss) {
                ctx.save();
                ctx.translate(g.boss.x, g.boss.y);

                if (g.boss.type === 'KRAKEN') {
                    drawKrakenBoss(ctx, g.boss, now);
                } else if (g.boss.type === 'MEGALODON') {
                    drawMegalodonBoss(ctx, g.boss, now);
                }

                // Hanya render word badge bos jika intro peringatan sudah selesai
                if (g.bossWarningTimer <= 0) {
                    drawBossWordBadge(ctx, g.boss);
                }
                ctx.restore();

                // Gambar Boss HUD di bagian atas layar jika intro sudah selesai
                if (g.bossWarningTimer <= 0) {
                    drawBossHUD(ctx, g.boss, width);
                }
            }

            // Peringatan Boss Masuk (Warning Banner Strobe)
            if (g.bossWarningTimer > 0 && g.boss) {
                drawBossWarningBanner(ctx, g.boss, width, height, now);
            }

            // 9. Garis Laser Sonar ke Target Terkunci atau Bos
            if (g.boss) {
                ctx.save();
                ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
                ctx.lineWidth = 3;
                ctx.setLineDash([8, 4]);
                ctx.beginPath();
                ctx.moveTo(g.manta.x + 35, g.manta.y);
                ctx.lineTo(g.boss.x - 30, g.boss.y);
                ctx.stroke();
                ctx.restore();
            } else if (g.targetEnemy) {
                ctx.save();
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(g.manta.x + 35, g.manta.y);
                ctx.lineTo(g.targetEnemy.x - 25, g.targetEnemy.y);
                ctx.stroke();
                ctx.restore();
            }

            // 10. Notifikasi Wave Naik
            if (g.waveNotice && g.waveNotice.timer > 0) {
                g.waveNotice.timer--;
                ctx.save();
                ctx.fillStyle = 'rgba(2, 132, 199, 0.95)';
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 20;
                ctx.font = '900 24px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(g.waveNotice.text, width / 2, 70);
                ctx.restore();
            }

            ctx.restore();

            animationFrameRef.current = requestAnimationFrame(render);
        };

        animationFrameRef.current = requestAnimationFrame(render);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            window.removeEventListener('resize', resizeCanvas);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    }, [isOpen, gameState, isFullscreen]);

    if (!isOpen) return null;

    const accuracyVal = totalKeystrokes > 0 ? ((correctKeystrokes / totalKeystrokes) * 100).toFixed(1) : '100.0';

    const modalContent = (
        <div
            className="mantatype-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="MantaType Arcade Game"
            onClick={() => audio.init()}
        >
            <div
                ref={containerRef}
                tabIndex={0}
                className={`mantatype-modal ${isFullscreen ? 'mantatype-fullscreen' : ''}`}
                style={{ outline: 'none' }}
            >
                {/* HEADER ARCADE */}
                <header className="mantatype-header">
                    <div className="mantatype-header-left">
                        <div className="mantatype-logo-badge">
                            <span className="mantatype-arcade-icon">🎮</span>
                            <span className="mantatype-title">MantaType</span>
                            <span className="mantatype-version-pill">Arcade Edition</span>
                        </div>
                    </div>

                    {/* HUD STATISTIK GAME DI HEADER */}
                    {gameState === 'PLAYING' && (
                        <div className="mantatype-hud">
                            <div className="mantatype-hud-item">
                                <span className="mantatype-hud-label">SKOR</span>
                                <span className="mantatype-hud-value score">{score}</span>
                            </div>
                            <div className="mantatype-hud-item">
                                <span className="mantatype-hud-label">KEDALAMAN</span>
                                <span className="mantatype-hud-value depth">{depth}m</span>
                            </div>
                            <div className="mantatype-hud-item">
                                <span className="mantatype-hud-label">WAVE</span>
                                <span className="mantatype-hud-value wave">Lv.{wave}</span>
                            </div>

                            {/* 🏎️ Speedometer WPM Neon Gauge */}
                            <div className="mantatype-hud-item speedometer-item">
                                <span className="mantatype-hud-label">KECEPATAN</span>
                                <div className="mantatype-wpm-gauge">
                                    <span className="mantatype-wpm-val">{liveWpm}</span>
                                    <span className="mantatype-wpm-unit">WPM</span>
                                    <span className={`mantatype-wpm-tier-pill ${getWpmTier(liveWpm).class}`}>
                                        {getWpmTier(liveWpm).label}
                                    </span>
                                </div>
                            </div>

                            {/* ❄️ Indikator Arus Tenang Aktif */}
                            {slowMoRemaining > 0 && (
                                <div className="mantatype-hud-item slowmo-active-item animate-pulse">
                                    <span>❄️</span>
                                    <span>ARUS TENANG {slowMoRemaining}s</span>
                                </div>
                            )}

                            <div className="mantatype-hud-item">
                                <span className="mantatype-hud-label">NYAWA</span>
                                <span className="mantatype-hud-lives">
                                    {[...Array(3)].map((_, i) => (
                                        <span key={i} className={`mantatype-heart ${i < lives ? 'active' : 'lost'}`}>
                                            ❤️
                                        </span>
                                    ))}
                                </span>
                            </div>
                            {combo >= 3 && (
                                <div className="mantatype-combo-badge animate-pulse">
                                    🔥 {combo}x COMBO
                                </div>
                            )}
                        </div>
                    )}

                    {/* TOMBOL AKSI ATAS */}
                    <div className="mantatype-header-actions">
                        {/* Tombol Pause saat bermain */}
                        {gameState === 'PLAYING' && (
                            <button
                                className="mantatype-btn-icon mantatype-btn-pause"
                                onClick={handlePauseGame}
                                title="Jeda Permainan (Esc)"
                                aria-label="Jeda Permainan"
                            >
                                ⏸️
                            </button>
                        )}

                        {/* Tombol Resume saat dijeda */}
                        {gameState === 'PAUSED' && (
                            <button
                                className="mantatype-btn-icon mantatype-btn-resume active-audio"
                                onClick={handleResumeGame}
                                title="Lanjutkan Permainan (Esc)"
                                aria-label="Lanjutkan Permainan"
                            >
                                ▶️
                            </button>
                        )}

                        {/* Audio Settings Popover Toggle */}
                        <div className="mantatype-audio-wrapper" ref={audioWrapperRef}>
                            <button
                                className={`mantatype-btn-icon ${!isMuted ? 'active-audio' : ''}`}
                                onClick={() => setShowAudioPopover(!showAudioPopover)}
                                title="Pengaturan Audio & Musik Bawah Air"
                                aria-label="Toggle Audio Settings"
                            >
                                {isMuted ? '🔇' : '🔊'}
                            </button>

                            {showAudioPopover && (
                                <div className="mantatype-audio-popover" onClick={(e) => e.stopPropagation()}>
                                    <div className="audio-popover-head">
                                        <h6>🔊 Audio Bawah Air</h6>
                                        <button 
                                            type="button" 
                                            className="close-popover-btn"
                                            onClick={() => setShowAudioPopover(false)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className="audio-popover-body">
                                        <div className="audio-slider-group mb-2">
                                            <div className="slider-label-row">
                                                <span>🎵 Musik BGM</span>
                                                <span className="text-teal fw-bold">{Math.round(bgmVolume * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="1" 
                                                step="0.05"
                                                value={bgmVolume}
                                                onChange={(e) => {
                                                    const v = parseFloat(e.target.value);
                                                    setBgmVolume(v);
                                                    audio.setBgmVolume(v);
                                                }}
                                            />
                                        </div>

                                        <div className="audio-slider-group mb-3">
                                            <div className="slider-label-row">
                                                <span>💥 Efek Suara (SFX)</span>
                                                <span className="text-teal fw-bold">{Math.round(sfxVolume * 100)}%</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="1" 
                                                step="0.05"
                                                value={sfxVolume}
                                                onChange={(e) => {
                                                    const v = parseFloat(e.target.value);
                                                    setSfxVolume(v);
                                                    audio.setSfxVolume(v);
                                                }}
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            className={`btn btn-sm ${isMuted ? 'btn-danger' : 'btn-outline-info'} w-100 fw-bold`}
                                            onClick={handleToggleMute}
                                        >
                                            {isMuted ? '🔇 Buka Suara (Unmute)' : '🔊 Senyapkan Suara (Mute)'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Fullscreen Toggle */}
                        <button
                            className="mantatype-btn-icon"
                            onClick={handleToggleFullscreen}
                            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh (Fullscreen)'}
                            aria-label="Toggle Fullscreen"
                        >
                            {isFullscreen ? '🗗' : '⛶'}
                        </button>

                        {/* Switch ke Chat Manta AI (hanya saat MENU atau GAMEOVER agar header tidak overflow saat PLAYING) */}
                        {onSwitchToChat && gameState !== 'PLAYING' && (
                            <button
                                className="mantatype-btn-switch"
                                onClick={() => {
                                    audio.stopBGM();
                                    onClose();
                                    onSwitchToChat();
                                }}
                                title="Beralih ke Chat Asisten AI Manta"
                            >
                                💬 Tanya Manta AI
                            </button>
                        )}

                        {/* Tombol Tutup */}
                        <button
                            className="mantatype-btn-close"
                            onClick={() => {
                                audio.stopBGM();
                                onClose();
                            }}
                            title="Tutup Game"
                            aria-label="Tutup Game MantaType"
                        >
                            ✕
                        </button>
                    </div>
                </header>

                {/* AREA CANVAS PERMAINAN */}
                <div className="mantatype-canvas-container">
                    <canvas ref={canvasRef} className="mantatype-canvas" />

                    {/* ⏱️ OVERLAY HITUNG MUNDUR (COUNTDOWN 3.. 2.. 1.. MENYELAM!) */}
                    {countdown !== null && (
                        <div className="mantatype-countdown-overlay">
                            <div className="mantatype-countdown-container" key={countdown}>
                                <div className={`mantatype-countdown-text ${countdown === 'MENYELAM!' ? 'go' : ''}`}>
                                    {countdown}
                                </div>
                                <div className="mantatype-countdown-subtext">
                                    {countdown === 'MENYELAM!' ? '🌊 Pertahankan Lautan!' : 'Bersiap di Keyboard...'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 💡 Glosarium Edukatif Banner */}
                    {lastLearnedWord && gameState === 'PLAYING' && (
                        <div className="mantatype-glosarium-banner">
                            <span className="glosarium-label">💡 Glosarium:</span>
                            <strong className="glosarium-word">{lastLearnedWord.word}</strong>
                            <span className="glosarium-sep">&bull;</span>
                            <span className="glosarium-meaning">{lastLearnedWord.meaning}</span>
                        </div>
                    )}

                    {/* OVERLAY LAYAR TERKUNCI JAM KERJA KEDINASAN */}
                    {gameState === 'LOCKED' && (
                        <div className="mantatype-screen-overlay">
                            <div className="mantatype-card-menu text-center">
                                <div className="mantatype-menu-hero">
                                    <img src={mantaIdleWebp} alt="Manta" className="mantatype-hero-avatar" />
                                    <h1 className="mantatype-menu-title" style={{ fontSize: '1.6rem' }}>
                                        MantaType Sedang Ditutup
                                    </h1>
                                    <div className="mantatype-schedule-lock-badge">
                                        <span>🔒</span>
                                        <span>Jadwal Jam Kerja Kedinasan Setjen DPD RI</span>
                                    </div>
                                </div>

                                <div className="mantatype-lock-message-box">
                                    <p className="mb-0">
                                        {lockInfo?.message || "Saat ini sedang jam dinas aktif. Mari fokus pada tugas negara dan kursus kompetensi terlebih dahulu."}
                                    </p>
                                    {lockInfo?.schedule && (
                                        <div className="mantatype-lock-hours-grid">
                                            <div className="lock-hour-card">
                                                <span className="hour-label">Jam Istirahat Siang</span>
                                                <span className="hour-val">{lockInfo.schedule.break_start} - {lockInfo.schedule.break_end} WIB</span>
                                            </div>
                                            <div className="lock-hour-card">
                                                <span className="hour-label">Selesai Jam Dinas</span>
                                                <span className="hour-val">{lockInfo.schedule.after_work_start}+ WIB</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mantatype-menu-buttons">
                                    {onSwitchToChat && (
                                        <button
                                            className="mantatype-btn-primary pulse-btn"
                                            onClick={() => {
                                                audio.stopBGM();
                                                onClose();
                                                onSwitchToChat();
                                            }}
                                        >
                                            💬 Ngobrol dengan Manta AI Saja
                                        </button>
                                    )}
                                    <button
                                        className="mantatype-btn-secondary"
                                        onClick={() => {
                                            audio.stopBGM();
                                            onClose();
                                        }}
                                    >
                                        ✕ Kembali ke LMS
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* OVERLAY LAYAR MENU UTAMA (START SCREEN) */}
                    {gameState === 'MENU' && (
                        <div className="mantatype-screen-overlay">
                            <div className="mantatype-card-menu">
                                <div className="mantatype-menu-hero">
                                    <img src={mantaIdleWebp} alt="Manta" className="mantatype-hero-avatar" />
                                    <h1 className="mantatype-menu-title">MantaType</h1>
                                    <p className="mantatype-menu-tagline">
                                        Selamatkan Lautan & Asah Ketangkasan Mengetik Bersama Maskot Manta!
                                    </p>
                                </div>

                                <div className="mantatype-how-to-play">
                                    <div className="mantatype-rule-item">
                                        <span className="mantatype-rule-icon">⌨️</span>
                                        <div>
                                            <strong>Ketik Kata pada Musuh</strong>
                                            <p>Huruf pertama akan mengunci target. Selesaikan seluruh kata untuk melepaskan tembakan bio-sonar Manta.</p>
                                        </div>
                                    </div>
                                    <div className="mantatype-rule-item">
                                        <span className="mantatype-rule-icon">🌊</span>
                                        <div>
                                            <strong>Tantangan Tanpa Batas (Infinite Waves)</strong>
                                            <p>Semakin dalam menyelam, kecepatan musuh makin cepat dan kata-kata kian menantang layaknya Flappybird!</p>
                                        </div>
                                    </div>
                                    <div className="mantatype-rule-item">
                                        <span className="mantatype-rule-icon">🛡️</span>
                                        <div>
                                            <strong>Pertahankan 3 Nyawa</strong>
                                            <p>Jangan biarkan predator laut menabrak Manta!</p>
                                        </div>
                                    </div>
                                    <div className="mantatype-rule-item highlight-rule">
                                        <span className="mantatype-rule-icon">🎖️</span>
                                        <div>
                                            <strong>Bonus XP Leveling ASN (+50 XP Harian)</strong>
                                            <p>Raih minimal Wave 3 untuk mengklaim bonus XP harian dan menaikkan tingkat kompetensi ASN Anda!</p>
                                        </div>
                                    </div>
                                    <div className="mantatype-rule-item boss-rule" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.08)' }}>
                                        <span className="mantatype-rule-icon">🦑</span>
                                        <div>
                                            <strong style={{ color: '#fbbf24' }}>Epic Boss Battles (Wave 5 & 10)</strong>
                                            <p>Hadapi <em>Kraken Regulasi</em> di Wave 5 dan apex predator <em>Megalodon Birokrasi</em> di Wave 10! Taklukkan rantai kata perisai untuk merebut ribuan skor bonus &amp; pemulihan nyawa.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mantatype-menu-buttons">
                                    <button className="mantatype-btn-primary pulse-btn" onClick={startGame}>
                                        🚀 Mulai Menyelam (Start Game)
                                    </button>
                                    <button
                                        className="mantatype-btn-secondary"
                                        onClick={() => {
                                            fetchLeaderboard();
                                            setGameState('RANKED');
                                        }}
                                    >
                                        🏆 Lihat MantaType Ranked (Top 10)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* OVERLAY LAYAR JEDA (PAUSED) */}
                    {gameState === 'PAUSED' && (
                        <div className="mantatype-screen-overlay">
                            <div className="mantatype-card-menu mantatype-card-paused">
                                <div className="mantatype-paused-icon">⏸️</div>
                                <h2 className="mantatype-paused-title">Permainan Dijeda</h2>
                                <p className="mantatype-paused-desc">Tarik nafas sejenak di kedalaman laut!</p>

                                <div className="mantatype-paused-stats">
                                    <div className="mantatype-paused-stat-item">
                                        <span className="paused-stat-label">SKOR SEMENTARA</span>
                                        <span className="paused-stat-value text-warning">{score}</span>
                                    </div>
                                    <div className="mantatype-paused-stat-item">
                                        <span className="paused-stat-label">WAVE</span>
                                        <span className="paused-stat-value text-emerald">{wave}</span>
                                    </div>
                                    <div className="mantatype-paused-stat-item">
                                        <span className="paused-stat-label">KEDALAMAN</span>
                                        <span className="paused-stat-value text-sky">{depth}m</span>
                                    </div>
                                    <div className="mantatype-paused-stat-item">
                                        <span className="paused-stat-label">SISA NYAWA</span>
                                        <span className="paused-stat-value text-danger">{'❤️'.repeat(Math.max(0, lives))}</span>
                                    </div>
                                </div>

                                <div className="mantatype-menu-buttons">
                                    <button className="mantatype-btn-primary" onClick={handleResumeGame}>
                                        ▶️ Lanjutkan Mengetik (Resume)
                                    </button>
                                    <button className="mantatype-btn-secondary" onClick={startGame}>
                                        🔄 Ulangi Dari Awal (Restart)
                                    </button>
                                    <button
                                        className="mantatype-btn-secondary"
                                        onClick={() => {
                                            fetchLeaderboard();
                                            setGameState('RANKED');
                                        }}
                                    >
                                        🏆 Papan Peringkat
                                    </button>
                                    <button
                                        className="mantatype-btn-secondary"
                                        onClick={() => {
                                            audio.stopBGM();
                                            setGameState('MENU');
                                        }}
                                    >
                                        🏠 Menu Utama
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* OVERLAY LAYAR GAME OVER (MANTATYPE RANKED ENTRY) */}
                    {gameState === 'GAMEOVER' && (
                        <div className="mantatype-screen-overlay">
                            <div className="mantatype-card-gameover">
                                <div className="mantatype-gameover-header">
                                    <span className="mantatype-gameover-badge">MISI BERAKHIR</span>
                                    <h2>Manta Butuh Istirahat! 🌊</h2>
                                    <p>Pertahanan laut terlewati, namun perjuangan ketangkasanmu luar biasa!</p>
                                </div>

                                <div className="mantatype-stats-grid">
                                    <div className="mantatype-stat-box">
                                        <span className="stat-label">TOTAL SKOR</span>
                                        <span className="stat-num highlight">{score}</span>
                                    </div>
                                    <div className="mantatype-stat-box">
                                        <span className="stat-label">KATA TERKETIK</span>
                                        <span className="stat-num">{wordsTyped}</span>
                                    </div>
                                    <div className="mantatype-stat-box">
                                        <span className="stat-label">AKURASI</span>
                                        <span className="stat-num">{accuracyVal}%</span>
                                    </div>
                                    <div className="mantatype-stat-box">
                                        <span className="stat-label">WAVE TERTINGGI</span>
                                        <span className="stat-num">Wave {wave}</span>
                                    </div>
                                </div>

                                {/* STATUS PENCATATAN SKOR OTOMATIS KE RANKED */}
                                {isSubmittingScore ? (
                                    <div className="mantatype-auto-rank-badge loading mb-3">
                                        <span className="spinner-border spinner-border-sm text-teal me-2" role="status"></span>
                                        <span>Menyinkronkan skor Anda secara otomatis ke Papan Peringkat...</span>
                                    </div>
                                ) : playerRankInfo?.isTop10 ? (
                                    <div className="mantatype-auto-rank-badge top10 mb-3 animate-glow">
                                        <div className="badge-icon-col">👑</div>
                                        <div className="badge-text-col">
                                            <h5 className="mb-1 text-warning fw-bold">🎉 Luar Biasa! Rekor Masuk Top 10 Ranked!</h5>
                                            <p className="mb-0 text-light small">
                                                Skor Anda otomatis tercatat di peringkat <strong>#{playerRankInfo.seasonalRank || playerRankInfo.rank}</strong> musim ini
                                                {playerRankInfo.lifetimeRank <= 10 && ` dan #${playerRankInfo.lifetimeRank} Hall of Fame sepanjang masa`}!
                                            </p>
                                        </div>
                                    </div>
                                ) : scoreSubmitted ? (
                                    <div className="mantatype-auto-rank-badge logged mb-3">
                                        <div className="badge-icon-col">⚡</div>
                                        <div className="badge-text-col">
                                            <h6 className="mb-1 text-teal fw-bold">Skor Berhasil Dicatat Otomatis</h6>
                                            <p className="mb-0 text-light small">
                                                Peringkat musim ini: <strong>#{playerRankInfo?.seasonalRank || playerRankInfo?.rank || '-'}</strong>. Terus asah kecepatan ketik Anda untuk menembus podium 10 Besar!
                                            </p>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="mantatype-ranked-preview">
                                    <h3>🏆 MantaType Ranked (Top 10 High Scores)</h3>
                                    <div className="mantatype-table-wrapper">
                                        <table className="mantatype-table">
                                            <thead>
                                                <tr>
                                                    <th>Rank</th>
                                                    <th>Pemain</th>
                                                    <th>Skor</th>
                                                    <th>Akurasi</th>
                                                    <th>Wave</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {leaderboard.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" className="text-center py-3">
                                                            {isLoadingLeaderboard ? 'Memuat data peringkat...' : 'Belum ada catatan skor. Jadilah yang pertama!'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    leaderboard.slice(0, 10).map((row, idx) => (
                                                        <tr key={row.id || idx} className={row.is_current_player ? 'current-player-row' : ''}>
                                                            <td className="rank-cell">
                                                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                                            </td>
                                                            <td className="player-cell">
                                                                <span className="player-name">{row.player_name}</span>
                                                                {!row.is_guest && <span className="auth-badge">ASN</span>}
                                                            </td>
                                                            <td className="score-cell">{row.score}</td>
                                                            <td>{row.accuracy}%</td>
                                                            <td>W{row.wave_reached}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="mantatype-menu-buttons">
                                    <button className="mantatype-btn-primary" onClick={startGame}>
                                        🔄 Main Lagi (Try Again)
                                    </button>
                                    <button className="mantatype-btn-secondary" onClick={() => setGameState('MENU')}>
                                        🏠 Menu Utama
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* OVERLAY LAYAR PAPAN PERINGKAT PENUH (RANKED VIEW) */}
                    {gameState === 'RANKED' && (() => {
                        const activeList = rankedViewType === 'seasonal' ? seasonalLeaderboard : lifetimeLeaderboard;
                        return (
                            <div className="mantatype-screen-overlay">
                                <div className="mantatype-card-ranked">
                                    <div className="mantatype-ranked-head">
                                        <h2>🏆 MantaType Ranked Hall of Fame</h2>
                                        <p>Peringkat 10 Pengetik Tercepat & Tertangguh di LMS Setjen DPD RI</p>

                                        {/* 2 Jenis Ranked: Seasonal Ranked vs Lifetime Ranked */}
                                        <div className="mantatype-ranked-tabs">
                                            <button
                                                type="button"
                                                className={`ranked-tab-btn ${rankedViewType === 'seasonal' ? 'active' : ''}`}
                                                onClick={() => setRankedViewType('seasonal')}
                                            >
                                                <i className="fas fa-calendar-alt me-1"></i>
                                                <span>Seasonal Ranked</span>
                                                <span className="ranked-tab-badge">
                                                    {seasonInfo?.quarter_label || 'Triwulan'}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`ranked-tab-btn ${rankedViewType === 'lifetime' ? 'active gold' : ''}`}
                                                onClick={() => setRankedViewType('lifetime')}
                                            >
                                                <i className="fas fa-crown me-1 text-warning"></i>
                                                <span>Lifetime Ranked</span>
                                                <span className="ranked-tab-badge gold">Sepanjang Masa</span>
                                            </button>
                                        </div>

                                        {/* Mode Banner Info */}
                                        {rankedViewType === 'seasonal' ? (
                                            <div className="ranked-mode-banner seasonal">
                                                <div className="banner-left">
                                                    <i className="fas fa-hourglass-half text-teal me-2"></i>
                                                    <span>
                                                        <strong>{seasonInfo?.season_name || "Musim Triwulan Aktif"}</strong>
                                                        {seasonInfo?.days_left !== undefined && (
                                                            <span className="ms-2 opacity-75">
                                                                ({seasonInfo.days_left} Hari tersisa menuju reset triwulan)
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="banner-badge">Di-reset per 3 Bulan</div>
                                            </div>
                                        ) : (
                                            <div className="ranked-mode-banner lifetime">
                                                <div className="banner-left">
                                                    <i className="fas fa-infinity text-warning me-2"></i>
                                                    <span>
                                                        <strong>Hall of Fame Abadi (Lifetime)</strong>
                                                        <span className="ms-2 opacity-75">
                                                            Rekor pengetik legendaris yang tidak pernah di-reset
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className="banner-badge gold">Permanen</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mantatype-table-wrapper large">
                                        <table className="mantatype-table">
                                            <thead>
                                                <tr>
                                                    <th>Peringkat</th>
                                                    <th>Pemain</th>
                                                    {rankedViewType === 'lifetime' && <th>Musim</th>}
                                                    <th>Skor</th>
                                                    <th>Kata</th>
                                                    <th>WPM</th>
                                                    <th>Akurasi</th>
                                                    <th>Wave</th>
                                                    <th>Waktu</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeList.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={rankedViewType === 'lifetime' ? 9 : 8} className="text-center py-4">
                                                            {isLoadingLeaderboard 
                                                                ? 'Sedang menyinkronkan data peringkat...' 
                                                                : (rankedViewType === 'seasonal' 
                                                                    ? 'Belum ada catatan skor di musim ini. Jadilah yang pertama!' 
                                                                    : 'Belum ada catatan skor abadi yang tersimpan.')}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    activeList.map((row, idx) => (
                                                        <tr key={row.id || idx}>
                                                            <td className="rank-cell">
                                                                {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                                                            </td>
                                                            <td className="player-cell">
                                                                <span className="player-name">{row.player_name}</span>
                                                                {!row.is_guest && <span className="auth-badge">ASN DPD</span>}
                                                            </td>
                                                            {rankedViewType === 'lifetime' && (
                                                                <td>
                                                                    <span className="season-chip">
                                                                        {row.season_label || `Musim #${row.season_number || 1}`}
                                                                    </span>
                                                                </td>
                                                            )}
                                                            <td className="score-cell bold">{row.score.toLocaleString()}</td>
                                                            <td>{row.words_typed}</td>
                                                            <td>{row.wpm} WPM</td>
                                                            <td>{row.accuracy}%</td>
                                                            <td>Wave {row.wave_reached}</td>
                                                            <td className="time-cell">{row.created_at}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="mantatype-menu-buttons">
                                        <button className="mantatype-btn-primary" onClick={startGame}>
                                            🚀 Mainkan Sekarang
                                        </button>
                                        <button className="mantatype-btn-secondary" onClick={() => setGameState('MENU')}>
                                            Kembali
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }

    return modalContent;
};

export default MantaTypeGame;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiInstance from '../../utils/axios';
import UserData from '../../views/plugin/UserData';
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
        'MAGER', 'GABUT', 'SOLID!!', 'LOGIS', 'NALAR', 'OPINI', 'SAHIH',
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

// Ambil kata acak berdasarkan tingkat kesulitan / wave
const getRandomWord = (wave) => {
    let pool = WORD_BANK.easy;
    const roll = Math.random();

    if (wave >= 4) {
        if (roll < 0.5) pool = WORD_BANK.hard;
        else if (roll < 0.85) pool = WORD_BANK.medium;
        else pool = WORD_BANK.easy;
    } else if (wave >= 2) {
        if (roll < 0.55) pool = WORD_BANK.medium;
        else if (roll < 0.85) pool = WORD_BANK.easy;
        else pool = WORD_BANK.hard;
    } else {
        if (roll < 0.75) pool = WORD_BANK.easy;
        else pool = WORD_BANK.medium;
    }

    const word = pool[Math.floor(Math.random() * pool.length)];
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
        this.bgmPlaying = false;
        this.bgmTimer = null;
        this.droneOsc = null;
        this.droneGain = null;
        this.bgmGain = null;
        this.bgmFilter = null;
        this.bgmStep = 0;
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
    }

    // 🌊 AMBIENT OCEAN BGM (PROCEDURAL RETRO UNDERWATER LOOP)
    startBGM() {
        if (this.isMuted || this.bgmPlaying) return;
        this.init();
        if (!this.ctx) return;

        this.bgmPlaying = true;
        this.bgmStep = 0;

        try {
            this.bgmGain = this.ctx.createGain();
            this.bgmGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
            this.bgmGain.connect(this.ctx.destination);

            this.bgmFilter = this.ctx.createBiquadFilter();
            this.bgmFilter.type = 'lowpass';
            this.bgmFilter.frequency.setValueAtTime(500, this.ctx.currentTime);
            this.bgmFilter.connect(this.bgmGain);

            // Sub-Bass Ocean Drone (55Hz)
            this.droneOsc = this.ctx.createOscillator();
            this.droneOsc.type = 'sine';
            this.droneOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

            this.droneGain = this.ctx.createGain();
            this.droneGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

            this.droneOsc.connect(this.droneGain);
            this.droneGain.connect(this.bgmFilter);
            this.droneOsc.start();

            // Tangga Nada Pentatonik Aquatik
            const notes = [
                130.81, 155.56, 174.61, 196.00, 233.08,
                261.63, 311.13, 349.23, 392.00, 466.16, 523.25
            ];

            const sequence = [
                0, 3, 5, 7, 5, 3, 8, 7,
                1, 4, 6, 8, 6, 4, 9, 7
            ];

            const stepDuration = 0.24;

            const scheduleBGM = () => {
                if (!this.bgmPlaying || !this.ctx || this.isMuted) return;
                const now = this.ctx.currentTime;

                for (let i = 0; i < 4; i++) {
                    const noteIdx = sequence[this.bgmStep % sequence.length];
                    const freq = notes[noteIdx % notes.length];
                    const noteTime = now + i * stepDuration;

                    const osc = this.ctx.createOscillator();
                    const noteGain = this.ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, noteTime);

                    noteGain.gain.setValueAtTime(0.0001, noteTime);
                    noteGain.gain.exponentialRampToValueAtTime(0.05, noteTime + 0.02);
                    noteGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + stepDuration * 0.9);

                    osc.connect(noteGain);
                    noteGain.connect(this.bgmFilter);

                    osc.start(noteTime);
                    osc.stop(noteTime + stepDuration);

                    // Sonar ping aksen setiap 8 step
                    if (this.bgmStep % 8 === 0) {
                        const sonarOsc = this.ctx.createOscillator();
                        const sonarGain = this.ctx.createGain();
                        sonarOsc.type = 'sine';
                        sonarOsc.frequency.setValueAtTime(780, noteTime);
                        sonarOsc.frequency.exponentialRampToValueAtTime(1100, noteTime + 0.12);

                        sonarGain.gain.setValueAtTime(0.02, noteTime);
                        sonarGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.3);

                        sonarOsc.connect(sonarGain);
                        sonarGain.connect(this.bgmGain);
                        sonarOsc.start(noteTime);
                        sonarOsc.stop(noteTime + 0.3);
                    }

                    this.bgmStep++;
                }

                this.bgmTimer = setTimeout(scheduleBGM, stepDuration * 4 * 1000 - 30);
            };

            scheduleBGM();
        } catch (_) { }
    }

    stopBGM() {
        this.bgmPlaying = false;
        if (this.bgmTimer) {
            clearTimeout(this.bgmTimer);
            this.bgmTimer = null;
        }
        if (this.droneOsc) {
            try { this.droneOsc.stop(); } catch (_) { }
            this.droneOsc = null;
        }
        if (this.bgmGain && this.ctx) {
            try {
                this.bgmGain.gain.setValueAtTime(0, this.ctx.currentTime);
            } catch (_) { }
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

            gain.gain.setValueAtTime(0.09, this.ctx.currentTime);
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

                gain.gain.setValueAtTime(0.12, this.ctx.currentTime + i * 0.03);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.03 + 0.15);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(this.ctx.currentTime + i * 0.03);
                osc.stop(this.ctx.currentTime + i * 0.03 + 0.15);
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

            gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
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

            gain.gain.setValueAtTime(0.16, this.ctx.currentTime);
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

                gain.gain.setValueAtTime(0.14, this.ctx.currentTime + idx * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.12 + 0.2);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(this.ctx.currentTime + idx * 0.12);
                osc.stop(this.ctx.currentTime + idx * 0.12 + 0.2);
            });
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
// 🏷️ RENDER WORD BADGE YANG BESAR, JELAS, & MUDAH DIBACA
// ============================================================================
const drawWordBadge = (ctx, en) => {
    const fullWord = en.word;
    const typedPart = fullWord.substring(0, en.typedIndex);
    const remainingPart = fullWord.substring(en.typedIndex);

    // Font Modern Bold Sans-Serif (Jauh lebih mudah dibaca dibanding monospace tipis)
    ctx.font = '800 18px "Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const totalWidth = ctx.measureText(fullWord).width;
    const badgePadding = 14;
    const badgeWidth = totalWidth + badgePadding * 2;
    const badgeHeight = 32;
    const badgeY = -en.size - 32;

    ctx.save();
    // Shadow & Contrast Pill Box
    ctx.shadowColor = en.isTargeted ? 'rgba(56, 189, 248, 0.85)' : 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = en.isTargeted ? 14 : 6;
    ctx.fillStyle = en.isTargeted ? 'rgba(8, 14, 28, 0.96)' : 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = en.isTargeted ? '#38bdf8' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = en.isTargeted ? 2.5 : 1.5;

    // Rounded Box
    ctx.beginPath();
    ctx.roundRect(-badgeWidth / 2, badgeY, badgeWidth, badgeHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Pointer Triangle Menunjuk ke Karakter Musuh
    ctx.beginPath();
    ctx.moveTo(-7, badgeY + badgeHeight);
    ctx.lineTo(7, badgeY + badgeHeight);
    ctx.lineTo(0, badgeY + badgeHeight + 7);
    ctx.closePath();
    ctx.fillStyle = en.isTargeted ? '#38bdf8' : 'rgba(148, 163, 184, 0.45)';
    ctx.fill();

    ctx.shadowBlur = 0;

    let cursorX = -badgeWidth / 2 + badgePadding;
    const textBaselineY = badgeY + 23;

    // Bagian yang SUDAH diketik (Hijau Emerald Neon Bercahaya)
    if (typedPart.length > 0) {
        ctx.fillStyle = '#34d399';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 10;
        ctx.fillText(typedPart, cursorX, textBaselineY);
        ctx.shadowBlur = 0;

        // Garis bawah hijau penanda progres
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cursorX, textBaselineY + 3);
        ctx.lineTo(cursorX + ctx.measureText(typedPart).width, textBaselineY + 3);
        ctx.stroke();

        cursorX += ctx.measureText(typedPart).width;
    }

    // Bagian yang BELUM diketik (Putih Solid Kontras Tinggi)
    ctx.fillStyle = en.isTargeted ? '#ffffff' : '#f1f5f9';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(remainingPart, cursorX, textBaselineY);
    ctx.shadowBlur = 0;

    // Crosshair Target Reticle di atas badge jika sedang dikunci
    if (en.isTargeted) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, badgeY - 8, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, badgeY - 8, 9, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
};

// ============================================================================
// 🎮 HELPER SPAWN MUSUH (LOGICAL COORDINATE BOUNDS)
// ============================================================================
const spawnEnemy = (width, height, currentWave, initialX = null) => {
    const word = getRandomWord(currentWave);
    let type = 'JELLY';
    let speed = 0.85 + (currentWave - 1) * 0.16 + (Math.random() * 0.2);
    let color = '#38bdf8';
    let size = 26;

    if (word.length >= 8) {
        type = 'HAMMERHEAD';
        speed = 0.7 + (currentWave - 1) * 0.14;
        color = '#f43f5e';
        size = 38;
    } else if (word.length >= 5) {
        type = 'SHARK';
        speed = 1.05 + (currentWave - 1) * 0.18;
        color = '#fbbf24';
        size = 32;
    } else if (currentWave >= 3 && Math.random() < 0.35) {
        type = 'VIPER';
        speed = 1.6 + (currentWave - 1) * 0.22;
        color = '#a855f7';
        size = 24;
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
        isTargeted: false
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
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
    const [guestPlayerName, setGuestPlayerName] = useState('');
    const [isSubmittingScore, setIsSubmittingScore] = useState(false);
    const [scoreSubmitted, setScoreSubmitted] = useState(false);
    const [playerRankInfo, setPlayerRankInfo] = useState(null);

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
        lastSpawnTime: 0,
        spawnInterval: 2800,
        startTime: 0,
        screenShake: 0,
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

    // Muat Sprite & Leaderboard Awal
    useEffect(() => {
        const imgIdle = new Image();
        imgIdle.src = mantaIdleWebp;
        mantaImgRef.current = imgIdle;

        const imgHappy = new Image();
        imgHappy.src = mantaHappyWebp;
        mantaHappyImgRef.current = imgHappy;

        fetchLeaderboard();
    }, []);

    // Hentikan BGM saat modal ditutup
    useEffect(() => {
        if (!isOpen) {
            audio.stopBGM();
        }
    }, [isOpen]);

    const handleToggleMute = () => {
        const nextMute = !isMuted;
        setIsMuted(nextMute);
        audio.isMuted = nextMute;
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
            if (res.data?.leaderboard) {
                setLeaderboard(res.data.leaderboard);
                try {
                    localStorage.setItem('mantatype_local_leaderboard', JSON.stringify(res.data.leaderboard));
                } catch (_) { }
            }
        } catch (err) {
            console.warn('Leaderboard fallback ke localStorage:', err);
            try {
                const localData = localStorage.getItem('mantatype_local_leaderboard');
                if (localData) {
                    setLeaderboard(JSON.parse(localData));
                }
            } catch (_) { }
        } finally {
            setIsLoadingLeaderboard(false);
        }
    };

    const handleSubmitScore = async (e) => {
        if (e) e.preventDefault();
        if (scoreSubmitted || isSubmittingScore) return;

        const g = gameLoopRef.current.stats;
        const accuracy = g.totalKeys > 0 ? ((g.correctKeys / g.totalKeys) * 100) : 100;
        const durationMin = Math.max((performance.now() - gameLoopRef.current.startTime) / 60000, 0.2);
        const wpm = Math.round(g.wordsTyped / durationMin);

        setIsSubmittingScore(true);
        try {
            const payload = {
                score: g.score,
                words_typed: g.wordsTyped,
                accuracy: parseFloat(accuracy.toFixed(2)),
                wpm: wpm,
                wave_reached: g.wave,
                user_id: currentUser?.user_id || currentUser?.id,
                player_name: currentUser?.full_name || currentUser?.username || guestPlayerName || 'Pelaut Manta'
            };

            const res = await apiInstance.post('manta-game/leaderboard/', payload);
            if (res.data?.leaderboard) {
                setLeaderboard(res.data.leaderboard);
                setPlayerRankInfo({
                    rank: res.data.current_rank,
                    is_top_10: res.data.is_top_10
                });
            }
            setScoreSubmitted(true);
        } catch (err) {
            console.warn('Fallback offline leaderboard submission:', err);
            const fallbackEntry = {
                id: Date.now(),
                rank: 1,
                player_name: currentUser?.full_name || currentUser?.username || guestPlayerName || 'Pelaut Manta',
                score: g.score,
                words_typed: g.wordsTyped,
                accuracy: parseFloat(accuracy.toFixed(2)),
                wpm: wpm,
                wave_reached: g.wave,
                is_guest: !currentUser,
                created_at: 'Baru saja'
            };
            const updated = [fallbackEntry, ...leaderboard]
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map((item, idx) => ({ ...item, rank: idx + 1 }));
            setLeaderboard(updated);
            try {
                localStorage.setItem('mantatype_local_leaderboard', JSON.stringify(updated));
            } catch (_) { }
            setScoreSubmitted(true);
            setPlayerRankInfo({ rank: 1, is_top_10: true });
        } finally {
            setIsSubmittingScore(false);
        }
    };

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
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    const startGame = () => {
        audio.init();
        audio.startBGM();

        const canvas = canvasRef.current;
        const rect = canvas ? canvas.getBoundingClientRect() : { width: 900, height: 540 };
        const width = rect.width || 900;
        const height = rect.height || 540;

        const now = performance.now();

        // Spawn 2 musuh awal secara instan di sisi kanan agar langsung aksi!
        const initialEnemies = [
            spawnEnemy(width, height, 1, width * 0.72),
            spawnEnemy(width, height, 1, width * 0.94)
        ];

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
            lastSpawnTime: now,
            spawnInterval: 2800,
            startTime: now,
            screenShake: 0,
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
        setScoreSubmitted(false);
        setPlayerRankInfo(null);
        setGameState('PLAYING');
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

    const defeatEnemy = (g, target) => {
        audio.playWordExplode();
        g.manta.isHappy = true;
        setTimeout(() => { if (g.manta) g.manta.isHappy = false; }, 600);

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
            g.spawnInterval = Math.max(1200, 2800 - (g.stats.wave - 1) * 280);
            g.waveNotice = {
                text: `🌊 WAVE ${g.stats.wave}: KEDALAMAN ${g.stats.depth}M!`,
                timer: 100
            };
        }

        setScore(g.stats.score);
        setWordsTyped(g.stats.wordsTyped);
        setWave(g.stats.wave);
        setDepth(g.stats.depth);

        g.enemies = g.enemies.filter(en => en.id !== target.id);
        g.targetEnemy = null;
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

        if (gameState === 'MENU') {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                startGame();
            }
            return;
        }

        if (gameState !== 'PLAYING') {
            if (e.key === 'Escape' && gameState === 'PAUSED') {
                setGameState('PLAYING');
            }
            return;
        }

        if (e.key === 'Escape') {
            setGameState('PAUSED');
            return;
        }

        const rawKey = e.key;
        const key = rawKey.toUpperCase();

        // Izinkan spasi, huruf A-Z, angka 0-9, atau tanda hubung
        if (rawKey !== ' ' && (key.length !== 1 || !/^[A-Z0-9\-]$/.test(key))) {
            return;
        }

        e.preventDefault();
        const g = gameLoopRef.current;
        g.stats.totalKeys++;
        setTotalKeystrokes(g.stats.totalKeys);

        // Helper untuk memajukan spasi otomatis jika ada di tengah kata
        const advanceSpaces = (target) => {
            while (target && target.typedIndex < target.word.length && target.word[target.typedIndex] === ' ') {
                target.typedIndex++;
            }
        };

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
    }, [isOpen, gameState]);

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

            // 5. UPDATE GAME LOGIC (Saat PLAYING)
            if (gameState === 'PLAYING') {
                if (now - g.lastSpawnTime > g.spawnInterval) {
                    g.enemies.push(spawnEnemy(width, height, g.stats.wave));
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

                for (let i = g.enemies.length - 1; i >= 0; i--) {
                    const en = g.enemies[i];
                    en.x -= en.speed;
                    en.wiggle += 0.05;
                    en.y = en.baseY + Math.sin(en.wiggle) * 10;

                    if (en.x <= g.manta.x + 35) {
                        audio.playLifeLost();
                        g.screenShake = 1.0;
                        g.stats.lives--;
                        g.stats.combo = 0;
                        setLives(g.stats.lives);
                        setCombo(0);

                        if (g.targetEnemy && g.targetEnemy.id === en.id) {
                            g.targetEnemy = null;
                        }
                        g.enemies.splice(i, 1);

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

            // 7. GAMBAR AKTOR UTAMA: MANTA
            const m = g.manta;
            const mantaImg = m.isHappy ? mantaHappyImgRef.current : mantaImgRef.current;
            ctx.save();
            ctx.translate(m.x, m.y);

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
            ctx.restore();

            // 8. GAMBAR KARAKTER MUSUH YANG DETAIL & BADGE KATA BESAR
            g.enemies.forEach(en => {
                ctx.save();
                ctx.translate(en.x, en.y);

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

            // 9. Garis Laser Sonar ke Target Terkunci
            if (g.targetEnemy) {
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
        };
    }, [isOpen, gameState]);

    if (!isOpen) return null;

    const accuracyVal = totalKeystrokes > 0 ? ((correctKeystrokes / totalKeystrokes) * 100).toFixed(1) : '100.0';

    return (
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
                        {/* Audio Mute / Unmute */}
                        <button
                            className={`mantatype-btn-icon ${!isMuted ? 'active-audio' : ''}`}
                            onClick={handleToggleMute}
                            title={isMuted ? 'Nyalakan Musik & Suara Bawah Air' : 'Matikan Suara'}
                            aria-label="Toggle Audio"
                        >
                            {isMuted ? '🔇' : '🔊'}
                        </button>

                        {/* Fullscreen Toggle */}
                        <button
                            className="mantatype-btn-icon"
                            onClick={handleToggleFullscreen}
                            title={isFullscreen ? 'Keluar Layar Penuh' : 'Mode Layar Penuh (Fullscreen)'}
                            aria-label="Toggle Fullscreen"
                        >
                            {isFullscreen ? '🗗' : '⛶'}
                        </button>

                        {/* Switch ke Chat Manta AI */}
                        {onSwitchToChat && (
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
                            <div className="mantatype-card-menu">
                                <h2 className="mantatype-paused-title">⏸️ Permainan Dijeda</h2>
                                <p className="mantatype-paused-desc">Tarik nafas sejenak di kedalaman laut!</p>
                                <div className="mantatype-menu-buttons">
                                    <button className="mantatype-btn-primary" onClick={() => setGameState('PLAYING')}>
                                        ▶️ Lanjutkan Mengetik
                                    </button>
                                    <button className="mantatype-btn-secondary" onClick={startGame}>
                                        🔄 Ulangi Dari Awal
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

                                {!scoreSubmitted ? (
                                    <div className="mantatype-submit-section">
                                        {currentUser ? (
                                            <div className="mantatype-auth-player-info">
                                                <span>Pemain Terverifikasi: <strong>{currentUser.full_name || currentUser.username}</strong></span>
                                                <button
                                                    className="mantatype-btn-primary"
                                                    onClick={handleSubmitScore}
                                                    disabled={isSubmittingScore}
                                                >
                                                    {isSubmittingScore ? 'Menyimpan...' : '⭐ Catat Skor ke Ranked'}
                                                </button>
                                            </div>
                                        ) : (
                                            <form className="mantatype-guest-form" onSubmit={handleSubmitScore}>
                                                <label htmlFor="guestNameInput">
                                                    🎮 Masukkan Nama / Inisial Arcade Anda:
                                                </label>
                                                <div className="mantatype-guest-input-row">
                                                    <input
                                                        id="guestNameInput"
                                                        type="text"
                                                        maxLength={20}
                                                        placeholder="Contoh: KAPTIAN_MANTA"
                                                        value={guestPlayerName}
                                                        onChange={(e) => setGuestPlayerName(e.target.value)}
                                                        required
                                                    />
                                                    <button
                                                        type="submit"
                                                        className="mantatype-btn-primary"
                                                        disabled={isSubmittingScore}
                                                    >
                                                        {isSubmittingScore ? 'Menyimpan...' : 'Kirim Skor 🚀'}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mantatype-rank-success-badge">
                                        ✅ Skor Anda Berhasil Dicatatkan!
                                        {playerRankInfo && (
                                            <span>
                                                Peringkat Anda: <strong>#{playerRankInfo.rank}</strong>
                                                {playerRankInfo.is_top_10 && ' 🎉 Anda Masuk Top 10 High Scores!'}
                                            </span>
                                        )}
                                    </div>
                                )}

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
                    {gameState === 'RANKED' && (
                        <div className="mantatype-screen-overlay">
                            <div className="mantatype-card-ranked">
                                <div className="mantatype-ranked-head">
                                    <h2>🏆 MantaType Ranked Hall of Fame</h2>
                                    <p>Peringkat 10 Pengetik Tercepat & Tertangguh di LMS Setjen DPD RI</p>
                                </div>

                                <div className="mantatype-table-wrapper large">
                                    <table className="mantatype-table">
                                        <thead>
                                            <tr>
                                                <th>Peringkat</th>
                                                <th>Pemain</th>
                                                <th>Skor</th>
                                                <th>Kata</th>
                                                <th>WPM</th>
                                                <th>Akurasi</th>
                                                <th>Wave</th>
                                                <th>Waktu</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaderboard.length === 0 ? (
                                                <tr>
                                                    <td colSpan="8" className="text-center py-4">
                                                        {isLoadingLeaderboard ? 'Sedang menyinkronkan data...' : 'Belum ada skor yang tercatat.'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                leaderboard.map((row, idx) => (
                                                    <tr key={row.id || idx}>
                                                        <td className="rank-cell">
                                                            {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                                                        </td>
                                                        <td className="player-cell">
                                                            <span className="player-name">{row.player_name}</span>
                                                            {!row.is_guest && <span className="auth-badge">ASN DPD</span>}
                                                        </td>
                                                        <td className="score-cell bold">{row.score}</td>
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
                    )}
                </div>
            </div>
        </div>
    );
};

export default MantaTypeGame;

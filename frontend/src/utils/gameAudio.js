// Web Audio API Sound & Background Music Synthesizer for Mini-Games
// 100% Procedural, zero external asset dependencies, works offline reliably

const NOTE = {
    // Bass notes
    C2: 65.41,
    F2: 87.31,
    G2: 98.00,
    A2: 110.00,
    C3: 130.81,
    D3: 146.83,
    E3: 164.81,
    F3: 174.61,
    G3: 196.00,
    A3: 220.00,
    B3: 246.94,

    // Melody notes
    C4: 261.63,
    D4: 293.66,
    E4: 329.63,
    F4: 349.23,
    G4: 392.00,
    A4: 440.00,
    B4: 493.88,
    C5: 523.25,
    D5: 587.33,
    E5: 659.25,
    F5: 698.46,
    G5: 783.99,
    A5: 880.00,
    B5: 987.77,
    C6: 1046.50,
    REST: 0
};

// 64-step joyful, cozy educational game melody (8 bars of 8 steps each)
const BGM_MELODY_SEQUENCE = [
    // Bar 1: C Major (C4 - E4 - G4 - C5)
    { mel: NOTE.E4, bass: NOTE.C3 },
    { mel: NOTE.G4 },
    { mel: NOTE.C5 },
    { mel: NOTE.G4 },
    { mel: NOTE.E4, bass: NOTE.C3 },
    { mel: NOTE.D4 },
    { mel: NOTE.E4 },
    { mel: NOTE.G4 },

    // Bar 2: A Minor (A2 bass, flowing melody)
    { mel: NOTE.C4, bass: NOTE.A2 },
    { mel: NOTE.E4 },
    { mel: NOTE.A4 },
    { mel: NOTE.E4 },
    { mel: NOTE.C4, bass: NOTE.A2 },
    { mel: NOTE.B3 },
    { mel: NOTE.C4 },
    { mel: NOTE.E4 },

    // Bar 3: F Major (F2 bass, bright and hopeful)
    { mel: NOTE.A4, bass: NOTE.F2 },
    { mel: NOTE.C5 },
    { mel: NOTE.F5 },
    { mel: NOTE.C5 },
    { mel: NOTE.A4, bass: NOTE.F2 },
    { mel: NOTE.G4 },
    { mel: NOTE.A4 },
    { mel: NOTE.C5 },

    // Bar 4: G Major (G2 bass, playful turnaround)
    { mel: NOTE.B4, bass: NOTE.G2 },
    { mel: NOTE.D5 },
    { mel: NOTE.G5 },
    { mel: NOTE.D5 },
    { mel: NOTE.B4, bass: NOTE.G2 },
    { mel: NOTE.A4 },
    { mel: NOTE.G4 },
    { mel: NOTE.B4 },

    // Bar 5: C Major Variation (Soaring high)
    { mel: NOTE.G4, bass: NOTE.C3 },
    { mel: NOTE.C5 },
    { mel: NOTE.E5 },
    { mel: NOTE.D5 },
    { mel: NOTE.C5, bass: NOTE.C3 },
    { mel: NOTE.G4 },
    { mel: NOTE.A4 },
    { mel: NOTE.B4 },

    // Bar 6: A Minor Variation
    { mel: NOTE.C5, bass: NOTE.A2 },
    { mel: NOTE.A4 },
    { mel: NOTE.E4 },
    { mel: NOTE.G4 },
    { mel: NOTE.A4, bass: NOTE.A2 },
    { mel: NOTE.C5 },
    { mel: NOTE.B4 },
    { mel: NOTE.A4 },

    // Bar 7: F Major Variation
    { mel: NOTE.A4, bass: NOTE.F2 },
    { mel: NOTE.F4 },
    { mel: NOTE.C5 },
    { mel: NOTE.A4 },
    { mel: NOTE.D5, bass: NOTE.F2 },
    { mel: NOTE.C5 },
    { mel: NOTE.A4 },
    { mel: NOTE.F4 },

    // Bar 8: G Major Ending (Leads back to Bar 1)
    { mel: NOTE.G4, bass: NOTE.G2 },
    { mel: NOTE.B4 },
    { mel: NOTE.D5 },
    { mel: NOTE.B4 },
    { mel: NOTE.G4, bass: NOTE.G2 },
    { mel: NOTE.B4 },
    { mel: NOTE.D5 },
    { mel: NOTE.G5 }
];

class GameSoundEffects {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.isBGMMuted = false;
        this.isBGMPlaying = false;
        this.bgmMasterGain = null;
        this.schedulerTimerId = null;
        this.currentStep = 0;
        this.nextStepTime = 0;
        this.tempo = 114; // Cozy BPM
        this.stepDuration = 60.0 / this.tempo / 2; // Eighth note interval (~263ms)

        try {
            const savedMute = localStorage.getItem("lmsetjen_game_audio_muted");
            this.isMuted = savedMute === "true";
            const savedBGMMute = localStorage.getItem("lmsetjen_game_bgm_muted");
            this.isBGMMuted = savedBGMMute === "true";
        } catch {
            this.isMuted = false;
            this.isBGMMuted = false;
        }
    }

    initContext() {
        if (typeof window === "undefined") return null;
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume();
        }
        return this.ctx;
    }

    // Toggle Sound Effects (SFX)
    toggleMute() {
        this.isMuted = !this.isMuted;
        try {
            localStorage.setItem("lmsetjen_game_audio_muted", String(this.isMuted));
        } catch {}
        return this.isMuted;
    }

    getMuted() {
        return this.isMuted;
    }

    // Toggle Background Music (BGM)
    toggleBGM() {
        this.isBGMMuted = !this.isBGMMuted;
        try {
            localStorage.setItem("lmsetjen_game_bgm_muted", String(this.isBGMMuted));
        } catch {}

        if (this.bgmMasterGain && this.ctx) {
            const now = this.ctx.currentTime;
            this.bgmMasterGain.gain.cancelScheduledValues(now);
            this.bgmMasterGain.gain.setValueAtTime(this.bgmMasterGain.gain.value, now);
            this.bgmMasterGain.gain.linearRampToValueAtTime(this.isBGMMuted ? 0 : 0.12, now + 0.15);
        }

        // If unmuting while playing was requested but not started, start it
        if (!this.isBGMMuted && !this.isBGMPlaying) {
            this.startBGM();
        }

        return !this.isBGMMuted;
    }

    getBGMMuted() {
        return this.isBGMMuted;
    }

    getBGMPlaying() {
        return this.isBGMPlaying && !this.isBGMMuted;
    }

    // =========================================================================
    // BACKGROUND MUSIC (BGM) PROCEDURAL ENGINE
    // =========================================================================

    startBGM() {
        const ctx = this.initContext();
        if (!ctx) return;

        if (this.isBGMPlaying) {
            // Already running
            return;
        }

        this.isBGMPlaying = true;
        this.currentStep = 0;
        this.nextStepTime = ctx.currentTime + 0.05;

        // Setup master gain for BGM
        if (!this.bgmMasterGain) {
            this.bgmMasterGain = ctx.createGain();
            this.bgmMasterGain.connect(ctx.destination);
        }

        const now = ctx.currentTime;
        this.bgmMasterGain.gain.cancelScheduledValues(now);
        this.bgmMasterGain.gain.setValueAtTime(0, now);
        this.bgmMasterGain.gain.linearRampToValueAtTime(this.isBGMMuted ? 0 : 0.12, now + 0.5); // Smooth fade in

        // Lookahead scheduler loop (runs every 30ms to schedule ahead with sample-accurate clock)
        if (this.schedulerTimerId) {
            clearInterval(this.schedulerTimerId);
        }

        this.schedulerTimerId = setInterval(() => {
            if (!this.isBGMPlaying || !this.ctx) return;

            // While there are notes that will need to play within the next 0.12s
            while (this.nextStepTime < this.ctx.currentTime + 0.12) {
                this.scheduleBGMStep(this.currentStep, this.nextStepTime);
                this.nextStepTime += this.stepDuration;
                this.currentStep = (this.currentStep + 1) % BGM_MELODY_SEQUENCE.length;
            }
        }, 30);
    }

    stopBGM() {
        if (!this.isBGMPlaying) return;
        this.isBGMPlaying = false;

        if (this.schedulerTimerId) {
            clearInterval(this.schedulerTimerId);
            this.schedulerTimerId = null;
        }

        if (this.bgmMasterGain && this.ctx) {
            const now = this.ctx.currentTime;
            this.bgmMasterGain.gain.cancelScheduledValues(now);
            this.bgmMasterGain.gain.setValueAtTime(this.bgmMasterGain.gain.value, now);
            this.bgmMasterGain.gain.linearRampToValueAtTime(0, now + 0.4); // Smooth fade out
        }
    }

    // Schedule a single step in the BGM sequence
    scheduleBGMStep(stepIndex, time) {
        if (!this.ctx || !this.bgmMasterGain) return;
        const item = BGM_MELODY_SEQUENCE[stepIndex];
        if (!item) return;

        // 1. Play Lead Kalimba / Marimba Melody Note
        if (item.mel && item.mel > 0) {
            try {
                const osc = this.ctx.createOscillator();
                const noteGain = this.ctx.createGain();

                osc.type = "sine";
                osc.frequency.setValueAtTime(item.mel, time);

                // Add subtle pitch glide or vibrato feel
                noteGain.gain.setValueAtTime(0.001, time);
                noteGain.gain.linearRampToValueAtTime(0.35, time + 0.015);
                noteGain.gain.exponentialRampToValueAtTime(0.001, time + this.stepDuration * 0.9);

                osc.connect(noteGain);
                noteGain.connect(this.bgmMasterGain);

                osc.start(time);
                osc.stop(time + this.stepDuration);
            } catch (e) {}
        }

        // 2. Play Warm Bassline Note (on root beats)
        if (item.bass && item.bass > 0) {
            try {
                const bassOsc = this.ctx.createOscillator();
                const bassGain = this.ctx.createGain();

                bassOsc.type = "triangle";
                bassOsc.frequency.setValueAtTime(item.bass, time);

                bassGain.gain.setValueAtTime(0.001, time);
                bassGain.gain.linearRampToValueAtTime(0.45, time + 0.025);
                bassGain.gain.exponentialRampToValueAtTime(0.001, time + this.stepDuration * 1.8);

                bassOsc.connect(bassGain);
                bassGain.connect(this.bgmMasterGain);

                bassOsc.start(time);
                bassOsc.stop(time + this.stepDuration * 2);
            } catch (e) {}
        }

        // 3. Subtle Rhythm Brush / Hi-Hat Tick on offbeats
        if (stepIndex % 2 === 1) {
            try {
                const tickOsc = this.ctx.createOscillator();
                const tickGain = this.ctx.createGain();

                tickOsc.type = "sine";
                tickOsc.frequency.setValueAtTime(2600, time);

                tickGain.gain.setValueAtTime(0.001, time);
                tickGain.gain.linearRampToValueAtTime(0.06, time + 0.005);
                tickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

                tickOsc.connect(tickGain);
                tickGain.connect(this.bgmMasterGain);

                tickOsc.start(time);
                tickOsc.stop(time + 0.04);
            } catch (e) {}
        }
    }

    // =========================================================================
    // SOUND EFFECTS (SFX)
    // =========================================================================

    playTone(frequency, type = "sine", duration = 0.1, startTimeOffset = 0, gainLevel = 0.15) {
        if (this.isMuted) return;
        const ctx = this.initContext();
        if (!ctx) return;

        try {
            const startTime = ctx.currentTime + startTimeOffset;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(frequency, startTime);

            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.linearRampToValueAtTime(gainLevel, startTime + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration + 0.05);
        } catch (e) {}
    }

    // 1. Memory Match: Card Flip (Light swoosh click)
    playCardFlip() {
        if (this.isMuted) return;
        const ctx = this.initContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(480, now);
            osc.frequency.exponentialRampToValueAtTime(240, now + 0.09);

            gain.gain.setValueAtTime(0.14, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.1);
        } catch (e) {}
    }

    // 2. Memory Match: Card Flip Back / Close (Soft lower click)
    playCardClose() {
        if (this.isMuted) return;
        const ctx = this.initContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.09);
        } catch (e) {}
    }

    // 3. Memory Match: Match Success (Pleasing bright bell chord)
    playCardMatch() {
        this.playTone(523.25, "triangle", 0.18, 0, 0.16);     // C5
        this.playTone(659.25, "triangle", 0.22, 0.08, 0.18);  // E5
        this.playTone(783.99, "sine", 0.28, 0.16, 0.20);      // G5
        this.playTone(1046.50, "sine", 0.35, 0.24, 0.22);     // C6
    }

    // 4. Memory Match: Mismatch (Gentle soft warning blip)
    playCardMismatch() {
        this.playTone(320, "sine", 0.12, 0, 0.12);
        this.playTone(240, "sine", 0.16, 0.09, 0.12);
    }

    // 5. Game Start (Cheerful upbeat intro fanfare)
    playGameStart() {
        this.playTone(440.00, "triangle", 0.14, 0, 0.16);     // A4
        this.playTone(554.37, "triangle", 0.16, 0.10, 0.18);  // C#5
        this.playTone(659.25, "sine", 0.25, 0.20, 0.22);      // E5
    }

    // 6. Crossword: Letter typing / cell key
    playKeyTick() {
        this.playTone(820, "sine", 0.04, 0, 0.08);
    }

    // 7. Crossword: Clue selection change
    playSelect() {
        this.playTone(587.33, "triangle", 0.07, 0, 0.1);
    }

    // 8. Word Search: Tile cell select (Crisp water droplet)
    playTileSelect() {
        if (this.isMuted) return;
        const ctx = this.initContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(540, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.07);
        } catch (e) {}
    }

    // 9. Word Search: Tile cell deselect
    playTileDeselect() {
        this.playTone(380, "sine", 0.05, 0, 0.09);
    }

    // 10. Word Search: Word Found (Triumphant sparkle)
    playWordFound() {
        this.playTone(659.25, "sine", 0.15, 0, 0.18);
        this.playTone(830.61, "sine", 0.20, 0.08, 0.20);
        this.playTone(987.77, "sine", 0.30, 0.16, 0.22);
    }

    // 11. Anagram: Tile dropped into slot (Snappy wood clack)
    playTileDrop() {
        this.playTone(460, "triangle", 0.06, 0, 0.14);
    }

    // 12. Anagram: Tile removed from slot (Light pop)
    playTileRemove() {
        this.playTone(340, "sine", 0.05, 0, 0.1);
    }

    // 13. Anagram: Word correct
    playCorrectChime() {
        this.playTone(523.25, "sine", 0.12, 0, 0.18);
        this.playTone(659.25, "sine", 0.15, 0.09, 0.20);
        this.playTone(783.99, "triangle", 0.25, 0.18, 0.22);
    }

    // 14. Anagram: Word wrong
    playWrongBuzzer() {
        this.playTone(220, "sawtooth", 0.15, 0, 0.12);
        this.playTone(196, "sawtooth", 0.18, 0.12, 0.12);
    }

    // 15. Victory Fanfare (Game Passed / Score >= 70%)
    playVictoryFanfare() {
        this.playTone(523.25, "triangle", 0.18, 0, 0.20);    // C5
        this.playTone(659.25, "triangle", 0.18, 0.14, 0.22); // E5
        this.playTone(783.99, "triangle", 0.22, 0.28, 0.24); // G5
        this.playTone(1046.50, "sine", 0.45, 0.44, 0.26);    // C6
    }

    // 16. Try Again Jingle (Score < 70%)
    playTryAgainMelody() {
        this.playTone(440, "sine", 0.2, 0, 0.15);
        this.playTone(392, "sine", 0.25, 0.18, 0.15);
        this.playTone(349.23, "sine", 0.35, 0.36, 0.16);
    }
}

const gameAudio = new GameSoundEffects();
export default gameAudio;

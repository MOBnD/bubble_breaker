        let soundEnabled = localStorage.getItem('bubblebreaker.sound') !== 'off';
        let audioVolume = Number(localStorage.getItem('bubblebreaker.volume') || 0.45);
        let bgmEnabled = localStorage.getItem('bubblebreaker.bgm') !== 'off';
        let bgmType = localStorage.getItem('bubblebreaker.bgmType') || '宇宙遊泳.mp3';
        let bgmAutoNext = localStorage.getItem('bubblebreaker.bgmAutoNext') === 'on';
        let bgmTransition = localStorage.getItem('bubblebreaker.bgmTransition') || 'persist';
        let audioContext = null;
        let bgmAudio = null;
        const bgmTracks = ['宇宙遊泳.mp3', '星間宇宙.mp3', 'エッジワース・カイパーベルト.mp3', 'Far_away_from_the_Earth.mp3'];
        let bgmTrackIndex = 0;
        let zoomSound = null;
        function ensureAudioContext() {
            audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') audioContext.resume();
            return audioContext;
        }
        function playSound(kind = 'click') {
            if (!soundEnabled) return;
            try {
                ensureAudioContext();
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                const now = audioContext.currentTime;
                const presets = { click: [520, 0.06], ui: [740, 0.09], zoom: [180, 0.24], warp: [90, 0.5], error: [120, 0.18] };
                const [frequency, duration] = presets[kind] || presets.click;
                oscillator.type = kind === 'warp' ? 'sawtooth' : 'sine';
                oscillator.frequency.setValueAtTime(frequency, now);
                oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * (kind === 'zoom' ? 2.2 : 0.72)), now + duration);
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.045 * audioVolume, now + 0.012);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
                oscillator.connect(gain).connect(audioContext.destination);
                oscillator.start(now);
                oscillator.stop(now + duration + 0.02);
            } catch (_) { /* Audio API非対応環境では無音で継続 */ }
        }
        function startZoomSound(kind = 'zoom') {
            if (!soundEnabled || zoomSound) return;
            try {
                ensureAudioContext();
                const blackHoleOscillator = audioContext.createOscillator();
                const blackHoleGain = audioContext.createGain();
                blackHoleOscillator.type = 'sine';
                blackHoleOscillator.frequency.setValueAtTime(28, audioContext.currentTime);
                blackHoleGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
                blackHoleOscillator.connect(blackHoleGain).connect(audioContext.destination);
                blackHoleOscillator.start();
                zoomSound = { blackHoleOscillator, blackHoleGain, startedAt: performance.now(), kind };
            } catch (_) { zoomSound = null; }
        }
        function updateZoomSound(intensity = 0.5) {
            if (!zoomSound || !audioContext) return;
            const now = audioContext.currentTime;
            const value = Math.min(1, Math.max(0.05, intensity));
            zoomSound.blackHoleOscillator.frequency.setTargetAtTime(28 + value * 120, now, 0.12);
            zoomSound.blackHoleGain.gain.setTargetAtTime((0.006 + value * value * 0.11) * audioVolume, now, 0.12);
        }
        function stopZoomSound() {
            if (!zoomSound || !audioContext) return;
            const current = zoomSound;
            zoomSound = null;
            const now = audioContext.currentTime;
            current.blackHoleGain.gain.cancelScheduledValues(now);
            current.blackHoleGain.gain.setTargetAtTime(0.0001, now, 0.12);
            try { current.blackHoleOscillator.stop(now + 0.3); } catch (_) { }
        }
        function stopBackgroundMusic() {
            if (!bgmAudio) return;
            bgmAudio.pause();
            bgmAudio.currentTime = 0;
        }
        function startBackgroundMusic() {
            if (!bgmEnabled) return;
            try {
                bgmAudio = bgmAudio || document.getElementById('bgm-audio');
                const typeIndex = Math.max(0, bgmTracks.indexOf(bgmType));
                if (bgmTrackIndex === 0 && typeIndex !== 0) bgmTrackIndex = typeIndex;
                const selected = `BGM/${bgmTracks[bgmTrackIndex % bgmTracks.length]}`;
                const selectedUrl = new URL(selected, document.baseURI).href;
                if (bgmAudio.src !== selectedUrl) bgmAudio.src = selectedUrl;
                bgmAudio.volume = Math.max(0, Math.min(1, audioVolume * 0.55));
                bgmAudio.loop = !bgmAutoNext;
                bgmAudio.play().catch(() => { /* ブラウザの自動再生制限は次の操作で再試行 */ });
            } catch (_) { bgmAudio = null; }
        }

        // 画面左上に一時的なメッセージ（トースト通知）を表示する関数
        function showToast(msg) {
            const toast = document.getElementById('toast');
            toast.innerText = msg;
            toast.classList.remove('opacity-0');
            // 3秒後にフェードアウトさせる
            setTimeout(() => toast.classList.add('opacity-0'), 3000);
        }


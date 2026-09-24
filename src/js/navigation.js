        // HTML側のUI表示を切り替える関数
        // .screen-active クラスを付け外しすることで、フェードイン・フェードアウトを実現
        function switchScreen(screenName) {
            if (screenName !== 'GROUP' && screenName !== 'SINGLE') playSound('ui');
            document.querySelectorAll('.screen-container').forEach(el => {
                el.classList.remove('screen-active');
                el.classList.add('screen-hidden');
            });
            document.getElementById(`screen-${screenName.toLowerCase()}`).classList.remove('screen-hidden');
            document.getElementById(`screen-${screenName.toLowerCase()}`).classList.add('screen-active');
            state.screen = screenName;
            if (typeof window.onBubbleScreenChanged === 'function') window.onBubbleScreenChanged(screenName);
        }


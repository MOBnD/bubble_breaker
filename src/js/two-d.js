        // Dedicated 2D exploration renderer. It shares application data/state with
        // the 3D renderer but never renders Three.js objects while active.
        const TWO_D_SVG_NS = 'http://www.w3.org/2000/svg';
        const twoDContainer = document.getElementById('exploration-2d');
        const twoDStage = document.getElementById('exploration-2d-stage');
        const twoDBackground = twoDContainer && twoDContainer.querySelector('.exploration-2d-background');
        const twoDLoading = document.getElementById('exploration-2d-loading');
        const twoDLoadingStatus = document.getElementById('exploration-2d-loading-status');
        const twoDRoute = document.getElementById('exploration-2d-route');
        const twoDVessel = document.getElementById('exploration-2d-vessel');
        let twoDTransitionTimer = null;
        const twoDRouteLength = twoDRoute ? twoDRoute.getTotalLength() : 0;

        function createTwoDSvgElement(name, attributes = {}, text = '') {
            const element = document.createElementNS(TWO_D_SVG_NS, name);
            Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
            if (text) element.textContent = text;
            return element;
        }

        function getTwoDColor(bubble) {
            return bubble && (bubble.htmlColor || bubble.color) || '#6ee7ff';
        }

        function setTwoDViewport() {
            const compact = window.innerWidth <= 720;
            if (twoDStage) twoDStage.setAttribute('viewBox', compact ? '0 0 700 1200' : '0 0 1000 700');
            return compact;
        }

        function getTwoDLayout(group) {
            const compact = setTwoDViewport();
            const bubbles = (group && Array.isArray(group.bubbles) ? group.bubbles : []).filter(isRenderableBubbleData);
            if (!bubbles.length) return [];
            arrangeBubblePositions(group);
            const positions = bubbles.map((bubble, index) => {
                const source = Array.isArray(bubble.pos) ? bubble.pos : [Math.cos(index) * 8, Math.sin(index) * 8, 0];
                return { bubble, x: Number(source[0]) || 0, y: Number(source[2]) || 0, fallbackY: Number(source[1]) || 0 };
            });
            const zSpread = Math.max(...positions.map(item => item.y)) - Math.min(...positions.map(item => item.y));
            if (zSpread < 1) positions.forEach(item => { item.y = item.fallbackY; });
            const minX = Math.min(...positions.map(item => item.x));
            const maxX = Math.max(...positions.map(item => item.x));
            const minY = Math.min(...positions.map(item => item.y));
            const maxY = Math.max(...positions.map(item => item.y));
            const left = compact ? 95 : 240;
            const right = compact ? 605 : 710;
            const top = compact ? 200 : 115;
            const bottom = compact ? 780 : 600;
            const spanX = Math.max(1, maxX - minX);
            const spanY = Math.max(1, maxY - minY);
            const layout = positions.map((item, index) => {
                const baseRadius = Math.max(43, Math.min(94, 36 + Math.sqrt(Math.max(1, Number(item.bubble.size) || 1)) * 7));
                const radius = compact ? Math.max(34, Math.min(67, baseRadius * 0.75)) : baseRadius;
                return {
                    bubble: item.bubble,
                    radius,
                    x: left + ((item.x - minX) / spanX) * (right - left),
                    y: top + ((item.y - minY) / spanY) * (bottom - top),
                    index
                };
            });
            // Resolve projection overlaps without changing the stable data-derived order.
            for (let iteration = 0; iteration < 18; iteration += 1) {
                for (let leftIndex = 0; leftIndex < layout.length; leftIndex += 1) {
                    for (let rightIndex = leftIndex + 1; rightIndex < layout.length; rightIndex += 1) {
                        const a = layout[leftIndex];
                        const b = layout[rightIndex];
                        let dx = b.x - a.x;
                        let dy = b.y - a.y;
                        let distance = Math.hypot(dx, dy);
                        const minimum = a.radius + b.radius + 20;
                        if (distance >= minimum) continue;
                        if (distance < 0.01) {
                            const angle = (leftIndex * 2.399 + rightIndex) % (Math.PI * 2);
                            dx = Math.cos(angle);
                            dy = Math.sin(angle);
                            distance = 1;
                        }
                        const push = (minimum - distance) * 0.5;
                        const nx = dx / distance;
                        const ny = dy / distance;
                        a.x -= nx * push;
                        a.y -= ny * push;
                        b.x += nx * push;
                        b.y += ny * push;
                    }
                }
                layout.forEach(item => {
                    item.x = Math.max(left + item.radius, Math.min(right - item.radius, item.x));
                    item.y = Math.max(top + item.radius, Math.min(bottom - item.radius, item.y));
                });
            }
            return layout;
        }

        function appendTwoDChildPreview(parent, bubble, radius) {
            const childGroup = bubble && bubble.childId && activeDB && activeDB[bubble.childId];
            if (!childGroup || !Array.isArray(childGroup.bubbles)) return;
            const children = childGroup.bubbles.filter(isRenderableBubbleData).slice(0, 8);
            if (!children.length) return;
            const visibleChildren = children.slice();
            while (visibleChildren.length < 5) visibleChildren.push(children[visibleChildren.length % children.length]);
            visibleChildren.forEach((child, index) => {
                const angle = -Math.PI / 2 + index * (Math.PI * 2 / visibleChildren.length);
                const ring = radius * (index % 2 ? 0.43 : 0.31);
                parent.appendChild(createTwoDSvgElement('circle', {
                    class: 'bubble-2d-child',
                    cx: Math.cos(angle) * ring,
                    cy: Math.sin(angle) * ring,
                    r: Math.max(4, Math.min(9, radius * 0.09)),
                    style: `--child-color: ${getTwoDColor(child)}`
                }));
            });
        }

        function createTwoDBubble(item, options = {}) {
            const bubble = item.bubble;
            const group = createTwoDSvgElement('g', {
                class: `bubble-2d${options.single ? ' bubble-2d-single' : ''}${options.current ? ' is-current' : ''}${options.level === 'leaf' ? ' is-leaf' : ''}`,
                transform: `translate(${item.x} ${item.y})`,
                tabindex: 0,
                role: 'button',
                'aria-label': `${bubble.name}を開く`,
                style: `--bubble-color: ${getTwoDColor(bubble)}`
            });
            group.appendChild(createTwoDSvgElement('title', {}, bubble.name));
            group.appendChild(createTwoDSvgElement('circle', { class: 'bubble-2d-ring', r: item.radius * 1.08 }));
            group.appendChild(createTwoDSvgElement('circle', { class: 'bubble-2d-shell', r: item.radius }));
            appendTwoDChildPreview(group, bubble, item.radius);
            const label = options.level === 'leaf' && window.BubbleBreakerText
                ? window.BubbleBreakerText.formatBubbleDisplayName(bubble.name)
                : String(bubble.name || '');
            group.appendChild(createTwoDSvgElement('text', { class: 'bubble-2d-label', y: options.single ? item.radius + 35 : 0 }, label));
            const activate = event => {
                if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                if (options.single) loadAnalysis();
                else selectBubble(bubble);
            };
            group.addEventListener('click', activate);
            group.addEventListener('keydown', activate);
            return group;
        }

        function setTwoDStageContent(content, transitionType = 'instant') {
            if (!twoDStage) return;
            if (twoDTransitionTimer) window.clearTimeout(twoDTransitionTimer);
            twoDStage.replaceChildren(content);
            const transitionClass = transitionType === 'zoomIn' ? 'enter-deeper' : transitionType === 'zoomOut' ? 'enter-parent' : '';
            if (transitionClass) {
                content.classList.add(transitionClass);
                twoDStage.classList.add('is-transitioning');
                twoDTransitionTimer = window.setTimeout(() => {
                    content.classList.remove(transitionClass);
                    twoDStage.classList.remove('is-transitioning');
                }, 420);
            }
        }

        window.renderTwoDGroup = function(group, transitionType = 'instant') {
            if (!twoDStage || explorationViewMode !== '2d' || !group) return;
            twoDLoading.hidden = true;
            twoDStage.hidden = false;
            const content = createTwoDSvgElement('g', { class: 'bubble-2d-group', 'data-group-id': group.id });
            const isLowestLayer = group.level === 'leaf'
                || (Boolean(group.parentId) && !group.bubbles.some(bubble => bubble.childId && activeDB[bubble.childId]));
            getTwoDLayout(group).forEach(item => content.appendChild(createTwoDBubble(item, { level: isLowestLayer ? 'leaf' : group.level })));
            setTwoDStageContent(content, transitionType);
        };

        window.renderTwoDSingle = function(bubble, group) {
            if (!twoDStage || explorationViewMode !== '2d' || !bubble) return;
            const compact = setTwoDViewport();
            twoDLoading.hidden = true;
            twoDStage.hidden = false;
            const content = createTwoDSvgElement('g', { class: 'bubble-2d-group', 'data-bubble-id': bubble.id });
            content.appendChild(createTwoDBubble({ bubble, x: 350, y: compact ? 610 : 350, radius: 142 }, {
                level: group && group.level,
                single: true,
                current: true
            }));
            setTwoDStageContent(content, 'zoomIn');
        };

        window.renderTwoDAnalysis = function(bubble, group) {
            if (!twoDStage || explorationViewMode !== '2d' || !bubble) return;
            const compact = setTwoDViewport();
            const content = createTwoDSvgElement('g', { class: 'bubble-2d-group' });
            const visual = createTwoDBubble({ bubble, x: compact ? 350 : 500, y: compact ? 610 : 350, radius: 118 }, {
                level: group && group.level,
                single: true,
                current: true
            });
            visual.style.pointerEvents = 'none';
            visual.setAttribute('opacity', '.42');
            content.appendChild(visual);
            setTwoDStageContent(content, 'instant');
        };

        window.onBubbleScreenChanged = function(screenName) {
            const loadingInTwoD = typeof loadingAnimation !== 'undefined'
                && loadingAnimation
                && loadingAnimation.mode === '2d';
            if (explorationViewMode !== '2d' || !twoDStage || loadingInTwoD) return;
            if (screenName === 'GROUP') {
                if (twoDStage.firstElementChild?.getAttribute('data-group-id') !== String(state.groupData?.id)) {
                    window.renderTwoDGroup(state.groupData);
                }
            } else if (screenName === 'SINGLE') {
                if (twoDStage.firstElementChild?.getAttribute('data-bubble-id') !== String(state.bubbleData?.id)) {
                    window.renderTwoDSingle(state.bubbleData, state.groupData);
                }
            }
            else if (screenName === 'ANALYSIS' || screenName === 'DETAIL') window.renderTwoDAnalysis(state.bubbleData, state.groupData);
            else twoDStage.replaceChildren();
        };

        window.syncTwoDExplorationMode = function(mode) {
            const active = mode === '2d';
            document.body.classList.toggle('mode-2d', active);
            if (!twoDContainer) return;
            twoDContainer.hidden = !active;
            twoDContainer.setAttribute('aria-hidden', String(!active));
            if (twoDBackground) {
                const visible = window.__bubbleBreakerNGC3324Visible !== false;
                twoDBackground.style.backgroundImage = visible ? `url("${window.__NGC3324_TEXTURE__}")` : 'none';
            }
            if (active) {
                controls.enabled = false;
                window.onBubbleScreenChanged(state.screen);
            } else {
                if (twoDStage) twoDStage.replaceChildren();
                if (twoDLoading) twoDLoading.hidden = true;
                if (state.screen === 'GROUP' || state.screen === 'SINGLE') controls.enabled = true;
                applyExplorationViewControls();
            }
        };

        window.startTwoDLoadingAnimation = function() {
            if (!twoDContainer || !twoDLoading) return false;
            twoDContainer.hidden = false;
            twoDStage.hidden = true;
            twoDLoading.hidden = false;
            if (twoDLoadingStatus) twoDLoadingStatus.textContent = 'テーマに関係する情報を集めています…';
            loadingAnimation = {
                mode: '2d',
                apiReady: false,
                onReady: null,
                startedAt: performance.now(),
                completionStartedAt: null,
                startProgress: 0
            };
            isDiving = true;
            return true;
        };

        window.updateTwoDLoadingAnimation = function(now = performance.now()) {
            if (!loadingAnimation || loadingAnimation.mode !== '2d' || !twoDRoute || !twoDVessel) return false;
            const length = twoDRouteLength;
            const elapsed = now - loadingAnimation.startedAt;
            let progress = ((elapsed % 5200) / 5200) * 0.82;
            if (loadingAnimation.apiReady) {
                if (!loadingAnimation.completionStartedAt) {
                    loadingAnimation.completionStartedAt = now;
                    loadingAnimation.startProgress = progress;
                    if (twoDLoadingStatus) twoDLoadingStatus.textContent = '探索結果を整えて、目的の世界へ移動しています…';
                }
                const completion = Math.min(1, (now - loadingAnimation.completionStartedAt) / 480);
                progress = loadingAnimation.startProgress + (1 - loadingAnimation.startProgress) * (completion * completion * (3 - 2 * completion));
                if (completion >= 1) {
                    const ready = loadingAnimation.onReady;
                    loadingAnimation = null;
                    isDiving = false;
                    twoDLoading.hidden = true;
                    twoDStage.hidden = false;
                    if (typeof ready === 'function') ready();
                    return true;
                }
            }
            const point = twoDRoute.getPointAtLength(Math.max(0, Math.min(length, progress * length)));
            twoDVessel.setAttribute('cx', point.x.toFixed(2));
            twoDVessel.setAttribute('cy', point.y.toFixed(2));
            return true;
        };

        let twoDResizeTimer = null;
        window.addEventListener('resize', () => {
            if (explorationViewMode !== '2d') return;
            window.clearTimeout(twoDResizeTimer);
            twoDResizeTimer = window.setTimeout(() => {
                if (state.screen === 'GROUP') window.renderTwoDGroup(state.groupData);
                else if (state.screen === 'SINGLE') window.renderTwoDSingle(state.bubbleData, state.groupData);
                else if (state.screen === 'ANALYSIS' || state.screen === 'DETAIL') window.renderTwoDAnalysis(state.bubbleData, state.groupData);
            }, 120);
        });

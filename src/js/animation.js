        // ==========================================
        // === 6. アニメーションループ (毎フレームの描画更新) ===
        // ==========================================
        const clock = new THREE.Clock(); // 経過時間を計るためのクラス
        let lastAnimationTimestamp = performance.now();
        let universeRevealState = null;
        let cosmicUpdateBucket = 0;
        const cometForwardAxis = new THREE.Vector3(1, 0, 0);
        const labelProjectionScratch = new THREE.Vector3();

        function applyCachedVisualFade(visual, fade) {
            if (!visual) return;
            if (!visual.userData.fadeMaterials) {
                const materials = [];
                visual.traverse(child => {
                    if (!child.material) return;
                    (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => {
                        if (!materials.some(item => item.material === material)) {
                            materials.push({ material, opacity: material.opacity });
                        }
                    });
                });
                visual.userData.fadeMaterials = materials;
                visual.userData.lastFade = Number.NaN;
            }
            if (Math.abs((visual.userData.lastFade || 0) - fade) < 0.003) return;
            visual.userData.fadeMaterials.forEach(item => {
                item.material.opacity = item.opacity * fade;
            });
            visual.userData.lastFade = fade;
        }

        function getLoadingBlackHoleTarget(index) {
            if (galaxyBlackHoleTargets[index]) {
                const target = galaxyBlackHoleTargets[index];
                if (target.galaxy && target.blackHole) target.blackHole.getWorldPosition(target.position);
                return target;
            }
            if (loadingBlackHoles[index]) return { position: loadingBlackHoles[index], galaxy: null, blackHole: null };
            return { position: new THREE.Vector3(0, 0, -90), galaxy: null, blackHole: null };
        }

        function getEventHorizonRadius(target) {
            return target.blackHole?.userData?.eventHorizonRadius || 10;
        }

        function getWarpObstacleTargets() {
            return galaxyBlackHoleTargets.map((target, index) => {
                const position = target.blackHole ? target.blackHole.getWorldPosition(new THREE.Vector3()) : target.position.clone();
                target.position.copy(position);
                return { index, position, radius: getEventHorizonRadius(target) };
            });
        }

        function getWarpCandidateStops(destinationIndex) {
            const candidates = [];
            const obstacles = getWarpObstacleTargets();
            galaxyBlackHoleTargets.forEach((target, index) => {
                if (index === destinationIndex) return;
                const radius = target.galaxy?.userData?.galaxyRadius || 300;
                candidates.push({
                    type: 'galaxy',
                    sourceIndex: index,
                    anchor: target.position.clone(),
                    flybyRadius: Math.max(760, radius * 1.45)
                });
            });
            cosmicSystems.forEach((entry, index) => {
                candidates.push({
                    type: 'stellar-system',
                    sourceIndex: index,
                    anchor: entry.system.getWorldPosition(new THREE.Vector3()),
                    flybyRadius: Math.max(320, entry.scale * 5)
                });
            });
            const safeRadius = Math.max(680, obstacles.reduce((maximum, obstacle) => Math.max(maximum, obstacle.radius * 8), 0));
            const safeCandidates = candidates.filter(candidate => obstacles.every(obstacle => {
                if (candidate.type === 'galaxy' && obstacle.index === candidate.sourceIndex) return true;
                return candidate.anchor.distanceTo(obstacle.position) > Math.max(80, safeRadius - candidate.flybyRadius);
            }));
            return {
                candidates: safeCandidates,
                galaxyCandidates: safeCandidates.filter(candidate => candidate.type === 'galaxy'),
                stellarCandidates: safeCandidates.filter(candidate => candidate.type === 'stellar-system'),
                obstacles,
                safeRadius
            };
        }

        function routeAvoidsBlackHoles(route, destinationIndex, safeRadius, preEntryProgress = 1, obstacles = getWarpObstacleTargets()) {
            const destinationApproachStart = Math.max(
                0.7,
                preEntryProgress - Math.min(0.16, safeRadius * 1.5 / Math.max(1, route.getLength()))
            );
            for (let sampleIndex = 0; sampleIndex <= 120; sampleIndex++) {
                const point = route.getPoint(sampleIndex / 120);
                for (const obstacle of obstacles) {
                    // The route intentionally enters the destination event horizon.
                    // Exempt only its final approach; earlier accidental passes remain unsafe.
                    if (obstacle.index === destinationIndex && sampleIndex / 120 >= destinationApproachStart) continue;
                    if (point.distanceTo(obstacle.position) < safeRadius) return false;
                }
            }
            return true;
        }

        function selectWarpCandidates(candidatePools, desiredCount, start, destination, variant = 0) {
            const selected = [];
            const used = new Set();
            let cursor = start.clone();
            while (selected.length < desiredCount && used.size < candidatePools.candidates.length) {
                const needsGalaxy = selected.length === 1
                    && candidatePools.galaxyCandidates.length
                    && !selected.some(candidate => candidate.type === 'galaxy');
                const needsStellar = (selected.length === 0 || selected.length === 2)
                    && candidatePools.stellarCandidates.length > selected.filter(candidate => candidate.type === 'stellar-system').length;
                const pool = needsGalaxy
                    ? candidatePools.galaxyCandidates
                    : needsStellar ? candidatePools.stellarCandidates : candidatePools.candidates;
                const ranked = [];
                const directDistance = Math.max(1, cursor.distanceTo(destination));
                const directDirection = destination.clone().sub(cursor).normalize();
                pool.forEach(candidate => {
                    const candidateIndex = candidatePools.candidates.indexOf(candidate);
                    if (candidateIndex < 0 || used.has(candidateIndex)) return;
                    const toCandidate = candidate.anchor.clone().sub(cursor);
                    const candidateDistance = Math.max(1, toCandidate.length());
                    const detourRatio = (candidateDistance + candidate.anchor.distanceTo(destination)) / directDistance;
                    const headingPenalty = 1 - directDirection.dot(toCandidate.normalize());
                    const separationPenalty = selected.length
                        ? Math.max(0, 4200 - Math.min(...selected.map(stop => stop.anchor.distanceTo(candidate.anchor)))) / 4200
                        : 0;
                    const score = detourRatio * 0.72 + headingPenalty * 0.2 + separationPenalty * 0.5
                        + candidateIndex * 0.00001;
                    ranked.push({ candidate, index: candidateIndex, score });
                });
                ranked.sort((a, b) => a.score - b.score);
                const best = ranked[Math.min(variant, ranked.length - 1)];
                if (!best) break;
                used.add(best.index);
                selected.push(best.candidate);
                cursor = best.candidate.anchor;
            }
            return selected;
        }

        function getSwingByAxis(incomingDirection, outgoingDirection) {
            const axis = new THREE.Vector3().crossVectors(incomingDirection, outgoingDirection);
            if (axis.lengthSq() < 0.0001) {
                axis.copy(new THREE.Vector3(0, 1, 0).cross(incomingDirection));
                if (axis.lengthSq() < 0.0001) axis.set(1, 0, 0).cross(incomingDirection);
            }
            return axis.normalize();
        }

        function createSmoothBezierSegment(start, end, startTangent, endTangent) {
            const distance = start.distanceTo(end);
            if (distance < 0.001) return new THREE.LineCurve3(start.clone(), end.clone());
            const safeStartTangent = startTangent.clone().normalize();
            const safeEndTangent = endTangent.clone().normalize();
            const chord = end.clone().sub(start).normalize();
            const startAlignment = Math.max(0.18, (safeStartTangent.dot(chord) + 1) * 0.5);
            const endAlignment = Math.max(0.18, (safeEndTangent.dot(chord) + 1) * 0.5);
            const handle = Math.min(distance * 0.28, 1200);
            const controlStart = start.clone().addScaledVector(safeStartTangent, handle * startAlignment);
            const controlEnd = end.clone().addScaledVector(safeEndTangent, -handle * endAlignment);
            return new THREE.CubicBezierCurve3(start.clone(), controlStart, controlEnd, end.clone());
        }

        function createSwingByArc(candidate, previousPoint, nextPoint, radiusScale = 1, sideSign = 1) {
            const anchor = candidate.anchor;
            const incomingDirection = anchor.clone().sub(previousPoint).normalize();
            const outgoingDirection = nextPoint.clone().sub(anchor).normalize();
            const axis = getSwingByAxis(incomingDirection, outgoingDirection);
            const turnAngle = Math.acos(THREE.MathUtils.clamp(incomingDirection.dot(outgoingDirection), -1, 1));
            const radius = candidate.flybyRadius * radiusScale;
            const flybyTangent = incomingDirection.clone().add(outgoingDirection);
            if (flybyTangent.lengthSq() < 0.06) flybyTangent.copy(incomingDirection);
            flybyTangent.normalize();
            const side = new THREE.Vector3().crossVectors(axis, flybyTangent).normalize().multiplyScalar(sideSign);
            const flybyPosition = anchor.clone().addScaledVector(side, radius * 1.22);
            const entryPoint = flybyPosition.clone().addScaledVector(incomingDirection, -radius * 2.5);
            const exitPoint = flybyPosition.clone().addScaledVector(outgoingDirection, radius * 2.5);
            return {
                arcPoints: [entryPoint, flybyPosition, exitPoint],
                entryPoint,
                exitPoint,
                exitRadial: exitPoint.clone().sub(anchor).normalize(),
                entryTangent: incomingDirection,
                exitTangent: outgoingDirection,
                anchor: anchor.clone(),
                flybyPosition,
                flybyRadius: radius,
                swingByAngle: turnAngle,
                axis: axis.clone().multiplyScalar(sideSign)
            };
        }

        function getRouteMinimumDistance(route, anchor, samples = 48) {
            let minimum = Infinity;
            for (let sampleIndex = 0; sampleIndex <= samples; sampleIndex++) {
                minimum = Math.min(minimum, route.getPoint(sampleIndex / samples).distanceTo(anchor));
            }
            return minimum;
        }

        function createRouteDistanceSampler(route) {
            const curves = route.curves || [];
            const lengths = curves.map(curve => Math.max(0.001, curve.getLength()));
            const cumulativeLengths = [0];
            lengths.forEach(length => cumulativeLengths.push(cumulativeLengths[cumulativeLengths.length - 1] + length));
            const totalLength = Math.max(1, cumulativeLengths[cumulativeLengths.length - 1]);
            function getSegmentIndex(distance) {
                const safeDistance = Math.max(0, Math.min(totalLength, distance));
                for (let index = 0; index < lengths.length - 1; index++) {
                    if (safeDistance < cumulativeLengths[index + 1] - 0.001) return index;
                }
                return Math.max(0, lengths.length - 1);
            }
            function getCurveSample(distance, tangent = false) {
                const index = getSegmentIndex(distance);
                const curve = curves[index];
                if (!curve) return tangent ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3();
                const localDistance = Math.max(0, Math.min(lengths[index], distance - cumulativeLengths[index]));
                const localProgress = localDistance / lengths[index];
                return tangent ? curve.getTangentAt(localProgress).normalize() : curve.getPointAt(localProgress);
            }
            return {
                totalLength,
                cumulativeLengths,
                getPointAtDistance: distance => getCurveSample(distance, false),
                getTangentAtDistance: distance => getCurveSample(distance, true)
            };
        }

        function getRouteHeadingDiagnostic(route) {
            let previousTangent = null;
            let minimumDot = 1;
            (route.curves || []).forEach(curve => {
                const samples = Math.max(16, Math.ceil(curve.getLength() / 90));
                for (let sampleIndex = 0; sampleIndex <= samples; sampleIndex++) {
                    const tangent = curve.getTangent(sampleIndex / samples);
                    if (!tangent || tangent.lengthSq() < 0.0001 || !Number.isFinite(tangent.x)) {
                        minimumDot = -1;
                        return;
                    }
                    tangent.normalize();
                    if (previousTangent && previousTangent.dot(tangent) < minimumDot) {
                        minimumDot = previousTangent.dot(tangent);
                    }
                    previousTangent = tangent;
                }
            });
            return { minimumDot };
        }

        function routeHasContinuousHeading(route) {
            return getRouteHeadingDiagnostic(route).minimumDot >= 0.82;
        }

        function getRouteLookTarget(route, progress, routeLength) {
            const sampler = createRouteDistanceSampler(route);
            const safeProgress = Math.min(0.998, Math.max(0, progress));
            const point = sampler.getPointAtDistance(safeProgress * sampler.totalLength);
            const lookAheadDistance = Math.min(1000, Math.max(180, routeLength * 0.035));
            const tangent = sampler.getTangentAtDistance(Math.min(sampler.totalLength, safeProgress * sampler.totalLength + lookAheadDistance));
            if (!tangent || tangent.lengthSq() < 0.0001 || !Number.isFinite(tangent.x)) {
                return point.clone().add(new THREE.Vector3(0, 0, -1));
            }
            return point.clone().addScaledVector(tangent.normalize(), lookAheadDistance);
        }

        function updateRouteCameraLook(loadingState, routeLength, deltaSeconds) {
            const progress = Math.min(0.998, Math.max(0, loadingState.routeProgress));
            const sampler = loadingState.routeSampler || createRouteDistanceSampler(loadingState.route);
            loadingState.routeSampler = sampler;
            const currentDistance = progress * sampler.totalLength;
            const tangent = sampler.getTangentAtDistance(currentDistance).normalize();
            if (!tangent || tangent.lengthSq() < 0.0001 || !Number.isFinite(tangent.x)) return;
            if (loadingState.routeLookDirection.lengthSq() < 0.0001) loadingState.routeLookDirection.copy(tangent);
            if (loadingState.routeLookDirection.dot(tangent) < -0.2) {
                loadingState.routeLookDirection.copy(tangent);
                loadingState.routeUpDirection.set(0, 1, 0);
            }
            const response = 1 - Math.exp(-Math.min(24, Math.max(0.001, deltaSeconds * 12)));
            loadingState.routeLookDirection.lerp(tangent, response).normalize();
            const worldUp = new THREE.Vector3(0, 1, 0);
            const projectedUp = worldUp.addScaledVector(loadingState.routeLookDirection, -worldUp.dot(loadingState.routeLookDirection));
            if (projectedUp.lengthSq() > 0.0001) {
                projectedUp.normalize();
            } else {
                projectedUp.copy(loadingState.routeUpDirection)
                    .addScaledVector(loadingState.routeLookDirection, -loadingState.routeUpDirection.dot(loadingState.routeLookDirection));
                if (projectedUp.lengthSq() < 0.0001) projectedUp.set(0, 0, 1);
                projectedUp.normalize();
            }
            if (loadingState.routeUpDirection.lengthSq() > 0.0001 && projectedUp.dot(loadingState.routeUpDirection) < 0) projectedUp.negate();
            loadingState.routeUpDirection.copy(projectedUp);
            const right = new THREE.Vector3().crossVectors(loadingState.routeLookDirection, loadingState.routeUpDirection).normalize();
            loadingState.routeRightDirection.copy(right);
            loadingState.routeUpDirection.crossVectors(right, loadingState.routeLookDirection).normalize();
            const lookAheadDistance = Math.min(1000, Math.max(180, routeLength * 0.035));
            const lookTarget = camera.position.clone().addScaledVector(loadingState.routeLookDirection, lookAheadDistance);
            const lookMatrix = new THREE.Matrix4().lookAt(camera.position, lookTarget, loadingState.routeUpDirection);
            const desiredQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
            camera.quaternion.slerp(desiredQuaternion, response);
            targetControlTarget.copy(lookTarget);
            return true;
        }

        function getRouteStopSpeedFactor(loadingState, routeLength) {
            const stopProgresses = loadingState.routeStopProgresses || [];
            if (!stopProgresses.length) return 1;
            const currentDistance = loadingState.routeProgress * routeLength;
            const nearestStopDistance = Math.min(...stopProgresses.map(progress => Math.abs(progress * routeLength - currentDistance)));
            const slowdownDistance = Math.max(900, Math.min(3200, routeLength * 0.16));
            const normalizedDistance = Math.min(1, nearestStopDistance / slowdownDistance);
            const easedDistance = normalizedDistance * normalizedDistance * (3 - normalizedDistance * 2);
            return 0.62 + easedDistance * 0.38;
        }

        function createSmoothWaypointRoute(points) {
            const segmentDistances = points.slice(1).map((point, index) => Math.max(0.001, point.distanceTo(points[index])));
            const tangents = points.map((point, index) => {
                const previous = points[Math.max(0, index - 1)];
                const next = points[Math.min(points.length - 1, index + 1)];
                const tangent = next.clone().sub(previous);
                if (tangent.lengthSq() < 0.0001) tangent.copy(next).sub(point);
                return tangent.normalize();
            });
            const route = new THREE.CurvePath();
            const cumulativeLengths = [0];
            segmentDistances.forEach((distance, index) => {
                const startHandle = Math.min(distance * 0.24, (segmentDistances[index - 1] || distance) * 0.24, 1000);
                const endHandle = Math.min(distance * 0.24, (segmentDistances[index + 1] || distance) * 0.24, 1000);
                const curve = new THREE.CubicBezierCurve3(
                    points[index].clone(),
                    points[index].clone().addScaledVector(tangents[index], startHandle),
                    points[index + 1].clone().addScaledVector(tangents[index + 1], -endHandle),
                    points[index + 1].clone()
                );
                route.add(curve);
                cumulativeLengths.push(cumulativeLengths[cumulativeLengths.length - 1] + curve.getLength());
            });
            return { route, cumulativeLengths, totalLength: Math.max(1, cumulativeLengths[cumulativeLengths.length - 1]) };
        }

        function createLoadingRoute(target, direction, distance, destinationIndex, startPosition = null, candidatePools = getWarpCandidateStops(destinationIndex)) {
            const horizonRadius = getEventHorizonRadius(target);
            const start = startPosition
                ? startPosition.clone()
                : target.position.clone().addScaledVector(direction, distance);
            const preEntryDistance = horizonRadius + 420;
            const preEntry = target.position.clone().addScaledVector(direction, preEntryDistance);
            const end = target.position.clone().addScaledVector(direction, horizonRadius);
            const desiredCount = Math.max(0, Math.round(loadingAnimation?.stopCount ?? warpStopCount));
            let selected = [];
            let route = null;
            let swingByDiagnostics = [];
            let stopProgresses = [];
            let preEntryProgress = 0.96;
            for (let stopCount = desiredCount; stopCount >= 1 && !route; stopCount--) {
                for (let variant = 0; variant < 8 && !route; variant++) {
                    selected = selectWarpCandidates(candidatePools, stopCount, start, preEntry, Math.floor(variant / 2));
                    for (const radiusScale of [1, 1.15, 1.35, 1.6]) {
                        const diagnostics = [];
                        const waypoints = [start.clone()];
                        let currentPoint = start.clone();
                        selected.forEach((candidate, index) => {
                            const nextPoint = index === selected.length - 1 ? preEntry : selected[index + 1].anchor;
                            const arc = createSwingByArc(candidate, currentPoint, nextPoint, radiusScale, variant % 2 ? -1 : 1);
                            waypoints.push(...arc.arcPoints);
                            diagnostics.push(arc);
                            currentPoint = arc.exitPoint.clone();
                        });
                        waypoints.push(preEntry.clone(), end.clone());
                        const generated = createSmoothWaypointRoute(waypoints);
                        const candidateRoute = generated.route;
                        const candidateStopProgresses = diagnostics.map((arc, index) => generated.cumulativeLengths[2 + index * 3] / generated.totalLength);
                        const candidatePreEntryProgress = generated.cumulativeLengths[waypoints.length - 2] / generated.totalLength;
                        const arcClear = diagnostics.every(arc => getRouteMinimumDistance(candidateRoute, arc.anchor) >= arc.flybyRadius * 0.9);
                        const heading = getRouteHeadingDiagnostic(candidateRoute);
                        const continuousHeading = heading.minimumDot >= 0.82;
                        const candidateSafe = routeAvoidsBlackHoles(candidateRoute, destinationIndex, candidatePools.safeRadius, candidatePreEntryProgress, candidatePools.obstacles);
                        if (arcClear && continuousHeading && candidateSafe) {
                            route = candidateRoute;
                            swingByDiagnostics = diagnostics;
                            stopProgresses = candidateStopProgresses;
                            preEntryProgress = candidatePreEntryProgress;
                            break;
                        }
                    }
                }
            }
            if (!route) {
                // No candidate flyby satisfied both heading and obstacle checks.
                // Keep the flight continuous and let the caller retry another
                // approach direction if this direct path also crosses a hazard.
                selected = [];
                route = new THREE.CurvePath();
                const entryDirection = end.clone().sub(preEntry).normalize();
                route.add(createSmoothBezierSegment(start, preEntry, preEntry.clone().sub(start).normalize(), entryDirection));
                route.add(new THREE.LineCurve3(preEntry.clone(), end.clone()));
                preEntryProgress = route.curves[0].getLength() / Math.max(1, route.getLength());
            }
            selected.forEach((candidate, index) => {
                const diagnostic = swingByDiagnostics[index];
                if (!diagnostic) return;
                candidate.flybyPosition = diagnostic.flybyPosition;
                candidate.flybyRadius = diagnostic.flybyRadius;
                candidate.swingByAngle = diagnostic.swingByAngle;
                candidate.minAnchorDistance = getRouteMinimumDistance(route, diagnostic.anchor);
            });
            return {
                route,
                stops: selected,
                galaxyStops: selected.filter(stop => stop.type === 'galaxy'),
                stellarStops: selected.filter(stop => stop.type === 'stellar-system'),
                safeRadius: candidatePools.safeRadius,
                stopProgresses,
                stopAnchors: selected.map(stop => stop.anchor.clone()),
                preEntryProgress,
                swingByDiagnostics,
                safe: routeAvoidsBlackHoles(route, destinationIndex, candidatePools.safeRadius, preEntryProgress, candidatePools.obstacles)
                    && routeHasContinuousHeading(route)
            };
        }

        function createUTurnRoute(currentPosition, currentTangent, target, direction) {
            const eventHorizonRadius = getEventHorizonRadius(target);
            const preEntry = target.position.clone().addScaledVector(direction, eventHorizonRadius + 420);
            const end = target.position.clone().addScaledVector(direction, eventHorizonRadius);
            const approachDirection = preEntry.clone().sub(currentPosition).normalize();
            const route = new THREE.CurvePath();
            const approachCurve = createSmoothBezierSegment(currentPosition, preEntry, currentTangent, approachDirection);
            route.add(approachCurve);
            const approachLength = approachCurve.getLength();
            const entryCurve = new THREE.LineCurve3(preEntry.clone(), end.clone());
            route.add(entryCurve);
            const totalLength = Math.max(1, approachLength + entryCurve.getLength());
            return {
                route,
                preEntryProgress: approachLength / totalLength,
                turnRadius: Math.max(1800, Math.min(6000, currentPosition.distanceTo(preEntry) * 0.18)),
                arcPoints: [currentPosition.clone(), preEntry.clone()]
            };
        }

        function beginReturnToDestination() {
            if (!loadingAnimation || loadingAnimation.returnRoute || loadingAnimation.preEntryStartedAt || loadingAnimation.entryStartedAt) return;
            const target = getLoadingBlackHoleTarget(loadingAnimation.targetIndex);
            const currentPosition = camera.position.clone();
            const currentSampler = loadingAnimation.route
                ? (loadingAnimation.routeSampler || createRouteDistanceSampler(loadingAnimation.route))
                : null;
            loadingAnimation.routeSampler = currentSampler;
            const currentTangent = currentSampler
                ? currentSampler.getTangentAtDistance(
                    Math.min(0.999, Math.max(0, loadingAnimation.routeProgress)) * currentSampler.totalLength
                ).normalize()
                : controls.target.clone().sub(camera.position).normalize();
            const generated = createUTurnRoute(currentPosition, currentTangent, target, loadingAnimation.approachDirection);
            loadingAnimation.returnRoute = generated.route;
            loadingAnimation.returnRouteProgress = 0;
            loadingAnimation.returnRouteStartedAt = performance.now();
            loadingAnimation.returnTurnRadius = generated.turnRadius;
            loadingAnimation.returnArcPoints = generated.arcPoints;
            loadingAnimation.route = generated.route;
            loadingAnimation.routeProgress = 0;
            loadingAnimation.routeStopProgresses = [];
            loadingAnimation.routeStopAnchors = [];
            loadingAnimation.preEntryProgress = generated.preEntryProgress;
            loadingAnimation.preEntryStartedAt = null;
            loadingAnimation.entryStartedAt = null;
            loadingAnimation.routeStops = [];
            loadingAnimation.galaxyStops = [];
            loadingAnimation.stellarStops = [];
            loadingAnimation.routeSpeed = 0;
            loadingAnimation.lastRouteTimestamp = performance.now();
            loadingAnimation.routeSampler = createRouteDistanceSampler(generated.route);
            loadingAnimation.routeLookDirection.copy(loadingAnimation.routeSampler.getTangentAtDistance(0));
            loadingAnimation.routeUpDirection.set(0, 1, 0);
            loadingAnimation.routeRightDirection.set(1, 0, 0);
            loadingAnimation.returningToDestination = true;
        }

        window.markLoadingUniverseReady = function() {
            if (!loadingAnimation) return false;
            loadingAnimation.apiReady = true;
            loadingAnimation.universeReadyAt = performance.now();
            if (loadingAnimation.mode === '2d') return true;
            if (!loadingAnimation.preEntryStartedAt && !loadingAnimation.entryStartedAt) beginReturnToDestination();
            return true;
        };

        function initializeLoadingRoute(target, startPosition = null) {
            let generated = null;
            const candidatePools = getWarpCandidateStops(loadingAnimation.targetIndex);
            for (let attempt = 0; attempt < 8; attempt++) {
                generated = createLoadingRoute(target, loadingAnimation.approachDirection, loadingAnimation.approachDistance, loadingAnimation.targetIndex, startPosition, candidatePools);
                if (generated.safe) break;
                loadingAnimation.approachDirection.copy(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize());
            }
            loadingAnimation.route = generated.route;
            loadingAnimation.routeStops = generated.stops;
            loadingAnimation.galaxyStops = generated.galaxyStops;
            loadingAnimation.stellarStops = generated.stellarStops;
            loadingAnimation.routeSafeRadius = generated.safeRadius;
            loadingAnimation.routeStopProgresses = generated.stopProgresses;
            loadingAnimation.routeStopAnchors = generated.stopAnchors;
            loadingAnimation.preEntryProgress = generated.preEntryProgress;
            loadingAnimation.swingByDiagnostics = generated.swingByDiagnostics;
            loadingAnimation.routeProgress = 0;
            loadingAnimation.routeSpeed = 0;
            loadingAnimation.lastRouteTimestamp = performance.now();
            loadingAnimation.routeTargetIndex = loadingAnimation.targetIndex;
            loadingAnimation.routeSampler = createRouteDistanceSampler(generated.route);
            loadingAnimation.routeLookDirection.copy(loadingAnimation.routeSampler.getTangentAtDistance(0));
            loadingAnimation.routeUpDirection.set(0, 1, 0);
            loadingAnimation.routeRightDirection.set(1, 0, 0);
        }

        function beginNextLoadingUniverse() {
            if (!loadingAnimation || loadingAnimation.apiReady || !galaxyBlackHoleTargets.length) return false;
            const startPosition = camera.position.clone();
            if (typeof relocateGalaxyUniverse === 'function') relocateGalaxyUniverse('black-hole-universe-switch');

            loadingAnimation.targetIndex = (loadingAnimation.targetIndex + 1) % galaxyBlackHoleTargets.length;
            const nextTarget = getLoadingBlackHoleTarget(loadingAnimation.targetIndex);
            const nextDirection = startPosition.clone().sub(nextTarget.position);
            if (nextDirection.lengthSq() < 0.0001) {
                nextDirection.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            } else {
                nextDirection.normalize();
            }
            loadingAnimation.approachDirection.copy(nextDirection);
            loadingAnimation.approachDistance = Math.max(1, startPosition.distanceTo(nextTarget.position));
            loadingAnimation.route = null;
            loadingAnimation.returnRoute = null;
            loadingAnimation.returnRouteProgress = 0;
            loadingAnimation.returnRouteStartedAt = null;
            loadingAnimation.returnArcPoints = [];
            loadingAnimation.routeStops = [];
            loadingAnimation.galaxyStops = [];
            loadingAnimation.stellarStops = [];
            loadingAnimation.routeStopProgresses = [];
            loadingAnimation.routeStopAnchors = [];
            loadingAnimation.preEntryProgress = 0.96;
            loadingAnimation.routeProgress = 0;
            loadingAnimation.routeSpeed = 0;
            loadingAnimation.preEntryStartedAt = null;
            loadingAnimation.entryStartedAt = null;
            loadingAnimation.routeTargetIndex = -1;
            initializeLoadingRoute(nextTarget, startPosition);
            camera.position.copy(startPosition);
            targetControlTarget.copy(camera.position).addScaledVector(loadingAnimation.routeLookDirection, 800);
            camera.lookAt(targetControlTarget);
            if (nextTarget.galaxy) nextTarget.galaxy.visible = true;
            return true;
        }

        function startLoadingAnimation() {
            if (explorationViewMode === '2d'
                && typeof window.startTwoDLoadingAnimation === 'function'
                && window.startTwoDLoadingAnimation()) {
                return;
            }
            // ひとつの銀河の中心ブラックホールだけを航路に固定する。
            // 入口・出口を大きく離し、周囲の意見（星）を横切る高速移動を見せる。
            const now = performance.now();
            if (typeof relocateGalaxyUniverse === 'function') relocateGalaxyUniverse('loading-start');
            const firstTarget = getLoadingBlackHoleTarget(0);
            loadingAnimation = {
                startedAt: now,
                segmentStartedAt: now,
                segmentDuration: 60000 / warpSpeedFactor,
                approachDistance: 16000,
                maxSpeed: 900 * warpSpeedFactor,
                stopCount: warpStopCount,
                approachDirection: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
                targetIndex: 0,
                route: null,
                routeStops: [],
                galaxyStops: [],
                stellarStops: [],
                routeSafeRadius: 680,
                routeStopProgresses: [],
                routeStopAnchors: [],
                swingByDiagnostics: [],
                preEntryProgress: 0.96,
                routeProgress: 0,
                routeSpeed: 0,
                routeLookDirection: new THREE.Vector3(),
                routeUpDirection: new THREE.Vector3(0, 1, 0),
                routeRightDirection: new THREE.Vector3(1, 0, 0),
                routeSampler: null,
                lastRouteTimestamp: now,
                apiReady: false,
                universeReadyAt: null,
                returnRoute: null,
                returnRouteProgress: 0,
                returnRouteStartedAt: null,
                returnTurnRadius: 0,
                returnArcPoints: [],
                returningToDestination: false,
                preEntryStartedAt: null,
                entryStartedAt: null,
                routeTargetIndex: -1,
                onReady: null
            };
            isDiving = true;
            startZoomSound('warp');
            controls.enabled = false;
            camera.position.copy(firstTarget.position).addScaledVector(loadingAnimation.approachDirection, loadingAnimation.approachDistance);
            targetControlTarget.copy(firstTarget.position);
            initializeLoadingRoute(firstTarget);
            targetControlTarget.copy(camera.position).addScaledVector(loadingAnimation.routeLookDirection, 800);
            if (firstTarget.galaxy) firstTarget.galaxy.visible = true;
            camera.lookAt(targetControlTarget);
            galaxyClusters.forEach(cluster => { cluster.visible = true; });
        }

        function updateLoadingAnimation() {
            if (!loadingAnimation) return;
            const now = performance.now();
            const elapsed = now - loadingAnimation.segmentStartedAt;
            const deltaSeconds = Math.min(0.08, Math.max(0.001, (now - loadingAnimation.lastRouteTimestamp) / 1000));
            loadingAnimation.lastRouteTimestamp = now;
            const target = getLoadingBlackHoleTarget(loadingAnimation.targetIndex);
            const blackHole = target.position;
            const eventHorizonRadius = getEventHorizonRadius(target);
            if (!loadingAnimation.apiReady && pendingUniverse) {
                loadingAnimation.apiReady = true;
                loadingAnimation.universeReadyAt = now;
            }
            loadingAnimation.segmentDuration = loadingAnimation.apiReady ? 1600 : 60000 / warpSpeedFactor;
            loadingAnimation.maxSpeed = loadingAnimation.apiReady ? 120000 : 900 * warpSpeedFactor;
            if (!loadingAnimation.route || loadingAnimation.routeTargetIndex !== loadingAnimation.targetIndex) initializeLoadingRoute(target);
            if (loadingAnimation.apiReady && !loadingAnimation.returnRoute && !loadingAnimation.preEntryStartedAt && !loadingAnimation.entryStartedAt) beginReturnToDestination();
            const routeSampler = loadingAnimation.routeSampler || createRouteDistanceSampler(loadingAnimation.route);
            loadingAnimation.routeSampler = routeSampler;
            const routeLength = routeSampler.totalLength;
            const preEntryProgress = Math.min(0.995, loadingAnimation.preEntryProgress || 0.96);
            let routeCameraOrientationApplied = false;
            if (!loadingAnimation.preEntryStartedAt && loadingAnimation.routeProgress < preEntryProgress) {
                camera.fov = configuredFieldOfView;
                camera.updateProjectionMatrix();
                const nearestStopFactor = getRouteStopSpeedFactor(loadingAnimation, routeLength);
                const routeDurationSeconds = loadingAnimation.segmentDuration / 1000;
                const cruiseWorldSpeed = Math.min(loadingAnimation.maxSpeed, routeLength / (routeDurationSeconds * 0.72));
                const targetRouteSpeed = (cruiseWorldSpeed / routeLength) * nearestStopFactor;
                loadingAnimation.routeSpeed += (targetRouteSpeed - loadingAnimation.routeSpeed) * Math.min(1, deltaSeconds * 1.8);
                loadingAnimation.routeProgress = Math.min(preEntryProgress, loadingAnimation.routeProgress + loadingAnimation.routeSpeed * deltaSeconds);
                camera.position.copy(routeSampler.getPointAtDistance(loadingAnimation.routeProgress * routeLength));
                routeCameraOrientationApplied = updateRouteCameraLook(loadingAnimation, routeLength, deltaSeconds);
                updateZoomSound(Math.min(1, loadingAnimation.routeProgress * 1.2));
            } else if (!loadingAnimation.preEntryStartedAt) {
                loadingAnimation.preEntryStartedAt = now;
                loadingAnimation.routeProgress = preEntryProgress;
                camera.position.copy(routeSampler.getPointAtDistance(preEntryProgress * routeLength));
                targetControlTarget.copy(blackHole);
                camera.fov = configuredFieldOfView;
                camera.updateProjectionMatrix();
                updateZoomSound(0.58);
            } else if (!loadingAnimation.entryStartedAt) {
                const holdProgress = Math.min(1, (now - loadingAnimation.preEntryStartedAt) / (loadingAnimation.apiReady ? 180 : 1000));
                camera.position.copy(routeSampler.getPointAtDistance(preEntryProgress * routeLength));
                targetControlTarget.copy(blackHole);
                camera.fov = configuredFieldOfView;
                camera.updateProjectionMatrix();
                updateZoomSound(0.42);
                if (holdProgress >= 1) loadingAnimation.entryStartedAt = now;
            } else {
                const entryDuration = loadingAnimation.apiReady ? 560 : 1500;
                const entryProgress = Math.min(1, (now - loadingAnimation.entryStartedAt) / entryDuration);
                const exponentialProgress = entryProgress >= 1 ? 1 : 1 - Math.exp(-5 * entryProgress);
                const preEntryPosition = routeSampler.getPointAtDistance(preEntryProgress * routeLength);
                camera.position.copy(preEntryPosition).lerp(blackHole.clone().addScaledVector(loadingAnimation.approachDirection, eventHorizonRadius), exponentialProgress);
                targetControlTarget.copy(blackHole);
                const fovProgress = Math.pow(entryProgress, 3);
                camera.fov = configuredFieldOfView + (Math.max(8, configuredFieldOfView * 0.16) - configuredFieldOfView) * fovProgress;
                camera.updateProjectionMatrix();
                updateZoomSound(0.72 + exponentialProgress * 0.28);
                if (entryProgress < 1) {
                    camera.lookAt(targetControlTarget);
                    return;
                }
            }
            if (!routeCameraOrientationApplied) camera.lookAt(targetControlTarget);

            // 事象の地平面に触れた瞬間に切り替える。
            if (loadingAnimation.entryStartedAt && now - loadingAnimation.entryStartedAt >= (loadingAnimation.apiReady ? 560 : 1500)) {
                camera.position.copy(blackHole).addScaledVector(loadingAnimation.approachDirection, eventHorizonRadius);
                targetControlTarget.copy(blackHole);
                if (pendingUniverse && loadingAnimation.apiReady && typeof loadingAnimation.onReady === 'function') {
                    const onReady = loadingAnimation.onReady;
                    loadingAnimation = null;
                    isDiving = false;
                    onReady();
                    beginUniverseReveal(true);
                    return;
                }
                if (!loadingAnimation.apiReady) {
                    beginNextLoadingUniverse();
                    return;
                }
            }
        }

        function createUniverseRevealBeacon(position) {
            const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
                map: createGlowTexture('rgba(210,245,255,1)'),
                color: 0x9beeff,
                transparent: true,
                opacity: 0.95,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                fog: false
            }));
            beacon.position.copy(position);
            beacon.scale.set(34, 34, 1);
            scene.add(beacon);
            return beacon;
        }

        function beginUniverseReveal(fast = false) {
            const revealTarget = groupWorldOffset.clone();
            const revealDirection = camera.position.clone().sub(controls.target);
            if (revealDirection.lengthSq() < 0.01) revealDirection.set(0, 0, 1);
            revealDirection.normalize();
            const nearDistance = Math.max(70, groupEntryCameraDistance || 70);
            transitionState = null;
            groupOverviewState = null;
            isZoomingIntoGroup = false;
            currentBubbles.forEach(bubble => {
                const finalScale = bubble.mesh.userData.finalScale || bubble.mesh.scale.x;
                bubble.mesh.scale.setScalar(finalScale);
                bubble.mesh.material.opacity = 0.95;
            });
            const farDistance = fast ? 16000 : 46000;
            const holdDuration = fast ? 220 : 5000;
            const zoomDuration = fast ? 1280 : 9000;
            camera.position.copy(revealTarget).addScaledVector(revealDirection, farDistance);
            controls.target.copy(revealTarget);
            targetCameraPos.copy(revealTarget).addScaledVector(revealDirection, nearDistance);
            targetControlTarget.copy(revealTarget);
            controls.enabled = false;
            universeRevealState = {
                startedAt: performance.now(),
                target: revealTarget,
                direction: revealDirection,
                farDistance,
                nearDistance,
                holdDuration,
                zoomDuration,
                beacon: createUniverseRevealBeacon(revealTarget)
            };
        }

        function updateUniverseReveal() {
            if (!universeRevealState) return;
            const elapsed = performance.now() - universeRevealState.startedAt;
            const holdProgress = Math.min(1, elapsed / universeRevealState.holdDuration);
            const zoomProgress = Math.max(0, Math.min(1, (elapsed - universeRevealState.holdDuration) / universeRevealState.zoomDuration));
            const eased = zoomProgress * zoomProgress * (3 - 2 * zoomProgress);
            const distance = universeRevealState.farDistance + (universeRevealState.nearDistance - universeRevealState.farDistance) * eased;
            camera.position.copy(universeRevealState.target).addScaledVector(universeRevealState.direction, distance);
            controls.target.copy(universeRevealState.target);
            camera.lookAt(controls.target);
            if (universeRevealState.beacon) {
                universeRevealState.beacon.material.opacity = 0.76 + Math.sin(performance.now() * 0.004) * 0.18;
                const beaconScale = 32 + eased * 18;
                universeRevealState.beacon.scale.set(beaconScale, beaconScale, 1);
            }
            if (holdProgress >= 1 && zoomProgress >= 1) {
                if (universeRevealState.beacon) {
                    scene.remove(universeRevealState.beacon);
                    universeRevealState.beacon.material.dispose();
                }
                universeRevealState = null;
                controls.enabled = true;
                isZoomingIntoGroup = false;
                stopZoomSound();
            }
        }

        function updateGroupTransition() {
            if (!transitionState) return;
            const progress = Math.min(1, (performance.now() - transitionState.startedAt) / transitionState.duration);
            const smooth = value => {
                const clamped = Math.max(0, Math.min(1, value));
                return clamped * clamped * (3 - 2 * clamped);
            };
            const eased = smooth(progress);
            const zoomingIn = transitionState.type === 'zoomIn' && transitionState.portalCamera;
            const zoomingOut = transitionState.type === 'zoomOut';
            const usesPortal = Boolean(transitionState.portalCamera);
            const approach = usesPortal ? smooth(progress / 0.5) : eased;
            const reveal = usesPortal ? smooth((progress - 0.5) / 0.5) : eased;
            const parentReveal = zoomingOut ? smooth((progress - 0.22) / 0.78) : eased;
            if (usesPortal) {
                if (progress <= 0.5) {
                    camera.position.lerpVectors(transitionState.cameraStart, transitionState.portalCamera, approach);
                    controls.target.lerpVectors(transitionState.controlStart, transitionState.portalTarget, approach);
                } else {
                    camera.position.lerpVectors(transitionState.portalCamera, transitionState.cameraEnd, reveal);
                    controls.target.lerpVectors(transitionState.portalTarget, transitionState.controlEnd, reveal);
                }
            } else if (transitionState.cameraStart && transitionState.cameraEnd) {
                camera.position.lerpVectors(transitionState.cameraStart, transitionState.cameraEnd, eased);
                controls.target.lerpVectors(transitionState.controlStart, transitionState.controlEnd, eased);
            } else {
                camera.position.lerp(targetCameraPos, 0.08);
                controls.target.lerp(targetControlTarget, 0.08);
            }
            camera.lookAt(controls.target);
            transitionState.incoming.forEach(bubble => {
                if (zoomingIn) {
                    bubble.mesh.material.opacity = 0.04 + reveal * 0.91;
                } else {
                    bubble.mesh.material.opacity = 0.02 + parentReveal * 0.93;
                }
            });
            transitionState.outgoing.forEach(bubble => {
                if (zoomingIn) {
                    const isAnchor = bubble.data && bubble.data.id === transitionState.anchorBubbleId;
                    bubble.mesh.material.opacity = isAnchor ? 0.95 * (1 - reveal) : 0.82 * (1 - approach);
                } else {
                    bubble.mesh.material.opacity = 0.9 * (1 - Math.max(0, (eased - 0.58) / 0.42));
                }
                bubble.mesh.visible = true;
            });
            if (transitionState.shell) {
                transitionState.shell.material.opacity = zoomingIn
                    ? 0.22 * (1 - reveal)
                    : 0.05 + Math.sin(eased * Math.PI) * 0.22;
            }
            if (progress >= 1) {
                transitionState.outgoing.forEach(disposeBubble);
                if (transitionState.shell) {
                    scene.remove(transitionState.shell);
                    disposeObjectTree(transitionState.shell);
                }
                transitionState = null;
                stopZoomSound();
                isZoomingIntoGroup = false;
                controls.enabled = true;
                applyExplorationViewControls();
            }
        }

        function updateGroupOverview() {
            if (!groupOverviewState) return;
            const elapsed = performance.now() - groupOverviewState.startedAt;
            const progress = Math.min(1, elapsed / 900);
            const eased = progress * progress * (3 - 2 * progress);
            camera.position.lerp(groupOverviewState.cameraPosition, 0.08 + eased * 0.08);
            controls.target.lerp(groupOverviewState.controlTarget, 0.08 + eased * 0.08);
            camera.lookAt(controls.target);
            const cameraReady = camera.position.distanceTo(groupOverviewState.cameraPosition) < 0.45;
            const targetReady = controls.target.distanceTo(groupOverviewState.controlTarget) < 0.2;
            if ((progress >= 1 && cameraReady && targetReady) || (cameraReady && targetReady)) {
                camera.position.copy(groupOverviewState.cameraPosition);
                controls.target.copy(groupOverviewState.controlTarget);
                camera.lookAt(controls.target);
                groupOverviewState = null;
                groupZoomOutReady = true;
                controls.enabled = true;
                stopZoomSound();
            }
        }

        function updateCosmicEnvironment(time) {
            cosmicUpdateBucket = (cosmicUpdateBucket + 1) % 4;
            starMesh.rotation.y += 0.000004;
            starMesh.rotation.x += 0.000001;
            galaxyStructures.forEach((entry, index) => {
                entry.galaxy.rotation.y += entry.speed;
                entry.galaxy.rotation.z = Math.sin(time * 0.08 + entry.phase) * 0.025;
            });
            galaxyClusters.forEach((cluster, index) => {
                cluster.rotation.y += 0.000008 + index * 0.0000015;
            });
            shootingStars.forEach((entry, index) => {
                entry.streak.position.add(entry.velocity);
                entry.life -= 0.016;
                const fade = Math.min(0.94, Math.max(0, entry.life * 0.28));
                entry.head.material.opacity = fade;
                entry.tail.material.opacity = fade * 0.64;
                entry.tailGlow.material.opacity = fade * 0.24;
                entry.tailParticles.material.opacity = fade * 0.38;
                if (entry.life <= 0 || entry.streak.position.length() > 9200) resetShootingStar(entry, index);
            });
            cosmicSystems.forEach((entry, index) => {
                if (index % 4 !== cosmicUpdateBucket) return;
                entry.system.rotation.y += (0.00018 + index * 0.00003) * 4;
                entry.planets.forEach(planet => {
                    const angle = planet.angle + time * planet.speed;
                    planet.mesh.position.set(Math.cos(angle) * planet.radius, Math.sin(angle * 1.7) * planet.radius * 0.08, Math.sin(angle) * planet.radius);
                });
                const cometAngle = entry.phase + time * 0.12;
                entry.comet.position.set(Math.cos(cometAngle) * entry.scale * 1.75, Math.sin(cometAngle * 1.4) * entry.scale * 0.24, Math.sin(cometAngle) * entry.scale * 1.75);
                const cometVelocity = entry.comet.userData.orbitVelocity || new THREE.Vector3();
                cometVelocity.set(
                    -Math.sin(cometAngle) * entry.scale * 1.75,
                    Math.cos(cometAngle * 1.4) * 1.4 * entry.scale * 0.24,
                    Math.cos(cometAngle) * entry.scale * 1.75
                ).normalize();
                entry.comet.userData.orbitVelocity = cometVelocity;
                // 彗星の尾はローカル-X。+Xを軌道接線へ向ければ、尾は常に進行方向の反対になる。
                entry.comet.quaternion.setFromUnitVectors(cometForwardAxis, cometVelocity);
            });
            if (ngc3324Dome) {
                ngc3324Dome.rotation.y += 0.000006;
                ngc3324Dome.rotation.x += 0.000001;
            }
            cosmicBackgroundGroup.rotation.y += 0.000012;
            cosmicBackgroundGroup.rotation.x += 0.0000025;
            Object.values(backgroundThemeGroups || {}).forEach(group => {
                if (!group || !group.visible || !group.userData.themeAnimation) return;
                const themeAnimation = group.userData.themeAnimation;
                group.rotation.y += themeAnimation.rotationSpeed;
                themeAnimation.phase += 0.004;
                if (themeAnimation.plankton) themeAnimation.plankton.rotation.y += 0.0004;
                if (themeAnimation.nodeCloud) themeAnimation.nodeCloud.rotation.y -= 0.0007;
                if (themeAnimation.beacons) {
                    themeAnimation.beacons.forEach((beacon, index) => {
                        beacon.material.opacity = 0.24 + (Math.sin(time * 1.4 + index * 0.7) + 1) * 0.12;
                    });
                }
            });
        }

        function updateKeyboardNavigation(deltaSeconds) {
            if (!controls.enabled || loadingAnimation || transitionState || groupOverviewState || isZoomingIntoGroup) return;
            if (state.screen !== 'GROUP' && state.screen !== 'SINGLE') return;
            const movementKeys = window.__bubbleBreakerMovementKeys;
            if (!movementKeys || !movementKeys.size) return;
            const worldUp = new THREE.Vector3(0, 1, 0);
            const movement = new THREE.Vector3();
            const forward = controls.target.clone().sub(camera.position);
            if (forward.lengthSq() < 0.001) return;
            forward.normalize();
            const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
            if (movementKeys.has('w')) movement.add(forward);
            if (movementKeys.has('s')) movement.sub(forward);
            if (movementKeys.has('d')) movement.add(right);
            if (movementKeys.has('a')) movement.sub(right);
            if (movement.lengthSq() < 0.001) return;
            movement.normalize();
            const speed = window.__bubbleBreakerShiftDown ? 96 : 32;
            movement.multiplyScalar(speed * deltaSeconds);
            camera.position.add(movement);
            controls.target.add(movement);
            targetCameraPos.add(movement);
            targetControlTarget.add(movement);
        }

        function animate() {
            // ブラウザの描画タイミングに合わせて次のフレームを予約（ループの仕組み）
            requestAnimationFrame(animate);
            const time = clock.getElapsedTime(); // アプリ起動からの経過秒数
            const now = performance.now();
            const deltaSeconds = Math.min(0.05, Math.max(0.001, (now - lastAnimationTimestamp) / 1000));
            lastAnimationTimestamp = now;
            if (explorationViewMode === '2d') {
                if (typeof window.updateTwoDLoadingAnimation === 'function') window.updateTwoDLoadingAnimation(now);
                return;
            }
            if (document.hidden || document.body.classList.contains('about-open')) return;
            updateCosmicEnvironment(time);

            // --- 状態に応じたカメラ・演出の制御 ---
            if (loadingAnimation) {
                updateLoadingAnimation();
            } else if (transitionState) {
                updateGroupTransition();
            } else if (groupOverviewState) {
                updateGroupOverview();
            } else if (universeRevealState) {
                updateUniverseReveal();
            } else if (isDiving) {
                // 【ダイブアニメーション中】
                // 経過時間(0~4秒)から進捗率(0~1)を計算
                const t = time - diveStartTime; 
                const progress = Math.min(t / 4.0, 1.0); 
                
                // 加速度を指数関数(8乗)で爆発的に上げ、最後の瞬間に光速へ到達するような動きにする
                diveVelocity = 0.5 + Math.pow(progress, 8) * 300; 
                
                // カメラをZ軸の奥方向マイナスへ猛烈な速度で進める
                camera.position.z -= diveVelocity; 
                // 旧式の単純ダイブ経路でも、ユーザー設定のFOVを尊重する。
                camera.fov = configuredFieldOfView;
                camera.updateProjectionMatrix(); // カメラ設定を変更した時はこれを呼ぶ必要がある
                
                // 星は回転させず、カメラの移動だけで同一3D空間を横切る速度感を出す。
                
            } else if (isZoomingIntoGroup) {
                // 【ワープ明けの自動ズームイン中】
                // 遠距離(Z=400)から目標(Z=25)へ、毎フレーム0.02の割合で滑らかに(Lerp)接近させる
                camera.position.lerp(targetCameraPos, 0.02); 
                controls.target.lerp(targetControlTarget, 0.02);
                updateZoomSound(1 - Math.min(1, camera.position.distanceTo(targetCameraPos) / 70));
                camera.lookAt(controls.target); // 常に目標を睨み続ける
                
                // 目的地に十分近づいたら自動ズームイン演出を終了し、手動操作(controls)を解禁する
                if (camera.position.distanceTo(targetCameraPos) < 1.0) {
                    isZoomingIntoGroup = false;
                    controls.enabled = true;
                }
            } else if (controls.enabled) {
                // 【ユーザー操作中（通常時）】
                // マウスドラッグでの視点移動を滑らかに更新
                updateKeyboardNavigation(deltaSeconds);
                controls.update();
                if (state.screen === 'SINGLE') {
                    const direction = getExplorationViewDirection(camera.position.clone().sub(controls.target));
                    if (direction.lengthSq() > 0.01) singleViewDirection.copy(direction);
                }
            } else {
                // 【画面遷移のカメラ移動中】(loadSingleなどで指定された位置へ移動)
                camera.position.lerp(targetCameraPos, 0.05);
                controls.target.lerp(targetControlTarget, 0.05);
                camera.lookAt(controls.target);
                updateZoomSound(1 - Math.min(1, camera.position.distanceTo(targetCameraPos) / 50));
                if (camera.position.distanceTo(targetCameraPos) < 0.6) {
                    stopZoomSound();
                    if (state.screen === 'SINGLE') controls.enabled = true;
                }
            }
            // ダイブ中以外は、背景の星屑宇宙をゆっくり回転させて雄大さを出す
            // 星・銀河・バブルは同一ワールドの固定オブジェクトとして扱う。

            // 現在が解析画面系かどうかを判定（他のバブルを消す処理に使う）
            const isAnalysisOrDetail = (state.screen === 'ANALYSIS' || state.screen === 'DETAIL');

            // --- 現在表示されている各バブルごとの更新処理 ---
            currentBubbles.forEach(b => {
                if (isAnalysisOrDetail && state.bubbleId !== b.data.id && !transitionState && b.mesh.material.opacity <= 0.015) {
                    b.mesh.material.opacity = 0;
                    b.mesh.visible = false;
                    if (b.label.style.opacity !== '0') b.label.style.opacity = '0';
                    if (b.label.style.pointerEvents !== 'none') b.label.style.pointerEvents = 'none';
                    return;
                }
                // 初期Y座標を基準に絶対値で更新し、長時間実行時のdriftを防ぐ
                const isHierarchyIncoming = transitionState && transitionState.incoming.includes(b);
                if (!isHierarchyIncoming) b.mesh.position.y = b.baseY + Math.sin(time * 2 + b.baseX) * 0.005;

                const analysisProbe = b.mesh.userData && b.mesh.userData.analysisProbe;
                const analysisProbeAnimation = analysisProbe && analysisProbe.userData.analysisProbeAnimation;
                if (analysisProbe && analysisProbeAnimation) {
                    const isAnalysisLoading = b.data && b.data.analysisStatus === 'loading';
                    const completionAt = analysisProbeAnimation.completionStartedAt || (b.data && b.data.analysisCompletionAt) || 0;
                    const completionProgress = completionAt ? (performance.now() - completionAt) / 1200 : 1;
                    const isCompletionPulse = completionProgress >= 0 && completionProgress < 1;
                    analysisProbe.visible = Boolean(isAnalysisLoading || isCompletionPulse);
                    if (isAnalysisLoading) {
                        const orbitAngle = analysisProbeAnimation.phase + time * 2.7;
                        const latitude = Math.sin(time * 0.85 + analysisProbeAnimation.phase) * 0.34;
                        const radial = Math.sqrt(Math.max(0.15, 1 - latitude * latitude));
                        analysisProbeAnimation.probe.position.set(
                            Math.cos(orbitAngle) * radial * 1.06,
                            latitude * 1.06,
                            Math.sin(orbitAngle) * radial * 1.06
                        );
                        analysisProbeAnimation.probe.rotation.set(latitude * 0.8, -orbitAngle, Math.cos(time * 1.3 + analysisProbeAnimation.phase) * 0.22);
                        analysisProbeAnimation.orbit.rotation.y += 0.018;
                        analysisProbeAnimation.orbit.rotation.z = Math.sin(time * 0.8 + analysisProbeAnimation.phase) * 0.22;
                        analysisProbe.rotation.y += 0.012;
                        analysisProbe.scale.setScalar(1.02 + Math.sin(time * 4.4 + analysisProbeAnimation.phase) * 0.08);
                    }
                    if (analysisProbeAnimation.completionFlash) {
                        analysisProbeAnimation.completionFlash.visible = isCompletionPulse;
                        if (isCompletionPulse) {
                            const pulse = Math.max(0, Math.min(1, completionProgress));
                            analysisProbeAnimation.completionFlash.scale.setScalar(0.58 + pulse * 1.25);
                            analysisProbeAnimation.completionFlash.material.opacity = (1 - pulse) * 1.2;
                        }
                    }
                }

                const networkVisual = b.mesh.userData && b.mesh.userData.networkVisual;
                const networkAnimation = networkVisual && networkVisual.userData.networkAnimation;
                if (networkVisual && networkAnimation) {
                    networkVisual.rotation.y += 0.0014 + b.mesh.scale.x * 0.00008;
                    networkVisual.rotation.x = Math.sin(time * 0.18 + networkAnimation.phase) * 0.08;
                    networkAnimation.rings.forEach((ring, ringIndex) => {
                        ring.rotation.z += 0.0022 * (ringIndex % 2 === 0 ? 1 : -1);
                    });
                    networkAnimation.nodes.forEach((node, nodeIndex) => {
                        const pulse = 1 + Math.sin(time * 1.8 + networkAnimation.phase + nodeIndex * 0.7) * 0.12;
                        node.scale.setScalar(pulse);
                    });
                    networkAnimation.particles.rotation.y -= 0.0018;
                    if (networkAnimation.observerRing) {
                        const observerPulse = 1 + Math.sin(time * 2.1 + networkAnimation.phase) * 0.07;
                        networkAnimation.observerRing.scale.setScalar(observerPulse);
                    }
                    if (networkAnimation.scanRing) {
                        const isAnalysisLoading = state.bubbleData && state.bubbleData.id === b.data.id && b.data.analysisStatus === 'loading';
                        networkAnimation.scanRing.visible = Boolean(isAnalysisLoading);
                        if (isAnalysisLoading) {
                            networkAnimation.scanRing.rotation.z += 0.045;
                            const scanPulse = 0.92 + Math.sin(time * 4.2 + networkAnimation.phase) * 0.08;
                            networkAnimation.scanRing.scale.setScalar(scanPulse);
                        }
                    }
                    const fade = Math.max(0, Math.min(1, b.mesh.material.opacity / 0.95));
                    applyCachedVisualFade(networkVisual, fade);
                }
                const deepSeaVisual = b.mesh.userData && b.mesh.userData.deepSeaVisual;
                const deepSeaAnimation = deepSeaVisual && deepSeaVisual.userData.deepSeaAnimation;
                if (deepSeaVisual && deepSeaAnimation) {
                    deepSeaVisual.rotation.y -= 0.0011 + b.mesh.scale.x * 0.00005;
                    deepSeaAnimation.current.rotation.z += 0.0018;
                    deepSeaAnimation.bubbles.forEach(bubble => {
                        const lift = (time * bubble.speed + bubble.phase) % 2.2;
                        const angle = bubble.phase + time * bubble.speed * 0.22;
                        bubble.mesh.position.set(
                            Math.cos(angle) * bubble.radius,
                            -0.76 + lift * bubble.height,
                            Math.sin(angle) * bubble.radius
                        );
                        const pulse = 0.72 + Math.sin(time * 2.2 + bubble.phase) * 0.18;
                        bubble.mesh.scale.setScalar(pulse);
                    });
                    deepSeaAnimation.tendrils.forEach((tendril, index) => {
                        tendril.rotation.z = Math.sin(time * 0.34 + deepSeaAnimation.phase + index) * 0.08;
                    });
                    deepSeaAnimation.fish.forEach(fish => {
                        const swimAngle = fish.phase + time * fish.speed * fish.direction;
                        fish.mesh.position.set(
                            Math.cos(swimAngle) * fish.radius,
                            fish.height + Math.sin(time * 1.4 + fish.phase) * 0.08,
                            Math.sin(swimAngle) * fish.radius
                        );
                        fish.mesh.rotation.y = -swimAngle + (fish.direction < 0 ? Math.PI : 0);
                        fish.mesh.rotation.z = Math.sin(time * 1.8 + fish.phase) * 0.08;
                    });
                    deepSeaAnimation.jellies.forEach(jelly => {
                        const jellyAngle = jelly.phase + time * jelly.speed;
                        jelly.mesh.position.set(
                            Math.cos(jellyAngle) * jelly.radius,
                            0.25 + Math.sin(time * 0.9 + jelly.phase) * 0.24,
                            Math.sin(jellyAngle) * jelly.radius
                        );
                        jelly.mesh.scale.y = 0.94 + Math.sin(time * 2.1 + jelly.phase) * 0.09;
                    });
                    deepSeaAnimation.coral.forEach((coral, index) => {
                        coral.rotation.z = Math.sin(time * 0.55 + index * 0.8) * 0.12;
                        coral.material.opacity = 0.42 + (Math.sin(time * 1.7 + index) + 1) * 0.1;
                    });
                    deepSeaAnimation.plankton.rotation.y -= 0.0022;
                    if (deepSeaAnimation.scanRing) {
                        const isAnalysisLoading = state.bubbleData && state.bubbleData.id === b.data.id && b.data.analysisStatus === 'loading';
                        deepSeaAnimation.scanRing.visible = Boolean(isAnalysisLoading);
                        if (isAnalysisLoading) {
                            deepSeaAnimation.scanRing.rotation.z += 0.05;
                            deepSeaAnimation.scanRing.scale.setScalar(0.92 + Math.sin(time * 4.4 + deepSeaAnimation.phase) * 0.08);
                        }
                    }
                    const fade = Math.max(0, Math.min(1, b.mesh.material.opacity / 0.95));
                    applyCachedVisualFade(deepSeaVisual, fade);
                }

                const dataVisual = b.mesh.userData && b.mesh.userData.dataVisual;
                const dataAnimation = dataVisual && dataVisual.userData.dataAnimation;
                if (dataVisual && dataAnimation) {
                    dataVisual.rotation.y += 0.0015 + b.mesh.scale.x * 0.00007;
                    dataAnimation.nodes.forEach((node, index) => {
                        const pulse = 0.88 + Math.sin(time * 2.6 + dataAnimation.phase + index * 0.55) * 0.14;
                        node.scale.setScalar(pulse);
                    });
                    dataAnimation.links.forEach((link, index) => {
                        link.material.opacity = 0.3 + (Math.sin(time * 1.5 + dataAnimation.phase + index * 0.3) + 1) * 0.12;
                    });
                    dataAnimation.grids.forEach((grid, index) => {
                        grid.rotation.z += 0.0015 * (index % 2 ? -1 : 1);
                        grid.rotation.x += 0.0008;
                    });
                    dataAnimation.streams.forEach((stream, index) => {
                        stream.material.opacity = 0.34 + (Math.sin(time * 2.8 + dataAnimation.phase + index * 0.9) + 1) * 0.14;
                    });
                    dataAnimation.streamPackets.forEach(packet => {
                        packet.progress = (packet.progress + 0.018) % 1;
                        const stream = dataAnimation.streams[packet.streamIndex];
                        const positions = stream.geometry.attributes.position;
                        const segmentCount = positions.count - 1;
                        const scaled = packet.progress * segmentCount;
                        const segment = Math.min(segmentCount - 1, Math.floor(scaled));
                        const localProgress = scaled - segment;
                        packet.startScratch = packet.startScratch || new THREE.Vector3();
                        packet.endScratch = packet.endScratch || new THREE.Vector3();
                        packet.startScratch.fromBufferAttribute(positions, segment);
                        packet.endScratch.fromBufferAttribute(positions, segment + 1);
                        packet.mesh.position.lerpVectors(packet.startScratch, packet.endScratch, localProgress);
                    });
                    dataAnimation.dataCubes.forEach((cube, index) => {
                        cube.rotation.x += 0.012 + index * 0.001;
                        cube.rotation.y -= 0.009 + index * 0.001;
                        cube.material.opacity = 0.48 + (Math.sin(time * 2 + dataAnimation.phase + index) + 1) * 0.14;
                    });
                    dataAnimation.packets.forEach(packet => {
                        packet.progress = (packet.progress + 0.012) % 1;
                        const start = dataAnimation.positions[packet.edge];
                        const end = dataAnimation.positions[(packet.edge + 1) % dataAnimation.positions.length];
                        packet.mesh.position.lerpVectors(start, end, packet.progress);
                    });
                    if (dataAnimation.scanRing) {
                        const isAnalysisLoading = state.bubbleData && state.bubbleData.id === b.data.id && b.data.analysisStatus === 'loading';
                        dataAnimation.scanRing.visible = Boolean(isAnalysisLoading);
                        if (isAnalysisLoading) {
                            dataAnimation.scanRing.rotation.x += 0.035;
                            dataAnimation.scanRing.rotation.z += 0.025;
                            dataAnimation.scanRing.scale.setScalar(0.93 + Math.sin(time * 4.6 + dataAnimation.phase) * 0.07);
                        }
                    }
                    const fade = Math.max(0, Math.min(1, b.mesh.material.opacity / 0.95));
                    applyCachedVisualFade(dataVisual, fade);
                }
                
                // --- 解析画面時の他バブル透過処理 ---
                const isTarget = (state.bubbleId === b.data.id);
                // 対象バブル以外は目標不透明度を 0 にしてフェードアウトさせる
                const targetOpacity = (isAnalysisOrDetail && !isTarget) ? 0.0 : 0.9;

                // グループ遷移中は専用アニメーションが不透明度と縮尺を制御する。
                if (!transitionState) b.mesh.material.opacity += (targetOpacity - b.mesh.material.opacity) * 0.1;
                // 完全に透明になったら、3D的な描画やクリック判定の対象から外す
                b.mesh.visible = b.mesh.material.opacity > 0.01; 
                
                // --- HTML文字ラベルの追従処理 ---
                // バブル群画面で、かつ自動ズーム演出中でない時だけラベルを表示する
                if (state.screen === 'GROUP' && !isAnalysisOrDetail && !isZoomingIntoGroup) {
                    // 3D空間の座標を、2Dの画面上の座標(-1〜1)に投影・変換する
                    const pos = labelProjectionScratch.copy(b.mesh.position).project(camera);
                    // カメラの背後にバブルがある場合はラベルを非表示にする
                    if (pos.z > 1) { b.label.style.opacity = '0'; return; }
                    
                    // -1〜1の座標を、実際のピクセル座標（X,Y）に変換
                    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
                    const y = -(pos.y * 0.5 - 0.5) * window.innerHeight;
                    
                    // カメラからの距離に応じてラベルの大きさを変える（遠くにあると文字も小さくなる）
                    const dist = camera.position.distanceTo(b.mesh.position);
                    let scale = Math.max(0.5, 15 / dist) * (1 + b.mesh.scale.x * 0.1);
                    if (b.level === 'leaf') scale = Math.min(0.78, scale * 0.66);
                    
                    // スタイルを適用してラベルを配置
                    const transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
                    if (b.label._lastTransform !== transform) {
                        b.label.style.transform = transform;
                        b.label._lastTransform = transform;
                    }
                    if (b.label.style.opacity !== '1') b.label.style.opacity = '1';
                    if (b.label.style.pointerEvents !== 'auto') b.label.style.pointerEvents = 'auto';
                } else {
                    // それ以外の画面ではラベルを消す
                    b.label.style.opacity = '0'; 
                    b.label.style.pointerEvents = 'none';
                }
            });

            // バブル未選択時も、利用者が意図して近づけた最寄りバブルへ自動遷移する。
            updateAutomaticBubbleApproach();

            // --- 接近ズームイン判定 (カメラが近づいたら自動遷移) ---
            // 自動ズーム中(isZoomingIntoGroup)は、まだ到着していないのに吸い込まれるのを防ぐために除外
            // カテゴリ移動後は自動的に個別バブルへ飛ばさず、バブル群全体を見せる。
            // 個別画面への遷移はクリック、ラベル選択、または意図した近接ズームで行う。

            // 最後に、全ての計算結果をもとに画面を描画（レンダリング）する
            const warpSpeed = loadingAnimation ? Math.max(0.72, Math.min(1.25, loadingAnimation.routeSpeed * 4)) : 1;
            if (typeof window.renderSceneFrame === 'function') window.renderSceneFrame(Boolean(isDiving || loadingAnimation), warpSpeed);
            else renderer.render(scene, camera);
        }

        // --- 画面サイズが変更された時の対応処理 ---
        window.addEventListener('resize', () => {
            const width = Math.max(1, container.clientWidth || window.innerWidth);
            const height = Math.max(1, container.clientHeight || window.innerHeight);
            camera.aspect = width / height; // カメラの縦横比を修正
            camera.updateProjectionMatrix(); // カメラ設定を更新
            renderer.setSize(width, height); // レンダラーのサイズを更新
            if (typeof resizeWarpBlurTarget === 'function') resizeWarpBlurTarget();
            if (state.screen === 'SINGLE' && typeof window.onSceneBubbleScreenChanged === 'function') window.onSceneBubbleScreenChanged('SINGLE');
        });

        // アニメーションループを開始！
        animate();

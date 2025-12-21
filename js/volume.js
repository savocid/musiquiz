

async function analyzeAudioFile(audioUrl, options = {}) {
    const {
        fetchOptions = {},
        windowSize = 0.1, // seconds
        quietThreshold = -30, // dB
        minQuietDuration = 2, // seconds
        smoothingFactor = 0.8 // for RMS smoothing
    } = options;

    try {
        // 1. Fetch the audio file
        const response = await fetch(audioUrl, fetchOptions);
        if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.status}`);
        }
        
        const audioBuffer = await response.arrayBuffer();
        
        // 2. Create audio context and decode audio
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioData = await audioContext.decodeAudioData(audioBuffer);
        
        // 3. Process audio to get volume/level data
        const channelData = audioData.getChannelData(0); // Use first channel
        const sampleRate = audioData.sampleRate;
        const windowSizeSamples = Math.floor(windowSize * sampleRate);
        const totalWindows = Math.floor(channelData.length / windowSizeSamples);
        
        // 4. Calculate RMS levels for each window
        const levels = [];
        let maxLevel = -Infinity;
        let minLevel = Infinity;
        let totalLevel = 0;
        
        for (let i = 0; i < totalWindows; i++) {
            const start = i * windowSizeSamples;
            const end = Math.min(start + windowSizeSamples, channelData.length);
            const windowData = channelData.slice(start, end);
            
            // Calculate RMS (Root Mean Square) for this window
            let sum = 0;
            for (let j = 0; j < windowData.length; j++) {
                sum += windowData[j] * windowData[j];
            }
            
            const rms = Math.sqrt(sum / windowData.length);
            // Convert to decibels (dB)
            const db = rms > 0 ? 20 * Math.log10(rms) : -100;
            
            levels.push({
                time: i * windowSize,
                db: db,
                rms: rms
            });
            
            maxLevel = Math.max(maxLevel, db);
            minLevel = Math.min(minLevel, db);
            totalLevel += db;
        }
        
        // 5. Apply smoothing to the levels
        if (smoothingFactor > 0) {
            let smoothedValue = levels[0].db;
            for (let i = 1; i < levels.length; i++) {
                smoothedValue = smoothingFactor * smoothedValue + (1 - smoothingFactor) * levels[i].db;
                levels[i].db = smoothedValue;
            }
        }
        
        // 6. Detect quiet segments
        const quietSegments = detectQuietSegments(levels, {
            threshold: quietThreshold,
            minDuration: minQuietDuration,
            windowSize
        });
        
        // 7. Calculate overall statistics
        const averageLevel = totalLevel / levels.length;
        
        // 8. Find peaks (local maxima)
        const peaks = findPeaks(levels, 3); // Find peaks that are 3dB above neighbors
        
        return {
            success: true,
            metadata: {
                duration: audioData.duration,
                sampleRate: sampleRate,
                channels: audioData.numberOfChannels,
                bitDepth: 16, // Most audio is 16-bit
                totalSamples: channelData.length
            },
            statistics: {
                averageLevel: Math.round(averageLevel * 100) / 100,
                maxLevel: Math.round(maxLevel * 100) / 100,
                minLevel: Math.round(minLevel * 100) / 100,
                dynamicRange: Math.round((maxLevel - minLevel) * 100) / 100
            },
            levels: levels,
            quietSegments: quietSegments,
            peaks: peaks,
            recommendations: generateRecommendations({
                averageLevel,
                quietSegments,
                minLevel,
                maxLevel
            })
        };
        
    } catch (error) {
        console.error('Audio analysis error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}


function detectQuietSegments(levels, options) {
    const { threshold, minDuration, windowSize } = options;
    const quietSegments = [];
    let currentSegment = null;
    
    for (let i = 0; i < levels.length; i++) {
        const isQuiet = levels[i].db < threshold;
        
        if (isQuiet && !currentSegment) {
            // Start of a quiet segment
            currentSegment = {
                startTime: levels[i].time,
                endTime: levels[i].time + windowSize,
                minDb: levels[i].db,
                maxDb: levels[i].db,
                averageDb: levels[i].db,
                windowCount: 1
            };
        } else if (isQuiet && currentSegment) {
            // Continue quiet segment
            currentSegment.endTime = levels[i].time + windowSize;
            currentSegment.minDb = Math.min(currentSegment.minDb, levels[i].db);
            currentSegment.maxDb = Math.max(currentSegment.maxDb, levels[i].db);
            currentSegment.averageDb = (currentSegment.averageDb * currentSegment.windowCount + levels[i].db) / (currentSegment.windowCount + 1);
            currentSegment.windowCount++;
        } else if (!isQuiet && currentSegment) {
            // End of quiet segment
            if (currentSegment.endTime - currentSegment.startTime >= minDuration) {
                quietSegments.push({
                    start: currentSegment.startTime,
                    end: currentSegment.endTime,
                    duration: currentSegment.endTime - currentSegment.startTime,
                    averageDb: Math.round(currentSegment.averageDb * 100) / 100,
                    minDb: Math.round(currentSegment.minDb * 100) / 100,
                    maxDb: Math.round(currentSegment.maxDb * 100) / 100
                });
            }
            currentSegment = null;
        }
    }
    
    // Handle segment that ends at the end of audio
    if (currentSegment && currentSegment.endTime - currentSegment.startTime >= minDuration) {
        quietSegments.push({
            start: currentSegment.startTime,
            end: currentSegment.endTime,
            duration: currentSegment.endTime - currentSegment.startTime,
            averageDb: Math.round(currentSegment.averageDb * 100) / 100,
            minDb: Math.round(currentSegment.minDb * 100) / 100,
            maxDb: Math.round(currentSegment.maxDb * 100) / 100
        });
    }
    
    return quietSegments;
}


function findPeaks(levels, thresholdDb) {
    const peaks = [];
    
    for (let i = 1; i < levels.length - 1; i++) {
        if (levels[i].db > levels[i-1].db + thresholdDb && 
            levels[i].db > levels[i+1].db + thresholdDb) {
            peaks.push({
                time: levels[i].time,
                db: Math.round(levels[i].db * 100) / 100,
                rms: Math.round(levels[i].rms * 100) / 100
            });
        }
    }
    
    return peaks;
}


function generateRecommendations(stats) {
    const recommendations = [];
    
    if (stats.averageLevel < -30) {
        recommendations.push("Audio is very quiet overall - consider increasing volume");
    } else if (stats.averageLevel > -10) {
        recommendations.push("Audio is very loud - consider reducing volume to prevent clipping");
    }
    
    if (stats.quietSegments.length > 0) {
        recommendations.push(`Found ${stats.quietSegments.length} quiet segments (below threshold)`);
        if (stats.quietSegments.length > 5) {
            recommendations.push("Many quiet segments detected - consider audio compression or normalization");
        }
    }
    
    if (stats.maxLevel - stats.minLevel > 40) {
        recommendations.push("Large dynamic range detected - consider compression for consistent volume");
    }
    
    return recommendations;
}


async function getAverageVolume(audioUrl) {
    try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0);
        let sum = 0;
        
        // Calculate RMS
        for (let i = 0; i < channelData.length; i++) {
            sum += channelData[i] * channelData[i];
        }
        
        const rms = Math.sqrt(sum / channelData.length);
        const db = 20 * Math.log10(rms);
        
        return {
            averageVolume: Math.round(db * 100) / 100,
            rms: Math.round(rms * 100) / 100
        };
        
    } catch (error) {
        console.error('Error calculating average volume:', error);
        return null;
    }
}


async function createWaveformPreview(audioUrl, canvasId, width = 800, height = 200) {
    try {
        const analysis = await analyzeAudioFile(audioUrl, { windowSize: 0.05 });
        
        if (!analysis.success) {
            throw new Error(analysis.error);
        }
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas with id "${canvasId}" not found`);
            return;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, width, height);
        
        // Draw waveform
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const levels = analysis.levels;
        for (let i = 0; i < levels.length; i++) {
            const x = (i / levels.length) * width;
            // Convert dB to height (dB is negative, so we invert it)
            const db = levels[i].db;
            const normalizedHeight = Math.max(0, Math.min(1, (-db) / 60)); // Scale to 0-1
            const y = (1 - normalizedHeight) * height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // Highlight quiet segments
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        for (const segment of analysis.quietSegments) {
            const startX = (segment.start / analysis.metadata.duration) * width;
            const endX = (segment.end / analysis.metadata.duration) * width;
            ctx.fillRect(startX, 0, endX - startX, height);
        }
        
        return canvas.toDataURL();
        
    } catch (error) {
        console.error('Error creating waveform:', error);
    }
}


async function analyzeAudioExample() {

    const results = await analyzeAudioFile(audioUrl, {
        windowSize: 0.1, // Analyze every 100ms
        quietThreshold: -30, // dB threshold for "quiet"
        minQuietDuration: 2, // Minimum 2 seconds to count as "quiet segment"
        smoothingFactor: 0.7 // Smooth the volume curve
    });
    
    if (results.success) {
        console.log('Audio Analysis Results:');
        console.log('Duration:', results.metadata.duration, 'seconds');
        console.log('Average Level:', results.statistics.averageLevel, 'dB');
        console.log('Dynamic Range:', results.statistics.dynamicRange, 'dB');
        
        console.log('\nQuiet Segments:');
        results.quietSegments.forEach((segment, i) => {
            console.log(`  ${i+1}. ${segment.start.toFixed(1)}s - ${segment.end.toFixed(1)}s (${segment.duration.toFixed(1)}s)`);
        });
        
        console.log('\nRecommendations:');
        results.recommendations.forEach(rec => console.log('  -', rec));
    }
}


async function getAvgVolumeExample(audioUrl) {

    const volume = await getAverageVolume(audioUrl);
    
    if (volume) {
        console.log(`Average Volume: ${volume.averageVolume} dB`);
        console.log(`RMS: ${volume.rms}`);
    }
}


async function findQuietParts(audioUrl) {
    const analysis = await analyzeAudioFile(audioUrl);
    
    if (analysis.success) {
        return analysis.quietSegments;
    }
    return [];
}

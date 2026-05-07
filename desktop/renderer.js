const net = require('net');
const JMuxer = require('jmuxer');
const { exec } = require('child_process');
const path = require('path');

const adbPath = path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const videoElement = document.getElementById('stream');

const jmuxer = new JMuxer({
    node: videoElement,
    mode: 'video', 
    flushingTime: 0, // Instantly flush to reduce delay
    fps: 30,
    debug: false,
    onError: function(data) {}
});

let firstFrameReceived = false;

// 1. Video Socket (8080)
function connectVideoStream() {
    const videoSocket = new net.Socket();
    videoSocket.connect(8080, '127.0.0.1', () => {
        firstFrameReceived = false;
    });

    videoSocket.on('data', (data) => {
        if (!firstFrameReceived) firstFrameReceived = true;
        jmuxer.feed({ video: new Uint8Array(data) });
    });

    videoSocket.on('error', (err) => {
        videoSocket.destroy();
        setTimeout(connectVideoStream, 1500);
    });
    
    videoSocket.on('close', () => {
        setTimeout(connectVideoStream, 1500);
    });
}

// 2. Control Socket (8081)
let controlSocket = null;
function connectControlStream() {
    controlSocket = new net.Socket();
    controlSocket.connect(8081, '127.0.0.1', () => {});

    controlSocket.on('error', (err) => {
        controlSocket.destroy();
        setTimeout(connectControlStream, 1500);
    });
    
    controlSocket.on('close', () => {
        setTimeout(connectControlStream, 1500);
    });
}

connectVideoStream();
connectControlStream();

// 3. Helper to map screen coordinates
function mapCoordinates(clientX, clientY) {
    const rect = videoElement.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    if (!videoElement.videoWidth || !videoElement.videoHeight) return null;

    const elementRatio = rect.width / rect.height;
    const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
    
    let displayWidth = rect.width;
    let displayHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (elementRatio > videoRatio) {
        displayWidth = rect.height * videoRatio;
        offsetX = (rect.width - displayWidth) / 2;
    } else {
        displayHeight = rect.width / videoRatio;
        offsetY = (rect.height - displayHeight) / 2;
    }

    const adjustedX = clickX - offsetX;
    const adjustedY = clickY - offsetY;

    if (adjustedX >= 0 && adjustedX <= displayWidth && adjustedY >= 0 && adjustedY <= displayHeight) {
        return {
            x: Math.round((adjustedX / displayWidth) * videoElement.videoWidth),
            y: Math.round((adjustedY / displayHeight) * videoElement.videoHeight)
        };
    }
    return null;
}

// 4. Mouse Interactions (Tap & Swipe)
let isDragging = false;
let startCoords = null;
let startClientX = 0;
let startClientY = 0;
let startTime = 0;

videoElement.addEventListener('mousedown', (e) => {
    isDragging = true;
    startClientX = e.clientX;
    startClientY = e.clientY;
    startCoords = mapCoordinates(e.clientX, e.clientY);
    startTime = Date.now();
});

videoElement.addEventListener('mouseup', (e) => {
    if (!isDragging || !startCoords) return;
    isDragging = false;
    
    const endCoords = mapCoordinates(e.clientX, e.clientY);
    if (!endCoords) return;

    const timeDiff = Date.now() - startTime;
    // Measure distance in PC monitor pixels so it correctly detects a stationary "click"
    const clientDistance = Math.hypot(e.clientX - startClientX, e.clientY - startClientY);

    if (clientDistance < 10) {
        exec(`"${adbPath}" shell input tap ${endCoords.x} ${endCoords.y}`);
    } else {
        const duration = Math.max(100, Math.min(1000, timeDiff));
        exec(`"${adbPath}" shell input swipe ${startCoords.x} ${startCoords.y} ${endCoords.x} ${endCoords.y} ${duration}`);
    }
});

videoElement.addEventListener('mouseleave', () => {
    isDragging = false;
});

// 5. Mouse Wheel (Scroll)
let lastScrollTime = 0;
videoElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!videoElement.videoWidth || !videoElement.videoHeight) return;

    if (Date.now() - lastScrollTime < 400) return; // Throttle scrolling
    lastScrollTime = Date.now();

    const centerX = Math.round(videoElement.videoWidth / 2);
    const centerY = Math.round(videoElement.videoHeight / 2);
    const scrollAmount = Math.round(videoElement.videoHeight * 0.4);
    
    let swipeY = e.deltaY > 0 ? centerY - scrollAmount : centerY + scrollAmount;
    swipeY = Math.max(10, Math.min(videoElement.videoHeight - 10, swipeY));

    exec(`"${adbPath}" shell input swipe ${centerX} ${centerY} ${centerX} ${swipeY} 150`);
}, { passive: false });

// 6. Keyboard Input via ADB
window.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
        exec(`"${adbPath}" shell input keyevent 67`); // KEYCODE_DEL
    } else if (e.key === 'Enter') {
        exec(`"${adbPath}" shell input keyevent 66`); // KEYCODE_ENTER
    } else if (e.key === 'Home') {
        exec(`"${adbPath}" shell input keyevent 3`); // KEYCODE_HOME
    } else if (e.key === 'Escape') {
        exec(`"${adbPath}" shell input keyevent 4`); // KEYCODE_BACK
    } else if (e.key.length === 1) { // Printable character
        // Check for space specifically since shell text command handles it poorly sometimes
        if (e.key === ' ') {
            exec(`"${adbPath}" shell input keyevent 62`); // KEYCODE_SPACE
        } else {
            // Escape special shell characters safely
            const char = e.key.replace(/(["\s'$`\\])/g,'\\$1');
            exec(`"${adbPath}" shell input text "${char}"`);
        }
    }
});

// 7. Audio Socket (8082) & Web Audio API
let audioContext;
let nextAudioTime = 0;

function initAudio() {
    if (audioContext) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext({ sampleRate: 44100 });
}

function connectAudioStream() {
    const audioSocket = new net.Socket();
    audioSocket.connect(8082, '127.0.0.1', () => {
        initAudio();
    });

    audioSocket.on('data', (data) => {
        if (!audioContext) return;
        
        // Convert Node Buffer to Int16Array
        const int16Array = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
        
        // Convert Int16Array to Float32Array (-1.0 to 1.0)
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / 32768.0;
        }

        // Create AudioBuffer (Mono, 44100Hz)
        const audioBuffer = audioContext.createBuffer(1, float32Array.length, 44100);
        audioBuffer.getChannelData(0).set(float32Array);

        // Schedule gapless playback
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        const currentTime = audioContext.currentTime;
        if (nextAudioTime < currentTime) {
            nextAudioTime = currentTime; // Reset if we fell behind to avoid huge latency
        }
        
        source.start(nextAudioTime);
        nextAudioTime += audioBuffer.duration;
    });

    audioSocket.on('error', (err) => {
        audioSocket.destroy();
        setTimeout(connectAudioStream, 1500);
    });
    
    audioSocket.on('close', () => {
        setTimeout(connectAudioStream, 1500);
    });
}
connectAudioStream();

// Browsers require a user gesture to start AudioContext.
window.addEventListener('click', () => {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
});

const net = require('net');
const JMuxer = require('jmuxer');

const videoElement = document.getElementById('stream');

// Initialize JMuxer to handle raw H264 decoding via HTML5 video
const jmuxer = new JMuxer({
    node: videoElement,
    mode: 'video', // basic version handling only video
    flushingTime: 0,
    fps: 30,
    debug: false,
    onError: function(data) {
        console.error('JMuxer error:', data);
    }
});

// 1. Video Socket (8080)
const videoSocket = new net.Socket();
videoSocket.connect(8080, '127.0.0.1', () => {
    console.log('Connected to video stream on port 8080');
});

videoSocket.on('data', (data) => {
    // Feed the raw H264 chunks into jmuxer
    jmuxer.feed({
        video: new Uint8Array(data)
    });
});

videoSocket.on('error', (err) => {
    console.error('Video socket error (ensure Android streaming service is running):', err.message);
});

// 2. Control Socket (8081)
const controlSocket = new net.Socket();
controlSocket.connect(8081, '127.0.0.1', () => {
    console.log('Connected to control stream on port 8081');
});

controlSocket.on('error', (err) => {
    console.error('Control socket error:', err.message);
});

// 3. Handle Video Element Clicks and coordinate mapping
videoElement.addEventListener('click', (event) => {
    const rect = videoElement.getBoundingClientRect();
    
    // Get click coordinates relative to the video HTML element bounds
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    if (videoElement.videoWidth && videoElement.videoHeight) {
        // Calculate the actual displayed size of the video accounting for CSS object-fit: contain
        const elementRatio = rect.width / rect.height;
        const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
        
        let displayWidth = rect.width;
        let displayHeight = rect.height;
        let offsetX = 0;
        let offsetY = 0;

        if (elementRatio > videoRatio) {
            // Pillarbox (black bars on left/right sides)
            displayWidth = rect.height * videoRatio;
            offsetX = (rect.width - displayWidth) / 2;
        } else {
            // Letterbox (black bars on top/bottom)
            displayHeight = rect.width / videoRatio;
            offsetY = (rect.height - displayHeight) / 2;
        }

        // Adjust coordinates relative to the actual video frame
        const adjustedX = clickX - offsetX;
        const adjustedY = clickY - offsetY;

        // Only send touch if the click was within the actual video area (not the black bars)
        if (adjustedX >= 0 && adjustedX <= displayWidth && adjustedY >= 0 && adjustedY <= displayHeight) {
            // Scale up to the device's native resolution
            const mappedX = Math.round((adjustedX / displayWidth) * videoElement.videoWidth);
            const mappedY = Math.round((adjustedY / displayHeight) * videoElement.videoHeight);
            
            // Format and send JSON payload with a newline delimiter
            const payload = JSON.stringify({ action: 'tap', x: mappedX, y: mappedY }) + '\n';
            
            if (!controlSocket.destroyed) {
                controlSocket.write(payload);
                console.log('Sent tap command:', payload);
            }
        }
    }
});

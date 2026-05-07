const net = require('net');
const JMuxer = require('jmuxer');

const videoElement = document.getElementById('stream');

// Initialize JMuxer with debug true and a higher flushingTime
const jmuxer = new JMuxer({
    node: videoElement,
    mode: 'video', 
    flushingTime: 100, 
    fps: 30,
    debug: false, // Mute spam
    onError: function(data) {
        // Mute spam
    }
});

let firstFrameReceived = false;

// 1. Video Socket (8080) with Auto-Reconnect
function connectVideoStream() {
    console.log('Attempting to connect to video stream (8080)...');
    const videoSocket = new net.Socket();
    
    videoSocket.connect(8080, '127.0.0.1', () => {
        console.log('✅ Connected to video stream on port 8080');
        firstFrameReceived = false;
    });

    videoSocket.on('data', (data) => {
        if (!firstFrameReceived) {
            const hex = Array.from(new Uint8Array(data.slice(0, 64)))
                             .map(b => b.toString(16).padStart(2, '0'))
                             .join(' ');
            
            // Print to screen so it's easy to see
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.top = '10px';
            div.style.left = '10px';
            div.style.background = 'rgba(0,0,0,0.8)';
            div.style.color = 'lime';
            div.style.padding = '20px';
            div.style.zIndex = '9999';
            div.style.userSelect = 'text'; // Allow highlighting
            div.innerHTML = `<b>First 64 Bytes:</b><br><br>${hex}`;
            document.body.appendChild(div);

            firstFrameReceived = true;
        }
        // Feed the raw H264 chunks into jmuxer
        jmuxer.feed({
            video: new Uint8Array(data)
        });
    });

    videoSocket.on('error', (err) => {
        console.error('Video socket error:', err.message);
        videoSocket.destroy();
        setTimeout(connectVideoStream, 1500); // Retry every 1.5 seconds
    });
    
    videoSocket.on('close', () => {
        console.log('Video socket closed. Reconnecting...');
        setTimeout(connectVideoStream, 1500);
    });
}

// 2. Control Socket (8081) with Auto-Reconnect
let controlSocket = null;
function connectControlStream() {
    console.log('Attempting to connect to control stream (8081)...');
    controlSocket = new net.Socket();
    
    controlSocket.connect(8081, '127.0.0.1', () => {
        console.log('✅ Connected to control stream on port 8081');
    });

    controlSocket.on('error', (err) => {
        console.error('Control socket error:', err.message);
        controlSocket.destroy();
        setTimeout(connectControlStream, 1500);
    });
    
    controlSocket.on('close', () => {
        console.log('Control socket closed. Reconnecting...');
        setTimeout(connectControlStream, 1500);
    });
}

connectVideoStream();
connectControlStream();

// 3. Handle Video Element Clicks and coordinate mapping
videoElement.addEventListener('click', (event) => {
    const rect = videoElement.getBoundingClientRect();
    
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    if (videoElement.videoWidth && videoElement.videoHeight) {
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
            const mappedX = Math.round((adjustedX / displayWidth) * videoElement.videoWidth);
            const mappedY = Math.round((adjustedY / displayHeight) * videoElement.videoHeight);
            
            const payload = JSON.stringify({ action: 'tap', x: mappedX, y: mappedY }) + '\n';
            
            if (controlSocket && !controlSocket.destroyed) {
                controlSocket.write(payload);
                console.log('Sent tap command:', payload);
            }
        }
    }
});

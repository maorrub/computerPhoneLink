const net = require('net');
const socket = new net.Socket();
socket.connect(8081, '127.0.0.1', () => {
    console.log("Connected, sending swipe...");
    const payload = JSON.stringify({action: "swipe", x1: 500, y1: 1000, x2: 500, y2: 500, duration: 200}) + "\n";
    socket.write(payload);
    setTimeout(() => {
        socket.destroy();
        console.log("Done");
    }, 1000);
});
socket.on('error', (err) => {
    console.error("Socket error:", err.message);
});

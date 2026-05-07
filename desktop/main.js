const { app, BrowserWindow } = require('electron');
const { exec } = require('child_process');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 450,
    height: 800, // Phone proportion
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  // Setup adb forwarding
  console.log('Setting up adb port forwarding...');
  exec('adb forward tcp:8080 tcp:8080', (error, stdout, stderr) => {
    if (error) console.error(`adb forward 8080 error: ${error.message}`);
  });
  exec('adb forward tcp:8081 tcp:8081', (error, stdout, stderr) => {
    if (error) console.error(`adb forward 8081 error: ${error.message}`);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

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
  const adbPath = path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
  
  exec(`"${adbPath}" forward tcp:8080 tcp:8080`, (error, stdout, stderr) => {
    if (error) console.error(`adb forward 8080 error: ${error.message}`);
  });
  exec(`"${adbPath}" forward tcp:8081 tcp:8081`, (error, stdout, stderr) => {
    if (error) console.error(`adb forward 8081 error: ${error.message}`);
  });
  exec(`"${adbPath}" forward tcp:8082 tcp:8082`, (error, stdout, stderr) => {
    if (error) console.error(`adb forward 8082 error: ${error.message}`);
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

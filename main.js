const { app, BrowserWindow, ipcMain } = require('electron');
const { initMain: initAudioLoopback } = require('electron-audio-loopback');
const path = require('node:path');
const fs = require('fs');

initAudioLoopback();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 700,
    title: 'Audio & Screen Recorder',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
    }
  });

  mainWindow.webContents.openDevTools();
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  // Create recordings directory if it doesn't exist
  const recordingsDir = path.join(__dirname, 'recordings');
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }
  console.log('Recordings will be saved to:', recordingsDir);

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle save recording request
ipcMain.on('save-recording', async (event, audioData, filename) => {
  try {
    const recordingsDir = path.join(__dirname, 'recordings');
    const filePath = path.join(recordingsDir, filename);

    const buffer = Buffer.from(audioData);

    fs.writeFile(filePath, buffer, (err) => {
      if (err) {
        console.error('Error saving recording:', err);
        event.reply('save-recording-response', { success: false, error: err.message });
      } else {
        console.log('✓ Saved recording:', filename, `(${(buffer.length / 1024).toFixed(2)} KB)`);
        event.reply('save-recording-response', { success: true, filename });
      }
    });
  } catch (err) {
    console.error('Error in save-recording handler:', err);
    event.reply('save-recording-response', { success: false, error: err.message });
  }
});

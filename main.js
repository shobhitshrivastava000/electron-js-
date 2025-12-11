const { app, BrowserWindow, ipcMain } = require('electron');
const { initMain: initAudioLoopback } = require('electron-audio-loopback');
const path = require('node:path');
const fs = require('fs');
const crypto = require("crypto");

const AES_KEY = Buffer.from("downsizeablesecrettoencryptaudio", "utf8"); // must be 32 bytes
const IV_LENGTH = 16; // CBC always 16 bytes


function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]); // SAME as your Flutter code
}

function decryptBuffer(buffer) {
  const iv = buffer.slice(0, IV_LENGTH);
  const encryptedData = buffer.slice(IV_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-cbc", AES_KEY, iv);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

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
ipcMain.on("save-recording", async (event, audioData, filename) => {
  try {
    const recordingsDir = path.join(__dirname, "recordings");

    const encryptedDir = path.join(recordingsDir, "encrypted");
    const decryptedDir = path.join(recordingsDir, "decrypted");

    if (!fs.existsSync(encryptedDir)) fs.mkdirSync(encryptedDir, { recursive: true });
    if (!fs.existsSync(decryptedDir)) fs.mkdirSync(decryptedDir, { recursive: true });

    const originalBuffer = Buffer.from(audioData);

    // Encrypt
    const encryptedBuffer = encryptBuffer(originalBuffer);

    const encryptedFilePath = path.join(
      encryptedDir,
      filename.replace(".webm", "_encrypted.webm").replace(".wav", "_encrypted.wav")
    );

    fs.writeFileSync(encryptedFilePath, encryptedBuffer);

    // Decrypt immediately (for validation)
    const decryptedBuffer = decryptBuffer(encryptedBuffer);

    const decryptedFilePath = path.join(
      decryptedDir,
      filename.replace(".webm", "_decrypted.webm").replace(".wav", "_decrypted.wav")
    );

    fs.writeFileSync(decryptedFilePath, decryptedBuffer);

    console.log(`✓ Saved encrypted: ${encryptedFilePath}`);
    console.log(`✓ Saved decrypted: ${decryptedFilePath}`);

    event.reply("save-recording-response", { success: true, filename });
  } catch (error) {
    console.error("Encryption/Decryption error:", error);
    event.reply("save-recording-response", { success: false, error: error.message });
  }
});

const { app, BrowserWindow, ipcMain } = require("electron");
const { initMain: initAudioLoopback } = require("electron-audio-loopback");
const path = require("node:path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

const AES_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "utf8"); // must be 32 bytes
const IV_LENGTH = 16; // CBC always 16 bytes

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]); // SAME as your Flutter code
}

initAudioLoopback();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 700,
    title: "Audio & Screen Recorder",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.webContents.openDevTools();
  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  // Create recordings directory if it doesn't exist
  const recordingsDir = path.join(__dirname, "recordings");
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }
  console.log("Recordings will be saved to:", recordingsDir);

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// Handle save recording request
ipcMain.on("save-recording", async (event, audioData, filename) => {
  try {
    const recordingsDir = path.join(__dirname, "recordings");

    const encryptedDir = path.join(recordingsDir, "encrypted");
    if (!fs.existsSync(encryptedDir))
      fs.mkdirSync(encryptedDir, { recursive: true });

    const originalBuffer = Buffer.from(audioData);

    // Encrypt
    const encryptedBuffer = encryptBuffer(originalBuffer);

    const encryptedFilePath = path.join(
      encryptedDir,
      filename
        .replace(".webm", "_encrypted.webm")
        .replace(".wav", "_encrypted.wav")
    );

    fs.writeFileSync(encryptedFilePath, encryptedBuffer);
    event.reply("save-recording-response", { success: true, filename });
  } catch (error) {
    console.error("Encryption error:", error);
    event.reply("save-recording-response", {
      success: false,
      error: error.message,
    });
  }
});

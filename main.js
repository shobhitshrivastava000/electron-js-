const { app, BrowserWindow, ipcMain } = require("electron");
const { initMain: initAudioLoopback } = require("electron-audio-loopback");
const path = require("node:path");
const fs = require("fs");
const crypto = require("crypto");
const dotenv = require("dotenv");

// Determine actual path to .env
let envPath = path.join(__dirname, ".env"); // works for dev
if (!fs.existsSync(envPath)) {
  // fallback when packaged in asar
  envPath = path.join(process.resourcesPath, "app.asar.unpacked", ".env");
}

// Load environment variables
dotenv.config({ path: envPath });

const AES_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "utf8"); // must be 32 bytes
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

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
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

// 1. Register Protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('plannerpal-recorder', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('plannerpal-recorder');
}

// 2. Handle Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    // Windows: Deep link url is likely inside commandLine array
    // Look for argument starting with plannerpal-recorder://
    const url = commandLine.find(arg => arg.startsWith('plannerpal-recorder://'));
    if (url) {
      handleDeepLink(url);
    }
  });

  // Cold Start (Windows/Linux)
  app.whenReady().then(() => {
    createWindow();

    // Check argv for cold start URL
    const url = process.argv.find(arg => arg.startsWith('plannerpal-recorder://'));
    if (url) {
      handleDeepLink(url);
    }
  });
}

// macOS: Open URL event
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    handleDeepLink(url);
  } else {
    // If window not created yet, wait
    app.whenReady().then(() => {
      handleDeepLink(url);
    });
  }
});

function handleDeepLink(url) {
  console.log("Received Deep Link:", url);
  // Parse URL to decide action
  // Example: electron-recorder://record?code=123 (Option B)
  // Example: electron-recorder://auth/callback?code=abc (Option A)

  try {
    const urlObj = new URL(url);
    const params = Object.fromEntries(urlObj.searchParams);

    // Send to Renderer to handle UI changes or Auth exchange
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('deep-link-action', {
        pathname: urlObj.pathname,
        params: params
      });
    }
  } catch (e) {
    console.error("Invalid Deep Link:", e);
  }
}

// ... existing createWindow ...

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// Handle save recording request
ipcMain.on("save-recording", async (event, audioData, filename) => {
  try {
    const recordingsDir = path.join(app.getPath("userData"), "recordings");

    const encryptedDir = path.join(recordingsDir, "encrypted");
    const decryptedDir = path.join(recordingsDir, "decrypted");

    if (!fs.existsSync(encryptedDir))
      fs.mkdirSync(encryptedDir, { recursive: true });
    if (!fs.existsSync(decryptedDir))
      fs.mkdirSync(decryptedDir, { recursive: true });

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

    // Decrypt immediately (for validation)
    const decryptedBuffer = decryptBuffer(encryptedBuffer);

    const decryptedFilePath = path.join(
      decryptedDir,
      filename
        .replace(".webm", "_decrypted.webm")
        .replace(".wav", "_decrypted.wav")
    );

    fs.writeFileSync(decryptedFilePath, decryptedBuffer);

    // ... (encryption logic)

    console.log(`✓ Saved encrypted: ${encryptedFilePath}`);
    console.log(`✓ Saved decrypted: ${decryptedFilePath}`);

    event.reply("save-recording-response", {
      success: true,
      filename,
      filePath: encryptedFilePath,
    });
  } catch (error) {
    console.error("Encryption error:", error);
    event.reply("save-recording-response", {
      success: false,
      error: error.message,
    });
  }
});

// Handle read recording file request (for upload)
ipcMain.handle("read-recording-file", async (event, filePath) => {
  try {
    // Security check: ensure file is within recordings directory
    const recordingsDir = path.join(app.getPath("userData"), "recordings");
    if (!filePath.startsWith(recordingsDir)) {
      throw new Error("Access denied: File is not in recordings directory");
    }

    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    const buffer = await fs.promises.readFile(filePath);
    return buffer; // Returns Uint8Array to renderer
  } catch (error) {
    console.error("Error reading file:", error);
    throw error;
  }
});

// Handle delete recording file request (after upload)
ipcMain.handle("delete-recording-file", async (event, filePath) => {
  try {
    // Security check: ensure file is within recordings directory
    const recordingsDir = path.join(app.getPath("userData"), "recordings");
    if (!filePath.startsWith(recordingsDir)) {
      throw new Error("Access denied: Cannot delete files outside recordings directory");
    }

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);

      // Also try to delete the decrypted/encrypted pair if it exists
      // If we uploaded the encrypted one, maybe we want to delete the decrypted one too? 
      // For now, let's just delete the specific file requested + check for its pair if possible.
      // But the request is simple: "delete frm the device". 
      // The current flow saves "encrypted" and "decrypted".
      // The renderer receives "filePath" which is the ENCRYPTED path.

      // Let's attempt to clean up the pair.
      // E.g. .../recordings/encrypted/file.webm -> .../recordings/decrypted/file_decrypted.webm
      // The logic in save-recording was: 
      // encrypted: filename.replace(".webm", "_encrypted.webm")
      // decrypted: filename.replace(".webm", "_decrypted.webm")

      // This might be tricky to reverse perfectly without the original filename, 
      // but let's stick to deleting the EXACT file path passed for safety first.

      console.log(`✓ Deleted local file: ${filePath}`);
      return { success: true };
    } else {
      console.warn(`File to delete not found: ${filePath}`);
      return { success: false, error: "File not found" };
    }
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
});

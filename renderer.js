const chunkStorage = new Map();

class ScreenRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.combinedStream = null;
    this.audioContext = null;
    this.chunkInterval = null;
    this.chunkNumber = 0;
    this.recordingStartTime = null;
    this.microphoneStream = null;
    this.systemAudioStream = null;
    this.videoStream = null;
  }

  async startRecording(microphoneStream, systemAudioStream, videoStream) {
    if (this.isRecording) return;

    try {
      // Store streams for recreating MediaRecorder
      this.microphoneStream = microphoneStream;
      this.systemAudioStream = systemAudioStream;
      this.videoStream = videoStream;

      // Create audio context to mix streams
      this.audioContext = new AudioContext({ sampleRate: 48000 });

      // Create sources for both streams
      const micSource =
        this.audioContext.createMediaStreamSource(microphoneStream);
      const systemSource =
        this.audioContext.createMediaStreamSource(systemAudioStream);

      // Create a destination to combine audio
      const destination = this.audioContext.createMediaStreamDestination();

      // Create gain nodes for volume control
      const micGain = this.audioContext.createGain();
      const systemGain = this.audioContext.createGain();

      micGain.gain.value = 1.0; // Microphone at 100%
      systemGain.gain.value = 1.0; // System audio at 100%

      // Connect: sources -> gains -> destination
      micSource.connect(micGain);
      systemSource.connect(systemGain);
      micGain.connect(destination);
      systemGain.connect(destination);

      // Combine audio destination with video stream
      const audioTracks = destination.stream.getAudioTracks();
      const videoTracks = videoStream.getVideoTracks();

      this.combinedStream = new MediaStream([...audioTracks, ...videoTracks]);

      this.recordedChunks = [];
      this.isRecording = true;
      this.chunkNumber = 0;

      // Create initial MediaRecorder
      this.createMediaRecorder();

      // Set up 30-second chunk interval
      this.chunkInterval = setInterval(() => {
        this.saveCurrentChunk();
      }, 30000); // 30 seconds

      console.log("Screen recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  }

  createMediaRecorder() {
    // Start recording with WebM format
    this.mediaRecorder = new MediaRecorder(this.combinedStream, {
      mimeType: "video/webm;codecs=vp9,opus",
    });

    this.recordingStartTime = Date.now();

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      await this.processSaveChunk();

      // If still recording, create new MediaRecorder for next chunk
      if (this.isRecording) {
        this.recordedChunks = [];
        this.createMediaRecorder();
      }
    };

    this.mediaRecorder.start(1000); // Collect data every second
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;

    // Clear chunk interval
    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    this.isRecording = false;

    // Stop will trigger onstop which saves the final chunk
    if (this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    console.log("Recording stopped");
  }

  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause();
      // Clear chunk interval while paused
      if (this.chunkInterval) {
        clearInterval(this.chunkInterval);
        this.chunkInterval = null;
      }
      console.log("Screen recording paused");
    }
  }

  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume();
      // Restart chunk interval
      this.chunkInterval = setInterval(() => {
        this.saveCurrentChunk();
      }, 30000);
      console.log("Screen recording resumed");
    }
  }

  async saveCurrentChunk() {
    if (!this.isRecording || !this.mediaRecorder) return;

    // Stop current MediaRecorder (onstop will handle save and restart)
    if (this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    }
  }

  async processSaveChunk() {
    if (this.recordedChunks.length === 0) {
      console.log("No chunks to save");
      return;
    }

    try {
      // Create WebM blob from current chunks
      const blob = new Blob(this.recordedChunks, { type: "video/webm" });

      // Generate filename with chunk number
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      this.chunkNumber++;
      const filename = `screen_recording_${timestamp}_chunk_${this.chunkNumber}.webm`;

      // Store in global memory map and queue for upload (No local disk save)
      uploadManager.queueMemoryUpload(blob, filename);

      const durationSeconds = (
        (Date.now() - this.recordingStartTime) /
        1000
      ).toFixed(1);
      console.log(
        `Chunk ${this.chunkNumber} queued in memory: ${filename} (${durationSeconds}s)`
      );
    } catch (error) {
      console.error("Error saving chunk:", error);
      alert("Error saving chunk: " + error.message);
    }
  }

  cleanup() {
    // Clear interval
    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    // Cleanup audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.recordedChunks = [];
    this.chunkNumber = 0;
    this.microphoneStream = null;
    this.systemAudioStream = null;
    this.videoStream = null;
    this.combinedStream = null;
  }
}

class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.combinedStream = null;
    this.audioContext = null;
    this.chunkInterval = null;
    this.chunkNumber = 0;
    this.recordingStartTime = null;
    this.microphoneStream = null;
    this.systemAudioStream = null;
  }

  async startRecording(microphoneStream, systemAudioStream) {
    if (this.isRecording) return;

    try {
      // Store streams for recreating MediaRecorder
      this.microphoneStream = microphoneStream;
      this.systemAudioStream = systemAudioStream;

      // Create audio context to mix streams
      this.audioContext = new AudioContext({ sampleRate: 48000 });

      // Create sources for both streams
      const micSource =
        this.audioContext.createMediaStreamSource(microphoneStream);
      const systemSource =
        this.audioContext.createMediaStreamSource(systemAudioStream);

      // Create a destination to combine audio
      const destination = this.audioContext.createMediaStreamDestination();

      // Create gain nodes for volume control
      const micGain = this.audioContext.createGain();
      const systemGain = this.audioContext.createGain();

      micGain.gain.value = 1.0; // Microphone at 100%
      systemGain.gain.value = 1.0; // System audio at 100%

      // Connect: sources -> gains -> destination
      micSource.connect(micGain);
      systemSource.connect(systemGain);
      micGain.connect(destination);
      systemGain.connect(destination);

      this.combinedStream = destination.stream;

      this.audioChunks = [];
      this.isRecording = true;
      this.chunkNumber = 0;

      // Create initial MediaRecorder
      this.createMediaRecorder();

      // Set up 30-second chunk interval
      this.chunkInterval = setInterval(() => {
        this.saveCurrentChunk();
      }, 30000); // 30 seconds

      console.log("Audio recording started with 30-second chunks");
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  }

  createMediaRecorder() {
    // Start recording with WebM format
    this.mediaRecorder = new MediaRecorder(this.combinedStream, {
      mimeType: "audio/webm;codecs=opus",
    });

    this.recordingStartTime = Date.now();

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      await this.processSaveChunk();

      // If still recording, create new MediaRecorder for next chunk
      if (this.isRecording) {
        this.audioChunks = [];
        this.createMediaRecorder();
      }
    };

    this.mediaRecorder.start(1000); // Collect data every second
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;

    // Clear chunk interval
    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    this.isRecording = false;

    // Stop will trigger onstop which saves the final chunk
    if (this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    console.log("Recording stopped");
  }

  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.pause();
      // Clear chunk interval while paused
      if (this.chunkInterval) {
        clearInterval(this.chunkInterval);
        this.chunkInterval = null;
      }
      console.log("Audio recording paused");
    }
  }

  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === "paused") {
      this.mediaRecorder.resume();
      // Restart chunk interval
      this.chunkInterval = setInterval(() => {
        this.saveCurrentChunk();
      }, 30000);
      console.log("Audio recording resumed");
    }
  }

  async saveCurrentChunk() {
    if (!this.isRecording || !this.mediaRecorder) return;

    // Stop current MediaRecorder (onstop will handle save and restart)
    if (this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    }
  }

  async processSaveChunk() {
    if (this.audioChunks.length === 0) {
      console.log("No audio chunks to save");
      return;
    }

    try {
      // Create WebM blob
      const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Convert to WAV format
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      const wavBlob = this.audioBufferToWav(audioBuffer);

      // Generate filename with chunk number
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      this.chunkNumber++;
      const filename = `audio_recording_${timestamp}_chunk_${this.chunkNumber}.wav`;

      // Store in global memory map and queue for upload (No local disk save)
      uploadManager.queueMemoryUpload(wavBlob, filename);

      const durationSeconds = (
        (Date.now() - this.recordingStartTime) /
        1000
      ).toFixed(1);
      console.log(
        `Chunk ${this.chunkNumber} queued in memory: ${filename} (${durationSeconds}s)`
      );
    } catch (error) {
      console.error("Error saving chunk:", error);
      alert("Error saving chunk: " + error.message);
    }
  }

  audioBufferToWav(buffer) {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(
          -1,
          Math.min(1, buffer.getChannelData(channel)[i])
        );
        view.setInt16(offset, sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  cleanup() {
    // Clear interval
    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    // Cleanup audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioChunks = [];
    this.chunkNumber = 0;
    this.microphoneStream = null;
    this.systemAudioStream = null;
    this.combinedStream = null;
  }
}

// Network Quality Monitor
function getNetworkQuality() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return 'unknown';
  // console.log("Current Quality:", connection.effectiveType);
  return connection.effectiveType; // 'slow-2g', '2g', '3g', '4g'
}

// --- Auth Manager (PKCE) ---
const AUTH_CONFIG = {
  // TODO: FILL THESE IN WITH YOUR COGNITO DETAILS
  domain: "https://your-domain.auth.us-east-1.amazoncognito.com",
  clientId: "YOUR_COGNITO_CLIENT_ID",
  redirectUri: "electron-recorder://auth/callback",
  region: "us-east-1",
  scope: "openid profile email"
};

class AuthManager {
  constructor() {
    this.accessToken = null;
    this.idToken = null;
    this.refreshToken = null;
    this.verifier = null;

    // Listen for deep links from main process
    if (window.electronAPI && window.electronAPI.onDeepLink) {
      window.electronAPI.onDeepLink(async (data) => {
        console.log("Renderer received deep link:", data);

        // Handle Auth Callback
        if (data.pathname === "//auth/callback" || data.pathname === "auth/callback") {
          if (data.params.code) {
            await this.exchangeCodeForTokens(data.params.code);
          }
        }

        // Handle "Record" action (e.g. from web app)
        if (data.pathname === "//record" || data.pathname === "record") {
          console.log("Record request received via deep link");
          // If not logged in, trigger login first
          if (!this.isAuthenticated()) {
            await this.startLogin();
          } else {
            // Ready to record!
            this.showReadyState();
          }
        }
      });
    }
  }

  isAuthenticated() {
    // Basic check - in real app check expiry
    return !!this.accessToken;
  }

  showReadyState() {
    alert("Authenticated and Ready to Record!");
    // Update UI to show logged in state
    const statusEl = document.getElementById('recordStatus');
    if (statusEl) statusEl.textContent = "Ready (Logged In)";
  }

  async startLogin() {
    // 1. Generate PKCE
    const { verifier, challenge } = await this.generatePKCE();
    this.verifier = verifier;

    // 2. Build URL
    const url = `${AUTH_CONFIG.domain}/oauth2/authorize?` +
      `client_id=${AUTH_CONFIG.clientId}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(AUTH_CONFIG.scope)}&` +
      `redirect_uri=${encodeURIComponent(AUTH_CONFIG.redirectUri)}&` +
      `code_challenge_method=S256&` +
      `code_challenge=${challenge}`;

    // 3. Open in System Browser
    console.log("Opening auth url:", url);
    // We can't use shell directly in renderer usually, but window.open works for external if config allows
    // Or simpler: just print it for now or assume main process handles 'new-window'
    // Ideally usage: window.open(url) -> which electron intercepts
    window.open(url, '_blank');
  }

  async exchangeCodeForTokens(code) {
    if (!this.verifier) {
      console.error("No PKCE verifier found. Did you start the login flow?");
      return;
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: AUTH_CONFIG.clientId,
        code: code,
        redirect_uri: AUTH_CONFIG.redirectUri,
        code_verifier: this.verifier
      });

      const response = await fetch(`${AUTH_CONFIG.domain}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Token exchange failed: ${txt}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.idToken = data.id_token;
      this.refreshToken = data.refresh_token; // Save this securely!

      console.log("Login Successful!", data);
      this.showReadyState();

    } catch (err) {
      console.error("Auth Error:", err);
      alert("Authentication Failed: " + err.message);
    }
  }

  // --- PKCE Helpers ---
  async generatePKCE() {
    const verifier = this.generateRandomString(128);
    const challenge = await this.pkceChallengeFromVerifier(verifier);
    return { verifier, challenge };
  }

  generateRandomString(length) {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  async pkceChallengeFromVerifier(v) {
    const encoder = new TextEncoder();
    const data = encoder.encode(v);
    const result = await window.crypto.subtle.digest('SHA-256', data);
    return this.base64URLEncode(result);
  }

  base64URLEncode(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

// ---------------------------

class UploadManager {
  constructor() {
    this.queue = []; // Use in-memory queue, no localStorage for queue persistence
    this.isProcessing = false;
    this.uploadUrl = "https://your-server-endpoint.com/upload"; // REPLACE THIS

    // Bind methods
    this.processQueue = this.processQueue.bind(this);

    // Listen for online status
    window.addEventListener("online", () => {
      console.log("Network restored. Processing upload queue...");

      // Hide warning if it was shown
      const warningEl = document.getElementById('networkWarning');
      if (warningEl) warningEl.style.display = 'none';

      this.processQueue();
    });

    // Listen for offline status
    window.addEventListener("offline", () => {
      console.log("Network went offline.");

      // Show warning if recording
      const warningEl = document.getElementById('networkWarning');
      if (currentRecorder && currentRecorder.isRecording) {
        if (warningEl) {
          // Optional: Update text to be specific to Offline
          const title = warningEl.querySelector('h4');
          const msg = warningEl.querySelector('p');
          if (title) title.textContent = "⚠️ No Internet Connection";
          if (msg) msg.textContent = "You are offline. Uploads are paused. Record locally or pause?";

          warningEl.style.display = 'block';
        }
      }
    });

    // Listen for network quality changes
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', () => {
        console.log(`Network quality changed to: ${connection.effectiveType}`);
        // Treat '3g' (which can be slow) as weak too, or just strictly '2g'?
        // User says "when... 3g, then only i am getting popup" implying they WANT it on 3g? 
        // Or that they ARE getting it on 3g and that's wrong?
        // "when the internet network connection is 3g , then only i am getting the popup"
        // This phrasing usually means "I only see it on 3g [and i want to see it on others too]" OR "It is happening on 3g [confirming behavior]"
        // But standard '3g' is often considered "usable".
        // However, usually users want stricter checks.
        // Let's assume they want to include '3g' in the "Weak" definition if they are testing with "Slow 3G".

        // Wait, "Slow 3G" in dev tools often reports as '2g' or '3g' effective type.
        // If the user currently sees it ONLY on 3g, that's weird because the code is:
        // const isWeak = connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';

        // Maybe they mean "I WANT it to show on 3g too"? 
        // Let's expand the definition of weak to include '3g' to be safe and more responsive.

        const isWeak = connection.effectiveType === 'slow-2g' ||
          connection.effectiveType === '2g' ||
          connection.effectiveType === '3g';

        // 1. Handle Active Recording Alert
        const warningEl = document.getElementById('networkWarning');
        if (isWeak && currentRecorder && currentRecorder.isRecording) {
          // Show warning popup
          if (warningEl) warningEl.style.display = 'block';
        } else {
          // Hide if improved (now strictly 4g is considered "Good")
          if (warningEl && !isWeak) warningEl.style.display = 'none';
        }

        // 2. Handle Uploads
        if (!isWeak) {
          this.processQueue();
        } else {
          console.log("Network weak - pausing uploads to prevent congestion");
        }
      });
    }

    // Process on init in case we have leftovers
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  queueMemoryUpload(blob, filename) {
    const id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    chunkStorage.set(id, blob);

    const item = {
      id: id,
      filename: filename,
      addedAt: new Date().toISOString(),
      attempts: 0
    };

    this.queue.push(item);
    console.log(`Added ${filename} to memory upload queue. Pending: ${this.queue.length}`);
    this.processQueue();
  }

  removeFromQueue(id) {
    this.queue = this.queue.filter(item => item.id !== id);
    // this.saveQueue(); // No persistence
  }

  saveQueue() {
    // localStorage.setItem("uploadQueue", JSON.stringify(this.queue));
    // Disabled persistence as we are using in-memory blobs which cannot be JSON serialized
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    // 1. Check Offline
    if (!navigator.onLine) {
      console.log("Offline: Uploads paused.");
      return;
    }

    // 2. Check Weak Connection (New Feature)
    const quality = getNetworkQuality();
    if (quality === 'slow-2g' || quality === '2g') {
      console.log(`Network too weak for upload (${quality}). Queuing for later.`);
      return;
    }

    this.isProcessing = true;

    try {
      // Process one by one (FIFO)
      // We look at the first item
      const item = this.queue[0];

      console.log(`Attempting to upload: ${item.filename} (Attempt ${item.attempts + 1})`);

      try {
        // 1. Retrieve Blob from memory
        const blob = chunkStorage.get(item.id);

        if (!blob) {
          throw new Error("File data not found in memory (app may have been reloaded)");
        }

        // 3. Upload
        const formData = new FormData();
        formData.append("file", blob, item.filename);

        // Mock upload delay for demonstration if URL is dummy
        if (this.uploadUrl.includes("your-server-endpoint")) {
          await new Promise(r => setTimeout(r, 1000));
          console.log("Simulated upload success (Update URL in renderer.js)");
        } else {
          const response = await fetch(this.uploadUrl, {
            method: "POST",
            body: formData,
          });
          if (!response.ok) throw new Error(`Server returned ${response.status}`);
        }

        console.log(`Successfully uploaded: ${item.filename}`);

        // Clean up memory
        chunkStorage.delete(item.id);


        this.removeFromQueue(item.id);

      } catch (error) {
        console.error(`Upload failed for ${item.filename}:`, error);
        item.attempts++;
        this.saveQueue();

        // If file not found (maybe deleted by user?), remove it
        if (error.message.includes("File not found")) {
          console.warn("File missing from disk, removing from queue.");
          this.removeFromQueue(item.id);
        } else {
          // Wait a bit before retrying or moving to next?
          // For now, we'll break the loop and try again later/on online event
          // to avoid spamming errors
          this.isProcessing = false;
          return;
        }
      }

      // Continue to next item
      if (this.queue.length > 0) {
        // Small delay between uploads
        setTimeout(() => {
          this.isProcessing = false;
          this.processQueue();
        }, 500);
        return; // Return so we don't clear isProcessing immediately below
      }

    } catch (globalError) {
      console.error("Queue processing error:", globalError);
    }

    this.isProcessing = false;
  }
}

// Global variables
let uploadManager = new UploadManager();
let authManager = new AuthManager(); // Init Auth
let screenRecorder = new ScreenRecorder();
let audioRecorder = new AudioRecorder();
let currentRecorder = null;
let microphoneStream = null;
let systemAudioStream = null;

// DOM elements
const recordingMode = document.getElementById("recordingMode");
const micStatus = document.getElementById("micStatus");
const micSelect = document.getElementById("micSelect");
const screenSelect = document.getElementById("screenSelect");
const speakerStatus = document.getElementById("speakerStatus");
const recordStatus = document.getElementById("recordStatus");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const recordBtn = document.getElementById("recordBtn");
const pauseBtn = document.getElementById("pauseBtn");

// Populate microphone select dropdown
function updateMicSelect() {
  navigator.mediaDevices.enumerateDevices().then((devices) => {
    micSelect.innerHTML = "";
    devices.forEach((device) => {
      if (device.kind === "audioinput") {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent =
          device.label || `Microphone ${micSelect.length + 1}`;
        micSelect.appendChild(option);
      }
    });
  });
}

// Update status display
function updateStatus(element, isConnected, label) {
  if (isConnected) {
    element.textContent = `${label}: Connected`;
    element.className = "status connected";
  } else {
    element.textContent = `${label}: Disconnected`;
    element.className = "status disconnected";
  }
}

// Update record status display
function updateRecordStatus(isRecording, isPaused = false) {
  if (isRecording) {
    if (isPaused) {
      recordStatus.textContent = "Recording: Paused";
      recordStatus.className = "status connected"; // Keep green or maybe yellow? keeping connected style for now
      pauseBtn.textContent = "Resume";
    } else {
      recordStatus.textContent = "Recording: Active";
      recordStatus.className = "status connected";
      pauseBtn.textContent = "Pause";
    }
    recordBtn.textContent = "Stop Recording";
    pauseBtn.disabled = false;
  } else {
    recordStatus.textContent = "Recording: Stopped";
    recordStatus.className = "status disconnected";
    recordBtn.textContent = "Start Recording";
    pauseBtn.textContent = "Pause";
    pauseBtn.disabled = true;
  }
}

// Start audio streams
async function start() {
  try {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    micSelect.disabled = true;
    recordingMode.disabled = true;
    screenSelect.disabled = true;

    const mode = recordingMode.value;

    // Get microphone stream
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: micSelect.value },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000,
      },
      video: false,
    });

    updateStatus(micStatus, true, "Microphone");

    // Enable loopback audio
    await window.electronAPI.enableLoopbackAudio();

    if (mode === "screen") {
      // Audio + Screen mode: Get display media with video
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
        },
        video: true,
      });

      // Disable loopback audio after getting stream
      await window.electronAPI.disableLoopbackAudio();

      systemAudioStream = displayStream;
      updateStatus(speakerStatus, true, "Screen & System Audio");
      currentRecorder = screenRecorder;
    } else {
      // Audio Only mode: Get display media for system audio only
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000,
        },
        video: true,
      });

      // Disable loopback audio after getting stream
      await window.electronAPI.disableLoopbackAudio();

      // Remove video tracks for audio-only mode
      const videoTracks = displayStream
        .getTracks()
        .filter((t) => t.kind === "video");
      videoTracks.forEach((t) => {
        t.stop();
        displayStream.removeTrack(t);
      });

      systemAudioStream = displayStream;
      updateStatus(speakerStatus, true, "System Audio");
      currentRecorder = audioRecorder;
    }

    // Enable record button
    recordBtn.disabled = false;

    console.log(
      `${mode === "screen" ? "Screen" : "Audio"} streams started successfully`
    );
  } catch (error) {
    console.error("Error starting streams:", error);
    alert("Error starting streams: " + error.message);
    stop();
  }
}

// Stop audio streams
function stop() {
  startBtn.disabled = false;
  stopBtn.disabled = true;
  recordBtn.disabled = true;
  micSelect.disabled = false;
  recordingMode.disabled = false;
  screenSelect.disabled = false;

  // Stop recording if active
  if (currentRecorder && currentRecorder.isRecording) {
    currentRecorder.stopRecording();
    updateRecordStatus(false);
  }

  // Cleanup recorders
  if (currentRecorder) {
    currentRecorder.cleanup();
  }

  // Reset pause button
  pauseBtn.textContent = "Pause";
  pauseBtn.disabled = true;

  // Stop and clean up streams
  if (microphoneStream) {
    microphoneStream.getTracks().forEach((t) => t.stop());
    microphoneStream = null;
  }

  if (systemAudioStream) {
    systemAudioStream.getTracks().forEach((t) => t.stop());
    systemAudioStream = null;
  }

  updateStatus(micStatus, false, "Microphone");
  updateStatus(speakerStatus, false, "Screen/Audio");
  updateRecordStatus(false);
  currentRecorder = null;
}

// Toggle recording
async function toggleRecording() {
  if (!currentRecorder || !currentRecorder.isRecording) {
    if (!microphoneStream || !systemAudioStream) {
      alert("Please start streams first!");
      return;
    }

    if (!currentRecorder) {
      alert("Please start streams first!");
      return;
    }

    try {
      const mode = recordingMode.value;
      if (mode === "screen") {
        // Screen recording mode
        await screenRecorder.startRecording(
          microphoneStream,
          systemAudioStream,
          systemAudioStream
        );
      } else {
        // Audio only mode
        await audioRecorder.startRecording(microphoneStream, systemAudioStream);
      }
      updateRecordStatus(true, false);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Error starting recording: " + error.message);
    }
  } else {
    currentRecorder.stopRecording();
    updateRecordStatus(false);
  }
}

// Toggle pause
function togglePause() {
  if (!currentRecorder || !currentRecorder.isRecording) return;

  if (currentRecorder.mediaRecorder.state === "recording") {
    currentRecorder.pauseRecording();
    updateRecordStatus(true, true);
  } else if (currentRecorder.mediaRecorder.state === "paused") {
    currentRecorder.resumeRecording();
    updateRecordStatus(true, false);
  }
}

// Event listeners
startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", stop);
recordBtn.addEventListener("click", toggleRecording);
pauseBtn.addEventListener("click", togglePause);
document.getElementById("pauseOnWeakBtn").addEventListener("click", () => {
  togglePause();
  document.getElementById("networkWarning").style.display = 'none';
});

// Listen for save recording responses
// Listen for save recording responses - DISABLED (Using memory storage)
// window.electronAPI.onSaveRecordingResponse((response) => {
//   if (response.success) {
//     console.log(`Chunk saved: ${response.filename}`);

//     // Add to upload queue for background uploading
//     if (response.filePath) {
//       uploadManager.addToQueue(response);
//     }

//   } else {
//     console.error(`Failed to save chunk: ${response.error}`);
//   }
// });

// Initialize
updateMicSelect();

// Cleanup on page unload
window.addEventListener("beforeunload", stop);

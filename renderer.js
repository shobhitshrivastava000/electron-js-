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

      // Convert blob to array buffer for saving
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Send to main process to save
      window.electronAPI.saveRecording(uint8Array, filename);

      const durationSeconds = (
        (Date.now() - this.recordingStartTime) /
        1000
      ).toFixed(1);
      console.log(
        `Chunk ${this.chunkNumber} saved: ${filename} (${durationSeconds}s)`
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

      // Convert blob to array buffer for saving
      const wavArrayBuffer = await wavBlob.arrayBuffer();
      const uint8Array = new Uint8Array(wavArrayBuffer);

      // Send to main process to save
      window.electronAPI.saveRecording(uint8Array, filename);

      const durationSeconds = (
        (Date.now() - this.recordingStartTime) /
        1000
      ).toFixed(1);
      console.log(
        `Chunk ${this.chunkNumber} saved: ${filename} (${durationSeconds}s)`
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

// Global variables
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
function updateRecordStatus(isRecording) {
  if (isRecording) {
    recordStatus.textContent = "Recording: Active";
    recordStatus.className = "status connected";
    recordBtn.textContent = "Stop Recording";
  } else {
    recordStatus.textContent = "Recording: Stopped";
    recordStatus.className = "status disconnected";
    recordBtn.textContent = "Start Recording";
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
      updateRecordStatus(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Error starting recording: " + error.message);
    }
  } else {
    currentRecorder.stopRecording();
    updateRecordStatus(false);
  }
}

// Event listeners
startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", stop);
recordBtn.addEventListener("click", toggleRecording);

// Listen for save recording responses
window.electronAPI.onSaveRecordingResponse((response) => {
  if (response.success) {
    console.log(`Chunk saved: ${response.filename}`);
  } else {
    console.error(`Failed to save chunk: ${response.error}`);
  }
});

// Initialize
updateMicSelect();

// Cleanup on page unload
window.addEventListener("beforeunload", stop);

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  enableLoopbackAudio: () => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopbackAudio: () => ipcRenderer.invoke('disable-loopback-audio'),
  saveRecording: (audioData, filename) => {
    ipcRenderer.send('save-recording', audioData, filename);
  },
  onSaveRecordingResponse: (callback) => {
    ipcRenderer.on('save-recording-response', (event, response) => callback(response));
  }
});


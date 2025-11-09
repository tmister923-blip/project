class VideoChat {
  constructor() {
    this.socket = io({
      transports: ["websocket", "polling"],
      upgrade: true,
      rememberUpgrade: true,
    });
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.currentRoom = null;
    this.username = "";
    this.isVideoEnabled = true;
    this.isAudioEnabled = true;
    this.isSearching = false;

    // WebRTC configuration with multiple STUN servers for better connectivity
    this.rtcConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
        { urls: "stun:stun.nextcloud.com:443" },
      ],
      iceCandidatePoolSize: 10,
    };

    this.initializeElements();
    this.setupEventListeners();
    this.setupSocketListeners();
  }

  initializeElements() {
    // Screens
    this.usernameScreen = document.getElementById("username-screen");
    this.chatScreen = document.getElementById("chat-screen");

    // Username form
    this.usernameInput = document.getElementById("username-input");
    this.startBtn = document.getElementById("start-btn");

    // Video elements
    this.userVideo = document.getElementById("user-video");
    this.partnerVideo = document.getElementById("partner-video");
    this.userUsernameDisplay = document.getElementById("user-username");
    this.partnerUsernameDisplay = document.getElementById("partner-username");
    this.connectionStatus = document.getElementById("connection-status");

    // Controls
    this.toggleVideoBtn = document.getElementById("toggle-video");
    this.toggleAudioBtn = document.getElementById("toggle-audio");
    this.skipBtn = document.getElementById("skip-btn");
    this.stopBtn = document.getElementById("stop-btn");

    // Chat
    this.chatPanel = document.getElementById("chat-panel");
    this.chatMessages = document.getElementById("chat-messages");
    this.chatInput = document.getElementById("chat-input");
    this.sendBtn = document.getElementById("send-btn");
    this.toggleChatBtn = document.getElementById("toggle-chat");
  }

  setupEventListeners() {
    // Username form
    this.usernameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.startChat();
      }
    });

    // Control buttons
    this.toggleVideoBtn.addEventListener("click", () => this.toggleVideo());
    this.toggleAudioBtn.addEventListener("click", () => this.toggleAudio());
    this.skipBtn.addEventListener("click", () => this.skipPartner());
    this.stopBtn.addEventListener("click", () => this.stopChat());

    // Chat functionality
    this.toggleChatBtn.addEventListener("click", () => this.toggleChat());
    this.chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage();
      }
    });
    this.sendBtn.addEventListener("click", () => this.sendMessage());
  }

  setupSocketListeners() {
    // Connection events
    this.socket.on("connect", () => {
      console.log("Connected to server");
      this.showNotification("Connected to server");
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Disconnected from server:", reason);
      if (reason === "io server disconnect") {
        // Server forcefully disconnected
        this.showNotification("Server disconnected. Reconnecting...");
        this.socket.connect();
      } else {
        this.showNotification("Connection lost. Reconnecting...");
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      this.showNotification("Unable to connect to server. Please try again.");
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log("Reconnected after", attemptNumber, "attempts");
      this.showNotification("Reconnected to server");
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      console.log("Attempting to reconnect...", attemptNumber);
      this.showNotification(`Reconnecting... (attempt ${attemptNumber})`);
    });

    // Matching events
    this.socket.on("searching", () => {
      this.isSearching = true;
      this.showConnectionStatus("Searching for someone...", true);
    });

    this.socket.on("matched", (data) => {
      console.log("Matched with:", data.partnerUsername);
      this.currentRoom = data.roomId;
      this.isSearching = false;
      this.partnerUsernameDisplay.textContent = data.partnerUsername;
      this.showConnectionStatus("Connecting...", true);

      if (data.isInitiator) {
        this.createOffer();
      }
    });

    // WebRTC signaling
    this.socket.on("offer", async (data) => {
      await this.handleOffer(data.offer);
    });

    this.socket.on("answer", async (data) => {
      await this.handleAnswer(data.answer);
    });

    this.socket.on("ice-candidate", async (data) => {
      await this.handleIceCandidate(data.candidate);
    });

    // Partner events
    this.socket.on("partner-skipped", () => {
      this.showNotification("Partner skipped to next person");
      this.resetConnection();
      this.findNewPartner();
    });

    this.socket.on("partner-disconnected", () => {
      this.showNotification("Partner disconnected");
      this.resetConnection();
      this.findNewPartner();
    });

    // Chat messages
    this.socket.on("chat-message", (data) => {
      this.displayMessage(data.message, data.username, false);
    });
  }

  async startChat() {
    const username = this.usernameInput.value.trim();

    if (!username) {
      this.showNotification("Please enter a username");
      return;
    }

    if (username.length < 2) {
      this.showNotification("Username must be at least 2 characters");
      return;
    }

    this.username = username;
    this.startBtn.disabled = true;
    this.startBtn.textContent = "Starting...";

    try {
      // Get user media
      await this.getUserMedia();

      // Join the server
      this.socket.emit("join", this.username);

      // Switch to chat screen
      this.usernameScreen.classList.remove("active");
      this.chatScreen.classList.add("active");
      this.userUsernameDisplay.textContent = this.username;

      // Start looking for a partner
      this.findNewPartner();
    } catch (error) {
      console.error("Error starting chat:", error);
      this.showNotification(
        "Could not access camera/microphone. Please check permissions.",
      );
      this.startBtn.disabled = false;
      this.startBtn.textContent = "Start Chatting";
    }
  }

  async getUserMedia() {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.userVideo.srcObject = this.localStream;
    } catch (error) {
      console.error("Error accessing media:", error);
      throw new Error(
        "Could not access camera/microphone. Please check permissions.",
      );
    }
  }

  findNewPartner() {
    this.resetConnection();
    this.socket.emit("find-match");
  }

  async createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);

    // Add local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log("Received remote stream");
      this.remoteStream = event.streams[0];
      this.partnerVideo.srcObject = this.remoteStream;
      this.hideConnectionStatus();
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.currentRoom) {
        this.socket.emit("ice-candidate", {
          roomId: this.currentRoom,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log("Connection state:", state);

      switch (state) {
        case "connected":
          this.showNotification("Connected!");
          break;
        case "disconnected":
          this.showNotification("Connection lost");
          setTimeout(() => this.findNewPartner(), 2000);
          break;
        case "failed":
          this.showNotification("Connection failed");
          this.resetConnection();
          setTimeout(() => this.findNewPartner(), 2000);
          break;
        case "connecting":
          this.showConnectionStatus("Establishing connection...", true);
          break;
      }
    };
  }

  async createOffer() {
    await this.createPeerConnection();

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.socket.emit("offer", {
        roomId: this.currentRoom,
        offer: offer,
      });
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  }

  async handleOffer(offer) {
    await this.createPeerConnection();

    try {
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.socket.emit("answer", {
        roomId: this.currentRoom,
        answer: answer,
      });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }

  async handleAnswer(answer) {
    try {
      await this.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  }

  async handleIceCandidate(candidate) {
    try {
      if (this.peerConnection) {
        await this.peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error);
    }
  }

  toggleVideo() {
    this.isVideoEnabled = !this.isVideoEnabled;

    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = this.isVideoEnabled;
      }
    }

    this.toggleVideoBtn.classList.toggle("video-on", this.isVideoEnabled);
    this.toggleVideoBtn.classList.toggle("video-off", !this.isVideoEnabled);
  }

  toggleAudio() {
    this.isAudioEnabled = !this.isAudioEnabled;

    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = this.isAudioEnabled;
      }
    }

    this.toggleAudioBtn.classList.toggle("audio-on", this.isAudioEnabled);
    this.toggleAudioBtn.classList.toggle("audio-off", !this.isAudioEnabled);
  }

  skipPartner() {
    if (this.currentRoom) {
      this.socket.emit("skip", this.currentRoom);
    } else {
      this.findNewPartner();
    }
  }

  stopChat() {
    this.resetConnection();
    this.chatScreen.classList.remove("active");
    this.usernameScreen.classList.add("active");
    this.startBtn.disabled = false;
    this.startBtn.textContent = "Start Chatting";
    this.clearChat();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  resetConnection() {
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clear remote video
    this.partnerVideo.srcObject = null;
    this.remoteStream = null;

    // Reset UI
    this.partnerUsernameDisplay.textContent = "Connecting...";
    this.currentRoom = null;
  }

  toggleChat() {
    this.chatPanel.classList.toggle("open");
  }

  sendMessage() {
    const message = this.chatInput.value.trim();

    if (!message || !this.currentRoom) return;

    // Display message locally
    this.displayMessage(message, "You", true);

    // Send to partner
    this.socket.emit("chat-message", {
      roomId: this.currentRoom,
      message: message,
    });

    this.chatInput.value = "";
  }

  displayMessage(message, username, isOwn) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.classList.add(isOwn ? "own" : "partner");

    const messageInfo = document.createElement("div");
    messageInfo.classList.add("message-info");
    messageInfo.textContent = username;

    const messageText = document.createElement("div");
    messageText.textContent = message;

    messageElement.appendChild(messageInfo);
    messageElement.appendChild(messageText);
    this.chatMessages.appendChild(messageElement);

    // Scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  clearChat() {
    this.chatMessages.innerHTML = "";
    this.chatPanel.classList.remove("open");
  }

  showConnectionStatus(message, showSpinner = false) {
    this.connectionStatus.style.display = "flex";
    this.connectionStatus.querySelector("span").textContent = message;
    this.connectionStatus.querySelector(".spinner").style.display = showSpinner
      ? "block"
      : "none";
  }

  hideConnectionStatus() {
    this.connectionStatus.style.display = "none";
  }

  showNotification(message) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll(".notification");
    existingNotifications.forEach((notification) => notification.remove());

    // Create new notification
    const notification = document.createElement("div");
    notification.classList.add("notification");
    notification.textContent = message;
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Global function for starting chat (called from HTML)
function startChat() {
  if (window.videoChat) {
    window.videoChat.startChat();
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.videoChat = new VideoChat();
});

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Page is hidden
    console.log("Page hidden");
  } else {
    // Page is visible
    console.log("Page visible");
  }
});

// Handle beforeunload to clean up connections
window.addEventListener("beforeunload", () => {
  if (window.videoChat && window.videoChat.localStream) {
    window.videoChat.localStream.getTracks().forEach((track) => track.stop());
  }
});

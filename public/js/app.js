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
    this.currentFacingMode = "user"; // "user" or "environment"
    this.userCountryInfo = null;
    this.isConnected = false;
    this.currentMicrophoneId = null;
    this.availableMicrophones = [];
    this.cameraFilters = {
      brightness: 1,
      contrast: 1,
      saturation: 1,
      blur: 0,
      sepia: 0,
      hue: 0
    };

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

    // User count and location
    this.userCountDisplay = document.getElementById("user-count");
    this.userLocationDiv = document.getElementById("user-location");
    this.userFlagDisplay = document.getElementById("user-flag");
    this.userCountryDisplay = document.getElementById("user-country");

    // Video elements
    this.userVideo = document.getElementById("user-video");
    this.partnerVideo = document.getElementById("partner-video");
    this.userUsernameDisplay = document.getElementById("user-username");
    this.partnerUsernameDisplay = document.getElementById("partner-username");
    this.connectionStatus = document.getElementById("connection-status");
    this.partnerCountryInfo = document.getElementById("partner-country-info");
    this.userCountryInfo = document.getElementById("user-country-info");

    // Controls
    this.toggleVideoBtn = document.getElementById("toggle-video");
    this.toggleAudioBtn = document.getElementById("toggle-audio");
    this.rotateCameraBtn = document.getElementById("rotate-camera");
    this.flipCameraBtn = document.getElementById("flip-camera");
    this.skipBtn = document.getElementById("skip-btn");
    this.stopBtn = document.getElementById("stop-btn");

    // Chat
    this.chatPanel = document.getElementById("chat-panel");
    this.chatMessages = document.getElementById("chat-messages");
    this.chatInput = document.getElementById("chat-input");
    this.sendBtn = document.getElementById("send-btn");
    this.toggleChatBtn = document.getElementById("toggle-chat");

    // Microphone selection
    this.micSelectBtn = document.getElementById("mic-select-btn");
    this.micPanel = document.getElementById("mic-panel");
    this.closeMicPanel = document.getElementById("close-mic-panel");
    this.micList = this.micPanel?.querySelector(".mic-list");

    // Camera filters
    this.filtersBtn = document.getElementById("filters-btn");
    this.filtersPanel = document.getElementById("filters-panel");
    this.closeFiltersPanel = document.getElementById("close-filters-panel");
    this.brightnessSlider = document.getElementById("brightness-slider");
    this.contrastSlider = document.getElementById("contrast-slider");
    this.saturationSlider = document.getElementById("saturation-slider");
    this.blurSlider = document.getElementById("blur-slider");
    this.sepiaSlider = document.getElementById("sepia-slider");
    this.hueSlider = document.getElementById("hue-slider");
    this.resetFiltersBtn = document.getElementById("reset-filters");
    this.applyFiltersBtn = document.getElementById("apply-filters");

    // Emoji picker
    this.emojiBtn = document.getElementById("emoji-btn");
    this.emojiPicker = document.getElementById("emoji-picker");
    this.emojiItems = document.querySelectorAll(".emoji-item");
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
    this.rotateCameraBtn.addEventListener("click", () => this.rotateCamera());
    this.flipCameraBtn.addEventListener("click", () => this.flipCamera());
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

    // Microphone selection
    this.micSelectBtn?.addEventListener("click", () => this.openMicPanel());
    this.closeMicPanel?.addEventListener("click", () => this.closeMicrophonePanel());

    // Camera filters
    this.filtersBtn?.addEventListener("click", () => this.openFiltersPanel());
    this.closeFiltersPanel?.addEventListener("click", () => this.closeFilterPanel());
    this.resetFiltersBtn?.addEventListener("click", () => this.resetFilters());
    this.applyFiltersBtn?.addEventListener("click", () => this.closeFilterPanel());

    // Filter sliders
    this.brightnessSlider?.addEventListener("input", (e) => this.updateFilter("brightness", e.target.value));
    this.contrastSlider?.addEventListener("input", (e) => this.updateFilter("contrast", e.target.value));
    this.saturationSlider?.addEventListener("input", (e) => this.updateFilter("saturation", e.target.value));
    this.blurSlider?.addEventListener("input", (e) => this.updateFilter("blur", e.target.value));
    this.sepiaSlider?.addEventListener("input", (e) => this.updateFilter("sepia", e.target.value));
    this.hueSlider?.addEventListener("input", (e) => this.updateFilter("hue", e.target.value));

    // Emoji picker
    this.emojiBtn?.addEventListener("click", () => this.toggleEmojiPicker());
    this.emojiItems.forEach(item => {
      item.addEventListener("click", () => this.insertEmoji(item.textContent));
    });

    // Close emoji picker when clicking outside
    document.addEventListener("click", (e) => {
      if (this.emojiPicker && !this.emojiPicker.contains(e.target) && e.target !== this.emojiBtn) {
        this.emojiPicker.classList.add("hidden");
      }
    });
  }

  setupSocketListeners() {
    // Connection events
    this.socket.on("connect", () => {
      console.log("Connected to server");
      this.showSuccessNotification("Connected to server ✅");
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Disconnected from server:", reason);
      if (reason === "io server disconnect") {
        // Server forcefully disconnected
        this.showErrorNotification("Server disconnected. Reconnecting...");
        this.socket.connect();
      } else {
        this.showErrorNotification("Connection lost. Reconnecting...");
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      this.showErrorNotification(
        "Unable to connect to server. Please try again.",
      );
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log("Reconnected after", attemptNumber, "attempts");
      this.showSuccessNotification("Reconnected to server! 🔄");
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      console.log("Attempting to reconnect...", attemptNumber);
      this.showNotification(`Reconnecting... (attempt ${attemptNumber})`);
    });

    // User count updates
    this.socket.on("user-count-update", (count) => {
      this.userCountDisplay.textContent = count;
    });

    // Country information
    this.socket.on("country-info", (countryInfo) => {
      // Store country data
      this.userCountryData = countryInfo;
      
      // Update username screen displays
      this.userFlagDisplay.textContent = countryInfo.flag;
      this.userCountryDisplay.textContent = countryInfo.country;
      this.userLocationDiv.style.display = "flex";

      // Update user's own country display in video chat
      const userCountryElement = document.getElementById("user-country-info");
      if (userCountryElement) {
        userCountryElement.style.display = "flex";
        userCountryElement.textContent = `${countryInfo.flag} ${countryInfo.country}`;
      }
    });

    // Matching events
    this.socket.on("searching", () => {
      this.isSearching = true;
      this.isConnected = false;
      this.showConnectionStatus("Searching for someone...", true);
    });

    this.socket.on("matched", (data) => {
      console.log("Matched with:", data.partnerUsername);
      this.currentRoom = data.roomId;
      this.isSearching = false;
      this.partnerUsernameDisplay.textContent = data.partnerUsername;

      // Show partner's country
      if (data.partnerCountry && data.partnerFlag) {
        this.partnerCountryInfo.style.display = "flex";
        this.partnerCountryInfo.textContent = `${data.partnerFlag} ${data.partnerCountry}`;
      }

      this.showConnectionStatus("Establishing connection...", true);

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
      this.showNotification("Partner skipped to next person 👋");
      this.resetConnection();
      // Wait a moment before finding new partner to avoid conflicts
      setTimeout(() => this.findNewPartner(), 1000);
    });

    this.socket.on("partner-disconnected", () => {
      this.showErrorNotification("Partner disconnected 📱");
      this.resetConnection();
      // Immediate search for new partner
      setTimeout(() => this.findNewPartner(), 500);
    });

    // Chat messages
    this.socket.on("chat-message", (data) => {
      this.displayMessage(data.message, data.username, false);
    });
  }

  async startChat() {
    const username = this.usernameInput.value.trim();

    if (!username) {
      this.showErrorNotification("Please enter a username");
      return;
    }

    if (username.length < 2) {
      this.showErrorNotification("Username must be at least 2 characters");
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
      this.showErrorNotification(
        "Could not access camera/microphone. Please check permissions 📷",
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
          frameRate: { ideal: 30 },
          facingMode: this.currentFacingMode,
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
      this.isConnected = true;
      this.hideConnectionStatus();
      this.showCelebrationNotification("Connected! 🎉✨");
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
          this.isConnected = true;
          this.hideConnectionStatus();
          console.log("WebRTC connection established successfully");
          break;
        case "disconnected":
          if (this.isConnected) {
            this.isConnected = false;
            this.showErrorNotification("Connection lost 📡");
            this.resetConnection();
            setTimeout(() => this.findNewPartner(), 1500);
          }
          break;
        case "failed":
          this.isConnected = false;
          this.showErrorNotification("Connection failed - searching again 🔄");
          this.resetConnection();
          setTimeout(() => this.findNewPartner(), 1000);
          break;
        case "connecting":
          this.showConnectionStatus("Establishing connection...", true);
          break;
        case "checking":
          this.showConnectionStatus("Checking connection...", true);
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

  async rotateCamera() {
    if (!this.localStream) return;

    try {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (!videoTrack) return;

      // Stop current video track
      videoTrack.stop();

      // Switch facing mode
      this.currentFacingMode =
        this.currentFacingMode === "user" ? "environment" : "user";

      // Get new stream with different facing mode
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Update local video
      this.userVideo.srcObject = newStream;

      // Replace track in peer connection if connected
      // This sends the new camera view to your partner automatically
      if (this.peerConnection && this.isConnected) {
        const sender = this.peerConnection
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");

        if (sender) {
          await sender.replaceTrack(newStream.getVideoTracks()[0]);
          console.log("Camera rotated and sent to partner");
        }
      }

      // Update local stream reference
      const audioTrack = this.localStream.getAudioTracks()[0];
      this.localStream = newStream;

      // Add back audio track
      if (audioTrack) {
        this.localStream.addTrack(audioTrack);
      }

      this.showSuccessNotification(
        `Switched to ${this.currentFacingMode === "user" ? "front" : "back"} camera 📷`,
      );
    } catch (error) {
      console.error("Error rotating camera:", error);
      this.showErrorNotification("Could not rotate camera 📷");
    }
  }

  flipCamera() {
    const video = this.userVideo;
    const currentTransform = video.style.transform;

    if (currentTransform.includes("scaleX(-1)")) {
      video.style.transform = currentTransform.replace(
        "scaleX(-1)",
        "scaleX(1)",
      );
    } else {
      video.style.transform += " scaleX(-1)";
    }

    this.showSuccessNotification("Camera flipped 🔄");
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
    this.partnerCountryInfo.style.display = "none";
    this.partnerCountryInfo.textContent = "";
    this.isConnected = false;
    this.currentRoom = null;
    this.isSearching = false;

    // Clear any existing connection status
    this.showConnectionStatus("Searching for someone...", true);
  }

  toggleChat() {
    this.chatPanel.classList.toggle("open");
  }

  sendMessage() {
    const message = this.chatInput.value.trim();

    if (!message || !this.currentRoom || !this.isConnected) {
      if (!this.isConnected) {
        this.showErrorNotification("Not connected to anyone yet 💬");
      }
      return;
    }

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
    // Only show if not connected or if it's a specific status update
    if (this.isConnected && !message.includes("Checking")) return;

    this.connectionStatus.style.display = "flex";
    this.connectionStatus.querySelector("span").textContent = message;
    this.connectionStatus.querySelector(".spinner").style.display = showSpinner
      ? "block"
      : "none";
  }

  hideConnectionStatus() {
    this.connectionStatus.style.display = "none";
  }

  showNotification(message, type = "default") {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll(".notification");
    existingNotifications.forEach((notification) => notification.remove());

    // Create new notification
    const notification = document.createElement("div");
    notification.classList.add("notification");

    // Add notification type classes
    if (type === "success") {
      notification.classList.add("success");
    } else if (type === "error") {
      notification.classList.add("error");
    } else if (type === "celebration") {
      notification.classList.add("celebration");
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    // Remove after 4 seconds (extended for better visibility)
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 4000);
  }

  showCelebrationNotification(message) {
    this.showNotification(message, "celebration");

    // Add extra celebration effects
    setTimeout(() => {
      // Add temporary glow to the DarDish brand if visible
      const brandLetters = document.querySelectorAll(".letter");
      if (brandLetters.length > 0) {
        brandLetters.forEach((letter, index) => {
          setTimeout(() => {
            letter.style.animation = "letterFloat 0.5s ease-in-out 2";
            letter.style.transform = "scale(1.3) rotate(15deg)";
          }, index * 100);
        });

        setTimeout(() => {
          brandLetters.forEach((letter) => {
            letter.style.animation = "";
            letter.style.transform = "";
          });
        }, 2000);
      }

      // Animate mini brand
      const miniBrand = document.querySelector(".mini-brand");
      if (miniBrand) {
        miniBrand.style.animation = "miniPulse 0.3s ease-in-out 5";
        setTimeout(() => {
          miniBrand.style.animation = "";
        }, 1500);
      }
    }, 100);
  }

  showErrorNotification(message) {
    this.showNotification(message, "error");
  }

  showSuccessNotification(message) {
    this.showNotification(message, "success");
  }

  // ========== MICROPHONE SELECTION ==========
  async openMicPanel() {
    if (!this.micPanel) return;

    // Enumerate audio devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableMicrophones = devices.filter(device => device.kind === 'audioinput');

      // Populate microphone list
      this.micList.innerHTML = '';
      
      if (this.availableMicrophones.length === 0) {
        this.micList.innerHTML = '<div class="no-devices">No microphones found</div>';
      } else {
        this.availableMicrophones.forEach((mic, index) => {
          const micItem = document.createElement('div');
          micItem.className = 'mic-item';
          if (mic.deviceId === this.currentMicrophoneId) {
            micItem.classList.add('active');
          }
          
          micItem.innerHTML = `
            <span class="mic-name">${mic.label || `Microphone ${index + 1}`}</span>
            <span class="mic-status">${mic.deviceId === this.currentMicrophoneId ? '✓' : ''}</span>
          `;
          
          micItem.addEventListener('click', () => this.selectMicrophone(mic.deviceId));
          this.micList.appendChild(micItem);
        });
      }

      this.micPanel.classList.remove('hidden');
    } catch (error) {
      console.error('Error enumerating devices:', error);
      this.showErrorNotification('Could not load microphones');
    }
  }

  closeMicrophonePanel() {
    if (this.micPanel) {
      this.micPanel.classList.add('hidden');
    }
  }

  async selectMicrophone(deviceId) {
    if (!this.localStream) return;

    try {
      // Get new audio stream with selected microphone
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      const newAudioTrack = newStream.getAudioTracks()[0];

      // Replace audio track in local stream
      const oldAudioTrack = this.localStream.getAudioTracks()[0];
      if (oldAudioTrack) {
        this.localStream.removeTrack(oldAudioTrack);
        oldAudioTrack.stop();
      }
      this.localStream.addTrack(newAudioTrack);

      // Replace track in peer connection if connected
      if (this.peerConnection && this.isConnected) {
        const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(newAudioTrack);
        }
      }

      this.currentMicrophoneId = deviceId;
      this.showSuccessNotification('Microphone changed 🎤');
      this.closeMicrophonePanel();

      // Refresh the panel to show active mic
      setTimeout(() => this.openMicPanel(), 100);
    } catch (error) {
      console.error('Error selecting microphone:', error);
      this.showErrorNotification('Could not change microphone');
    }
  }

  // ========== CAMERA FILTERS ==========
  openFiltersPanel() {
    if (this.filtersPanel) {
      this.filtersPanel.classList.remove('hidden');
    }
  }

  closeFilterPanel() {
    if (this.filtersPanel) {
      this.filtersPanel.classList.add('hidden');
    }
  }

  updateFilter(filterType, value) {
    this.cameraFilters[filterType] = parseFloat(value);
    this.applyFilters();
    this.updateFilterDisplay(filterType, value);
  }

  applyFilters() {
    if (!this.userVideo) return;

    const { brightness, contrast, saturation, blur, sepia, hue } = this.cameraFilters;
    
    this.userVideo.style.filter = `
      brightness(${brightness})
      contrast(${contrast})
      saturate(${saturation})
      blur(${blur}px)
      sepia(${sepia})
      hue-rotate(${hue}deg)
    `.trim();
  }

  updateFilterDisplay(filterType, value) {
    const displayMap = {
      brightness: { element: 'brightness-value', format: v => `${Math.round(v * 100)}%` },
      contrast: { element: 'contrast-value', format: v => `${Math.round(v * 100)}%` },
      saturation: { element: 'saturation-value', format: v => `${Math.round(v * 100)}%` },
      blur: { element: 'blur-value', format: v => `${v}px` },
      sepia: { element: 'sepia-value', format: v => `${Math.round(v * 100)}%` },
      hue: { element: 'hue-value', format: v => `${v}°` }
    };

    const display = displayMap[filterType];
    if (display) {
      const element = document.getElementById(display.element);
      if (element) {
        element.textContent = display.format(parseFloat(value));
      }
    }
  }

  resetFilters() {
    this.cameraFilters = {
      brightness: 1,
      contrast: 1,
      saturation: 1,
      blur: 0,
      sepia: 0,
      hue: 0
    };

    // Reset sliders
    if (this.brightnessSlider) this.brightnessSlider.value = 1;
    if (this.contrastSlider) this.contrastSlider.value = 1;
    if (this.saturationSlider) this.saturationSlider.value = 1;
    if (this.blurSlider) this.blurSlider.value = 0;
    if (this.sepiaSlider) this.sepiaSlider.value = 0;
    if (this.hueSlider) this.hueSlider.value = 0;

    // Update displays
    this.updateFilterDisplay('brightness', 1);
    this.updateFilterDisplay('contrast', 1);
    this.updateFilterDisplay('saturation', 1);
    this.updateFilterDisplay('blur', 0);
    this.updateFilterDisplay('sepia', 0);
    this.updateFilterDisplay('hue', 0);

    this.applyFilters();
    this.showSuccessNotification('Filters reset ✨');
  }

  // ========== EMOJI PICKER ==========
  toggleEmojiPicker() {
    if (this.emojiPicker) {
      this.emojiPicker.classList.toggle('hidden');
    }
  }

  insertEmoji(emoji) {
    if (this.chatInput) {
      const cursorPos = this.chatInput.selectionStart;
      const textBefore = this.chatInput.value.substring(0, cursorPos);
      const textAfter = this.chatInput.value.substring(cursorPos);
      
      this.chatInput.value = textBefore + emoji + textAfter;
      this.chatInput.focus();
      
      // Set cursor position after emoji
      const newCursorPos = cursorPos + emoji.length;
      this.chatInput.setSelectionRange(newCursorPos, newCursorPos);
    }
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

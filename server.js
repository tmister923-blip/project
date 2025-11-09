const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fetch = require("node-fetch");

// Function to get country from IP (using a free API)
const getCountryFromIP = async (ip) => {
  try {
    // Remove IPv6 prefix if present
    const cleanIP = ip.replace(/^::ffff:/, "");

    // Skip localhost IPs
    if (
      cleanIP === "127.0.0.1" ||
      cleanIP === "::1" ||
      cleanIP.startsWith("192.168.") ||
      cleanIP.startsWith("10.") ||
      cleanIP.startsWith("172.")
    ) {
      return { country: "Local", flag: "🏠" };
    }

    const response = await fetch(
      `http://ip-api.com/json/${cleanIP}?fields=country,countryCode`,
    );
    const data = await response.json();

    if (data.country) {
      // Simple flag mapping for common countries
      const flagMap = {
        US: "🇺🇸",
        CA: "🇨🇦",
        GB: "🇬🇧",
        DE: "🇩🇪",
        FR: "🇫🇷",
        IT: "🇮🇹",
        ES: "🇪🇸",
        NL: "🇳🇱",
        BE: "🇧🇪",
        CH: "🇨🇭",
        AU: "🇦🇺",
        NZ: "🇳🇿",
        JP: "🇯🇵",
        CN: "🇨🇳",
        KR: "🇰🇷",
        IN: "🇮🇳",
        BR: "🇧🇷",
        AR: "🇦🇷",
        MX: "🇲🇽",
        RU: "🇷🇺",
      };

      return {
        country: data.country,
        flag: flagMap[data.countryCode] || "🌍",
      };
    }
  } catch (error) {
    console.log("Error getting country:", error.message);
  }

  return { country: "Unknown", flag: "🌍" };
};

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

const io = socketIo(server, {
  cors: {
    origin:
      NODE_ENV === "production"
        ? ["https://*.onrender.com", "https://localhost:3000"]
        : "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint for Render.com
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    connectedUsers: connectedUsers.size,
    waitingUsers: waitingUsers.length,
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Store connected users
const connectedUsers = new Map();
const waitingUsers = [];
let totalUsersCount = 0;

// Handle socket connections
io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);

  // Get user's country information
  const clientIP =
    socket.request.connection.remoteAddress || socket.handshake.address;
  const countryInfo = await getCountryFromIP(clientIP);

  // Broadcast updated user count to all clients
  totalUsersCount++;
  io.emit("user-count-update", totalUsersCount);

  // Handle user joining with username
  socket.on("join", (username) => {
    const user = {
      id: socket.id,
      username: username,
      country: countryInfo.country,
      flag: countryInfo.flag,
      socket: socket,
    };

    connectedUsers.set(socket.id, user);
    console.log(
      `${username} (${countryInfo.country}) joined with ID: ${socket.id}`,
    );

    // Send country info back to user
    socket.emit("country-info", countryInfo);
  });

  // Handle finding a match
  socket.on("find-match", () => {
    const currentUser = connectedUsers.get(socket.id);
    if (!currentUser) return;

    // If there's someone waiting, match them
    if (waitingUsers.length > 0) {
      const partner = waitingUsers.pop();

      // Check if partner is still connected
      if (connectedUsers.has(partner.id)) {
        const roomId = uuidv4();

        // Join both users to the same room
        currentUser.socket.join(roomId);
        partner.socket.join(roomId);

        // Notify both users about the match
        currentUser.socket.emit("matched", {
          roomId: roomId,
          partnerUsername: partner.username,
          partnerCountry: partner.country,
          partnerFlag: partner.flag,
          isInitiator: true,
        });

        partner.socket.emit("matched", {
          roomId: roomId,
          partnerUsername: currentUser.username,
          partnerCountry: currentUser.country,
          partnerFlag: currentUser.flag,
          isInitiator: false,
        });

        console.log(
          `Matched ${currentUser.username} with ${partner.username} in room ${roomId}`,
        );
      } else {
        // Partner disconnected, add current user to waiting list
        waitingUsers.push(currentUser);
        socket.emit("searching");
      }
    } else {
      // No one waiting, add current user to waiting list
      waitingUsers.push(currentUser);
      socket.emit("searching");
      console.log(`${currentUser.username} is now waiting for a match`);
    }
  });

  // Handle WebRTC signaling
  socket.on("offer", (data) => {
    socket.to(data.roomId).emit("offer", {
      offer: data.offer,
      from: socket.id,
    });
  });

  socket.on("answer", (data) => {
    socket.to(data.roomId).emit("answer", {
      answer: data.answer,
      from: socket.id,
    });
  });

  socket.on("ice-candidate", (data) => {
    socket.to(data.roomId).emit("ice-candidate", {
      candidate: data.candidate,
      from: socket.id,
    });
  });

  // Handle skip/next partner
  socket.on("skip", (roomId) => {
    const currentUser = connectedUsers.get(socket.id);
    if (!currentUser) return;

    // Leave the current room
    socket.leave(roomId);

    // Notify the partner that user skipped
    socket.to(roomId).emit("partner-skipped");

    // Start searching for a new match
    socket.emit("searching");

    // Add to waiting list
    waitingUsers.push(currentUser);

    // Try to find immediate match
    setTimeout(() => {
      socket.emit("find-match");
    }, 1000);
  });

  // Handle chat messages
  socket.on("chat-message", (data) => {
    socket.to(data.roomId).emit("chat-message", {
      message: data.message,
      username: connectedUsers.get(socket.id)?.username || "Anonymous",
    });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      console.log(`User ${user.username} disconnected`);

      // Remove from connected users
      connectedUsers.delete(socket.id);

      // Remove from waiting list if present
      const waitingIndex = waitingUsers.findIndex((u) => u.id === socket.id);
      if (waitingIndex !== -1) {
        waitingUsers.splice(waitingIndex, 1);
      }

      // Update total user count
      totalUsersCount = Math.max(0, totalUsersCount - 1);
      io.emit("user-count-update", totalUsersCount);

      // Notify rooms about disconnection
      socket.broadcast.emit("partner-disconnected");
    }
  });
});

// Error handling
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  if (NODE_ENV === "development") {
    console.log(`Open http://localhost:${PORT} in your browser`);
  } else {
    console.log("Server is running in production mode");
  }
});

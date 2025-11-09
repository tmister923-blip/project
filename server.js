const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fetch = require("node-fetch");
const cors = require("cors");

// Function to get country from IP with multiple service fallbacks
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

    console.log("Attempting to get country for IP:", cleanIP);

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
      IQ: "🇮🇶",
      SE: "🇸🇪",
      NO: "🇳🇴",
      DK: "🇩🇰",
      FI: "🇫🇮",
      PL: "🇵🇱",
      TR: "🇹🇷",
      SA: "🇸🇦",
      AE: "🇦🇪",
      EG: "🇪🇬",
      MA: "🇲🇦",
      TH: "🇹🇭",
      SG: "🇸🇬",
      MY: "🇲🇾",
      ID: "🇮🇩",
      PH: "🇵🇭",
      VN: "🇻🇳",
    };

    // Try ipapi.co first
    try {
      const response = await fetch(`https://ipapi.co/${cleanIP}/json/`, {
        timeout: 5000,
        headers: { "User-Agent": "VideoChat/1.0" },
      });
      const data = await response.json();

      if (data && data.country_name && !data.error) {
        const result = {
          country: data.country_name,
          flag: flagMap[data.country_code] || "🌍",
        };
        console.log("ipapi.co detected:", result);
        return result;
      }
    } catch (error) {
      console.log("ipapi.co failed:", error.message);
    }

    // Fallback to ip-api.com
    try {
      const response = await fetch(
        `http://ip-api.com/json/${cleanIP}?fields=country,countryCode,status`,
      );
      const data = await response.json();

      if (data && data.status === "success" && data.country) {
        const result = {
          country: data.country,
          flag: flagMap[data.countryCode] || "🌍",
        };
        console.log("ip-api.com detected:", result);
        return result;
      }
    } catch (error) {
      console.log("ip-api.com failed:", error.message);
    }

    // Fallback to ipinfo.io
    try {
      const response = await fetch(`https://ipinfo.io/${cleanIP}/json`);
      const data = await response.json();

      if (data && data.country) {
        const result = {
          country: data.country,
          flag: flagMap[data.country] || "🌍",
        };
        console.log("ipinfo.io detected:", result);
        return result;
      }
    } catch (error) {
      console.log("ipinfo.io failed:", error.message);
    }

    console.log("All country detection services failed for IP:", cleanIP);
  } catch (error) {
    console.log("Error in getCountryFromIP:", error.message);
  }

  return { country: "Unknown", flag: "🌍" };
};

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Configure CORS
app.use(
  cors({
    origin:
      NODE_ENV === "production"
        ? ["https://*.onrender.com", "https://localhost:3000"]
        : "*",
    credentials: true,
  }),
);

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
  pingTimeout: 60000,
  pingInterval: 25000,
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

// Store connected users with better management
const connectedUsers = new Map();
const waitingUsers = [];
const activeRooms = new Map(); // Track active rooms and their participants
let totalUsersCount = 0;

// Clean up disconnected users from waiting list
const cleanupWaitingUsers = () => {
  const validUsers = waitingUsers.filter(
    (user) => connectedUsers.has(user.id) && user.socket.connected,
  );
  waitingUsers.length = 0;
  waitingUsers.push(...validUsers);
};

// Handle socket connections
io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);

  // Get user's real IP address (fix for proxies/load balancers)
  const forwardedFor = socket.handshake.headers["x-forwarded-for"];
  const realIp = socket.handshake.headers["x-real-ip"];
  const cfConnectingIp = socket.handshake.headers["cf-connecting-ip"];

  const clientIP =
    cfConnectingIp ||
    realIp ||
    (forwardedFor ? forwardedFor.split(",")[0].trim() : null) ||
    socket.handshake.address ||
    socket.request.connection.remoteAddress;

  console.log("Headers:", {
    "x-forwarded-for": forwardedFor,
    "x-real-ip": realIp,
    "cf-connecting-ip": cfConnectingIp,
    "handshake-address": socket.handshake.address,
    "connection-address": socket.request.connection.remoteAddress,
  });
  console.log("Final client IP:", clientIP);
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
      joinedAt: Date.now(),
      currentRoom: null,
      isMatched: false,
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

    // Check if user is already matched or in a room
    if (currentUser.isMatched || currentUser.currentRoom) {
      console.log(
        `User ${currentUser.username} is already matched, ignoring find-match request`,
      );
      return;
    }

    // Clean up waiting list first
    cleanupWaitingUsers();

    // If there's someone waiting, match them
    if (waitingUsers.length > 0) {
      const partner = waitingUsers.pop();

      // Double-check partner is still valid and not already matched
      if (
        connectedUsers.has(partner.id) &&
        partner.socket.connected &&
        !partner.isMatched &&
        !partner.currentRoom
      ) {
        const roomId = uuidv4();

        // Update user states
        currentUser.isMatched = true;
        currentUser.currentRoom = roomId;
        partner.isMatched = true;
        partner.currentRoom = roomId;

        // Track the room
        activeRooms.set(roomId, {
          users: [currentUser.id, partner.id],
          createdAt: Date.now(),
        });

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
        // Partner is invalid, try again
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

    // Clean up room and user state
    if (activeRooms.has(roomId)) {
      const room = activeRooms.get(roomId);
      room.users.forEach((userId) => {
        const user = connectedUsers.get(userId);
        if (user) {
          user.isMatched = false;
          user.currentRoom = null;
        }
      });
      activeRooms.delete(roomId);
    }

    // Reset current user state
    currentUser.isMatched = false;
    currentUser.currentRoom = null;

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

      // Clean up room if user was in one
      if (user.currentRoom && activeRooms.has(user.currentRoom)) {
        const room = activeRooms.get(user.currentRoom);

        // Notify partner about disconnection
        socket.to(user.currentRoom).emit("partner-disconnected");

        // Clean up other user in the room
        room.users.forEach((userId) => {
          if (userId !== socket.id) {
            const otherUser = connectedUsers.get(userId);
            if (otherUser) {
              otherUser.isMatched = false;
              otherUser.currentRoom = null;
            }
          }
        });

        activeRooms.delete(user.currentRoom);
      }

      // Remove from connected users
      connectedUsers.delete(socket.id);

      // Remove from waiting list if present (immediate cleanup)
      const waitingIndex = waitingUsers.findIndex((u) => u.id === socket.id);
      if (waitingIndex !== -1) {
        waitingUsers.splice(waitingIndex, 1);
      }

      // Update total user count
      totalUsersCount = Math.max(0, totalUsersCount - 1);
      io.emit("user-count-update", totalUsersCount);
    }
  });
});

// Periodic cleanup of stale connections and rooms
setInterval(() => {
  // Clean up waiting users
  cleanupWaitingUsers();

  // Clean up old rooms (older than 1 hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [roomId, room] of activeRooms.entries()) {
    if (room.createdAt < oneHourAgo) {
      console.log(`Cleaning up old room: ${roomId}`);
      activeRooms.delete(roomId);
    }
  }

  console.log(
    `Active users: ${connectedUsers.size}, Waiting: ${waitingUsers.length}, Active rooms: ${activeRooms.size}`,
  );
}, 30000); // Run every 30 seconds

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

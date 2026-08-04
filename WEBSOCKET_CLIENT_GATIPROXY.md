# WEBSOCKET CLIENT - GATIPROXY

Esta guia documenta como conectarse a Gatiproxy como cliente WebSocket, como pedir la conexion a un usuario de TikTok y que eventos puedes recibir y enviar realmente segun la implementacion actual del proyecto.

## Resumen rapido

- El servidor expone Socket.IO, no un WebSocket nativo.
- Por defecto escucha en el puerto `21213`.
- El cliente recibe dos eventos Socket.IO: `proxy:snapshot` y `proxy:update`.
- El cliente puede enviar dos comandos Socket.IO: `proxy:connect` y `proxy:disconnect`.
- Gatiproxy se conecta internamente a TikTok usando `tiktok-live-connector`.
- Los eventos de TikTok se reenvian al cliente dentro de `session-event`, junto con el payload original del conector y los contadores acumulados.

## Tipo de conexion

La conexion del cliente debe hacerse con Socket.IO 4.x contra la URL local del proxy:

```text
http://localhost:21213
```

Si iniciaste el proxy en otro puerto, reemplaza `21213` por el puerto configurado.

## Instalacion del cliente

### Navegador

```html
<script src="http://localhost:21213/socket.io/socket.io.js"></script>
<script>
	const socket = io('http://localhost:21213');
</script>
```

### Node.js

```bash
npm install socket.io-client
```

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:21213', {
	transports: ['websocket', 'polling']
});
```

## Ejemplo minimo

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:21213');

socket.on('connect', () => {
	console.log('Conectado a Gatiproxy:', socket.id);
});

socket.on('proxy:snapshot', (state) => {
	console.log('Estado inicial:', state);
});

socket.on('proxy:update', (message) => {
	console.log('Actualizacion:', message.type, message.payload, message.state);
	if (message.type === 'session-event') {
		console.log('Evento TikTok:', message.payload.event);
		console.log('Data TikTok:', message.payload.data);
	}
});

socket.emit('proxy:connect', '@usuario', (response) => {
	console.log('ACK connect:', response);
});
```

## Como conectar a un usuario de TikTok

Gatiproxy acepta cualquiera de estas formas como entrada:

- `usuario`
- `@usuario`
- `https://www.tiktok.com/@usuario/live`
- `https://www.tiktok.com/@usuario`

Internamente el proxy normaliza el valor y conserva solo el `uniqueId` de TikTok.

### Envio del comando

```js
socket.emit('proxy:connect', '@usuario', (response) => {
	console.log(response);
});
```

### Respuesta ACK de proxy:connect

```json
{
	"ok": true,
	"session": {
		"username": "usuario",
		"status": "connected",
		"roomId": "1234567890123456789",
		"startedAt": "2026-07-14T12:34:56.000Z",
		"lastEventAt": "2026-07-14T12:34:58.000Z",
		"lastError": null,
		"counters": {
			"chat": 0,
			"gift": 0,
			"like": 0,
			"follow": 0,
			"share": 0,
			"member": 1,
			"streamEnd": 0,
			"error": 0
		}
	}
}
```

### Casos importantes de proxy:connect

#### Error de validacion o de flujo

En estos casos el ACK devuelve `ok: false`:

- usuario vacio
- proxy apagado

Ejemplo:

```json
{
	"ok": false,
	"error": "Primero inicia el proxy para poder conectar sesiones."
}
```

#### Fallo al conectar con TikTok

Este caso es importante: si el proxy pudo intentar la conexion pero `tiktok-live-connector` falla, el ACK devuelve `ok: true` y la sesion queda con `status: "error"`.

Ejemplo:

```json
{
	"ok": true,
	"session": {
		"username": "usuario",
		"status": "error",
		"roomId": null,
		"startedAt": "2026-07-14T12:34:56.000Z",
		"lastEventAt": "2026-07-14T12:34:56.000Z",
		"lastError": "Failed to connect",
		"counters": {
			"chat": 0,
			"gift": 0,
			"like": 0,
			"follow": 0,
			"share": 0,
			"member": 0,
			"streamEnd": 0,
			"error": 1
		}
	}
}
```

Por tanto, no basta con comprobar `ok`. Debes revisar tambien `session.status`.

## Como desconectar a un usuario de TikTok

```js
socket.emit('proxy:disconnect', '@usuario', (response) => {
	console.log(response);
});
```

### Respuesta ACK de proxy:disconnect

```json
{
	"ok": true,
	"session": {
		"username": "usuario",
		"status": "disconnected",
		"roomId": "1234567890123456789",
		"startedAt": "2026-07-14T12:34:56.000Z",
		"lastEventAt": "2026-07-14T12:40:01.000Z",
		"lastError": null,
		"counters": {
			"chat": 12,
			"gift": 1,
			"like": 5,
			"follow": 1,
			"share": 0,
			"member": 3,
			"streamEnd": 0,
			"error": 0
		}
	}
}
```

Si la sesion no existe:

```json
{
	"ok": false,
	"error": "No existe una sesion activa para @usuario."
}
```

## Eventos que recibes desde el WebSocket de Gatiproxy

### 1. proxy:snapshot

Se emite una sola vez al conectar el cliente Socket.IO. Entrega el estado completo actual del proxy.

```js
socket.on('proxy:snapshot', (state) => {
	console.log(state);
});
```

Payload:

```json
{
	"running": true,
	"port": 21213,
	"eulerConfigured": false,
	"eulerSigningEnabled": false,
	"extendedGiftInfoEnabled": false,
	"sessions": [
		{
			"username": "usuario",
			"status": "connected",
			"roomId": "1234567890123456789",
			"startedAt": "2026-07-14T12:34:56.000Z",
			"lastEventAt": "2026-07-14T12:35:10.000Z",
			"lastError": null,
			"counters": {
				"chat": 1,
				"gift": 0,
				"like": 2,
				"follow": 0,
				"share": 0,
				"member": 1,
				"streamEnd": 0,
				"error": 0
			}
		}
	]
}
```

### 2. proxy:update

Se emite en cada cambio relevante de servidor o sesion.

```js
socket.on('proxy:update', (message) => {
	console.log(message.type);
	console.log(message.payload);
	console.log(message.state);
	console.log(message.timestamp);
});
```

Estructura base:

```json
{
	"type": "session-connected",
	"payload": {
		"username": "usuario",
		"roomId": "1234567890123456789"
	},
	"state": {
		"running": true,
		"port": 21213,
		"eulerConfigured": false,
		"eulerSigningEnabled": false,
		"extendedGiftInfoEnabled": false,
		"sessions": []
	},
	"timestamp": 1784032496000
}
```

## Tipos de proxy:update

### Eventos del servidor

#### server-started

Emitido cuando Gatiproxy inicia.

Payload:

```json
{ "port": 21213 }
```

#### server-stopped

Emitido cuando Gatiproxy se detiene.

Payload:

```json
{ "port": 21213 }
```

### Eventos del ciclo de vida de sesion

#### session-connecting

Se emite justo antes de llamar a `connection.connect()` de TikTok.

```json
{ "username": "usuario" }
```

#### session-connected

Se emite cuando TikTok responde correctamente y existe `roomId`.

```json
{
	"username": "usuario",
	"roomId": "1234567890123456789"
}
```

#### session-error

Se emite cuando `connect()` falla o cuando el conector informa un error.

```json
{
	"username": "usuario",
	"error": "Failed to connect"
}
```

#### session-disconnecting

Se emite antes de pedir la desconexion.

```json
{ "username": "usuario" }
```

#### session-disconnected

Se emite en dos situaciones:

- cuando el cliente pide desconectar
- cuando TikTok cierra la conexion

Payload posible cuando la desconexion viene desde TikTok:

```json
{
	"username": "usuario",
	"reason": "websocket closed",
	"code": 1000
}
```

Payload posible cuando la desconexion fue manual:

```json
{ "username": "usuario" }
```

#### session-removed

Se emite despues de eliminar la sesion del mapa interno.

```json
{ "username": "usuario" }
```

### Eventos de actividad TikTok

#### session-event

Este es el evento que entrega al cliente la actividad de TikTok junto con la data original del conector.

Payload:

```json
{
	"username": "usuario",
	"event": "chat",
	"data": {
		"comment": "hola chat",
		"user": {
			"uniqueId": "viewer_01",
			"nickname": "Viewer 01"
		}
	},
	"counters": {
		"chat": 4,
		"gift": 1,
		"like": 9,
		"follow": 1,
		"share": 0,
		"member": 3,
		"streamEnd": 0,
		"error": 0
	}
}
```

Valores posibles de `payload.event` en la implementacion actual:

- `chat`
- `gift`
- `like`
- `follow`
- `share`
- `member`
- `streamEnd`
- `error`

Campos de `payload` en `session-event`:

- `username`: usuario TikTok al que pertenece la sesion
- `event`: nombre del evento TikTok resumido por Gatiproxy
- `data`: payload original entregado por `tiktok-live-connector` para ese evento
- `counters`: contadores acumulados de la sesion

## Eventos de TikTok que Gatiproxy escucha internamente

Gatiproxy usa `tiktok-live-connector` y escucha estos eventos del conector:

### Eventos de control del conector

- `connected`
- `disconnected`
- `error`

### Eventos de TikTok LIVE

- `chat`
- `gift`
- `like`
- `follow`
- `share`
- `member`
- `streamEnd`

## Importante: que datos de TikTok llegan al cliente

En la implementacion actual, Gatiproxy si reenvia al cliente el objeto `data` original emitido por `tiktok-live-connector` dentro de `message.payload.data` cuando el tipo es `session-event`.

Eso significa que el cliente WebSocket de Gatiproxy puede acceder directamente a campos como:

- `data.content` en chat (el texto del mensaje; **no** existe `data.comment`)
- `data.user.displayId` (el `@usuario` real de TikTok; **no** existe `data.user.uniqueId`)
- `data.giftId` y `data.gift.name` / `data.gift.diamondCount`
- `data.repeatCount` / `data.comboCount` / `data.repeatEnd`
- `data.count` (likes de ese evento puntual; **no** `data.likeCount`)
- `data.total` (total acumulado de likes de la sala; **no** `data.totalLikeCount`)
- `data.memberCount`
- `data.action` (en `member` indica el tipo de ingreso; en `follow`/`share` distingue seguir de compartir, ya que ambos vienen del mismo `WebcastSocialMessage`)

> Estos nombres de campo se verificaron capturando muestras reales de cada evento con `scripts/capture-event-schemas.js` (ver `captures/schema-20260802-173011/event-schema-samples.json`). `tiktok-live-connector@2.4.0` reenvia el mensaje `Webcast*Message` casi tal cual lo decodifica del protobuf de TikTok, por lo que varios nombres "genericos" que aparecen en ejemplos de alto nivel de la libreria (`data.comment`, `data.user.uniqueId`, `data.likeCount`, `data.totalLikeCount`, `data.giftDetails.*`) **no existen** en el payload real que reenvia Gatiproxy.

Ademas del payload original, tambien recibe:

- el nombre del usuario TikTok conectado en `payload.username`
- el tipo resumido de evento en `payload.event`
- el payload original del conector en `payload.data`
- los contadores acumulados en `payload.counters`
- el estado global completo en `message.state`

## Referencia de datos de TikTok emitidos al cliente

Estos son los campos verificados capturando eventos reales de un LIVE con `scripts/capture-event-schemas.js` (muestras completas en `captures/schema-20260802-173011/event-schema-samples.json`). `tiktok-live-connector@2.4.0` reenvia el mensaje `Webcast*Message` casi tal cual lo decodifica del protobuf de TikTok, por lo que **no** coincide con los nombres de campo que aparecen en ejemplos genericos de la libreria (por ejemplo, no existe `data.comment` ni `data.user.uniqueId`).

Campos comunes a todos los eventos:

- `data.common.method`: nombre real del mensaje TikTok (`WebcastChatMessage`, `WebcastGiftMessage`, `WebcastLikeMessage`, `WebcastMemberMessage`, `WebcastSocialMessage`)
- `data.common.msgId`: id unico del mensaje, util para deduplicar si Gatiproxy se reconecta
- `data.common.roomId`: sala de origen (coincide con `session.roomId`)
- `data.common.createTime`: epoch en milisegundos (como string) del momento del evento en TikTok
- `data.common.describe`: descripcion humana ya armada por TikTok (normalmente solo viene rellena en `gift`, ej. `"¥GOMEZ¥: gifted the host 1 Rose"`)

Campos comunes a todos los eventos con usuario (`data.user`):

- `data.user.id`: id numerico interno de TikTok
- `data.user.nickname`: nombre visible del usuario
- `data.user.displayId`: el `@usuario` real (equivalente al `uniqueId` que documentan otras versiones de la libreria)
- `data.user.secUid`: id secundario interno de TikTok
- `data.user.followInfo.followerCount` / `.followingCount`: seguidores/seguidos del usuario que genero el evento

### chat

Campos utiles habituales:

- `data.content`: texto del mensaje (no `data.comment`)
- `data.contentLanguage`: idioma detectado del mensaje (ej. `"es"`)
- `data.user.displayId` / `data.user.nickname`
- `data.userIdentity.isGiftGiverOfAnchor` / `.isSubscriberOfAnchor` / `.isFollowerOfAnchor` / `.isModeratorOfAnchor`: banderas utiles para resaltar o moderar mensajes
- `data.emotes`: arreglo de emotes usados en el mensaje (vacio si no hay)

Muestra real capturada:

```json
{
	"content": "ROJO",
	"contentLanguage": "es",
	"user": { "nickname": "¥GOMEZ¥", "displayId": "carlosluisgomezhe" }
}
```

### gift

Campos utiles habituales:

- `data.giftId`: id del regalo (string)
- `data.repeatCount`: cantidad enviada en la racha actual
- `data.comboCount`: cantidad acumulada del combo
- `data.repeatEnd`: `0` mientras la racha sigue activa, `1` cuando termina (es numerico, no booleano)
- `data.groupId`: identificador de la racha/combo, util para agrupar los eventos del mismo envio
- `data.gift.id` / `data.gift.name` / `data.gift.diamondCount` / `data.gift.describe` / `data.gift.image.urlList`
- `data.gift.combo`: indica si el regalo admite racha (streak)
- `data.gift.type`: tipo interno del regalo (**no** `data.giftDetails.giftType`; ese campo no existe)
- `data.user.displayId` / `data.user.nickname`
- `data.toMemberId` / `data.toMemberNickname`: solo se llenan en regalos dirigidos a un invitado especifico (multi-guest)
- `data.extendedGiftInfo` cuando `GATIPROXY_USE_EXTENDED_GIFT_INFO=true` esta activo

Nota importante: la libreria **no** anida los datos del regalo en `data.giftDetails` (ese campo no existe en el payload real); los datos del regalo estan directamente en `data.gift`. Para saber si una racha de regalos termino, revisa `data.repeatEnd === 1` y usa `data.groupId` para agrupar los eventos de la misma racha.

### like

Campos utiles habituales:

- `data.count`: cantidad de likes que trae este evento puntual (**no** `data.likeCount`)
- `data.total`: total acumulado de likes de la sala en la sesion, viene como string (**no** `data.totalLikeCount`)
- `data.user.displayId` / `data.user.nickname`
- `data.likeEffect`: configuracion de animaciones segun nivel de racha de likes, normalmente no es necesaria para el consumidor final

### member

Campos utiles habituales:

- `data.memberCount`: espectadores actuales en la sala
- `data.action`: `1` indica que el usuario entro a la sala
- `data.user.displayId` / `data.user.nickname`
- `data.clientEnterSource` / `data.clientEnterType`: origen del ingreso (ej. `"message-live_cover"`, `"click"`)
- `data.isSetToAdmin` / `data.isTopUser`: banderas de rol del usuario dentro de la sala

### follow

`follow` y `share` llegan del mismo mensaje TikTok (`WebcastSocialMessage`); `tiktok-live-connector` ya los separa en dos eventos distintos de Gatiproxy segun `action`/`shareType`, pero conviene conocer esos campos igual:

Campos utiles habituales:

- `data.user.displayId` / `data.user.nickname`
- `data.action`: `"1"` identifica el evento como "seguir"
- `data.followCount`: numero de seguidor que representa este follow (ej. `"31556"` = seguidor numero 31556 del streamer)
- `data.shareTarget` / `data.targetUserId`: id del streamer que recibio el follow

### share

Campos utiles habituales:

- `data.user.displayId` / `data.user.nickname`
- `data.action`: `"3"` identifica el evento como "compartir"
- `data.shareType`: canal/tipo de share (ej. `"2"`)
- `data.shareCount`: cantidad de veces que este usuario compartio el LIVE
- `data.shareTarget` / `data.targetUserId`: id del streamer compartido

### streamEnd

Campos utiles habituales:

- `data.action`

La libreria distingue al menos entre stream finalizado por el creador y stream suspendido por moderacion.

### disconnected

Campos utiles habituales:

- `code`
- `reason`

### error

Campos utiles habituales:

- `info`
- `exception`

> Nota: `streamEnd` y `error` no se capturaron con una muestra real en `event-schema-samples.json` (el LIVE de la captura seguia activo y sin errores), por lo que sus campos siguen basados en la documentacion generica de `tiktok-live-connector` y aun no estan verificados contra un payload real.

## Eventos que envia el cliente y sus datos

### proxy:connect

Argumentos:

```js
socket.emit('proxy:connect', username, ack);
```

Datos enviados:

- `username`: string

Valores admitidos:

- `usuario`
- `@usuario`
- URL de TikTok con `@usuario`

Respuesta por ACK:

- `{ ok: true, session }`
- `{ ok: false, error }`

### proxy:disconnect

Argumentos:

```js
socket.emit('proxy:disconnect', username, ack);
```

Datos enviados:

- `username`: string

Respuesta por ACK:

- `{ ok: true, session }`
- `{ ok: false, error }`

## Estado de sesion

Los estados que puede ver el cliente en una sesion son:

- `connecting`
- `connected`
- `disconnecting`
- `disconnected`
- `ended`
- `error`

Ejemplo de objeto `session`:

```json
{
	"username": "usuario",
	"status": "connected",
	"roomId": "1234567890123456789",
	"startedAt": "2026-07-14T12:34:56.000Z",
	"lastEventAt": "2026-07-14T12:36:10.000Z",
	"lastError": null,
	"counters": {
		"chat": 2,
		"gift": 1,
		"like": 10,
		"follow": 0,
		"share": 0,
		"member": 1,
		"streamEnd": 0,
		"error": 0
	}
}
```

## Estado global del proxy

Campos del estado global entregado por `proxy:snapshot` y por `message.state`:

- `running`: boolean
- `port`: number | null
- `eulerConfigured`: boolean
- `eulerSigningEnabled`: boolean
- `extendedGiftInfoEnabled`: boolean
- `sessions`: array de sesiones publicas

## Endpoints HTTP REST

Ademas del canal Socket.IO, Gatiproxy expone una API HTTP REST en el mismo puerto (`21213` por defecto). Es util cuando solo necesitas una consulta puntual sin mantener una conexion en tiempo real.

Base URL:

```text
http://localhost:21213
```

### GET /health

Estado rapido del proxy.

```json
{
	"ok": true,
	"name": "Gatiproxy",
	"running": true,
	"port": 21213,
	"eulerConfigured": false,
	"eulerSigningEnabled": false,
	"sessions": 1
}
```

### GET /sessions

Lista de sesiones publicas activas (mismo formato que `state.sessions`).

### POST /sessions

Conecta una sesion de TikTok. Cuerpo JSON:

```json
{ "username": "@usuario" }
```

Respuesta `201` con el objeto `session`. Errores de validacion o flujo devuelven `400` con `{ "error": "..." }`.

### DELETE /sessions/:username

Desconecta y elimina la sesion indicada. Respuesta `200` con el objeto `session`, o `400` si la sesion no existe.

### GET /sessions/:username/room-info

Devuelve la informacion de la sala de TikTok:

```json
{
	"username": "usuario",
	"roomInfo": { "...": "..." }
}
```

### GET /sessions/:username/gifts

Devuelve el catalogo completo de regalos disponibles en la sala actual del usuario.

```text
GET http://localhost:21213/sessions/radiokatiadelperu/gifts
```

Respuesta `200`:

```json
{
	"username": "radiokatiadelperu",
	"gifts": [
		{
			"id": 5655,
			"name": "Rose",
			"diamond_count": 1,
			"describe": "sent Rose",
			"image": { "...": "..." },
			"...": "..."
		}
	]
}
```

Notas importantes sobre `gifts`:

- No requiere que la sesion este previamente conectada; si no existe una sesion activa para el usuario, el proxy resuelve el `roomId` automaticamente para poder consultar el catalogo.
- Gatiproxy consulta el endpoint `gift/list/` de TikTok **sin firma** (sin EulerStream). Por eso funciona aunque no tengas un plan Business de EulerStream.
- El campo `gifts` es un arreglo con todos los regalos disponibles (habitualmente cientos de entradas). Cada elemento incluye datos como `id`, `name`, `diamond_count`, `describe`, imagenes y metadatos de racha (`batch_gift_info`, `combo`, etc.) tal como los entrega TikTok.
- En caso de error (por ejemplo, usuario invalido o sala no encontrada) responde `400` con `{ "error": "..." }`.

## Consideraciones importantes

### 1. Socket.IO, no WebSocket puro

Si intentas conectarte con la API nativa `new WebSocket(...)`, no vas a obtener el mismo protocolo de eventos. Debes usar un cliente Socket.IO compatible.

### 2. Los eventos TikTok incluyen su data original

Gatiproxy emite cada `session-event` con `payload.data`, que contiene el objeto original entregado por `tiktok-live-connector` para ese evento.

### 3. El contador member sube al conectar

Actualmente, cuando el conector emite `connected`, Gatiproxy incrementa `counters.member` una vez. Ese contador no representa solo viewers entrantes; tambien se incrementa en la conexion inicial.

### 4. follow y share vienen como eventos derivados

En `tiktok-live-connector`, `follow` y `share` son eventos derivados del evento social. Gatiproxy escucha directamente esos eventos derivados.

### 5. extendedGiftInfo depende de configuracion

Si activas:

```bash
GATIPROXY_USE_EXTENDED_GIFT_INFO=true
```

el conector pedira informacion extendida de gifts y, cuando TikTok Live Connector la incluya en el evento `gift`, Gatiproxy la reenviara dentro de `payload.data.extendedGiftInfo`.

## Ejemplo recomendado de cliente robusto

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:21213');

socket.on('connect', () => {
	console.log('Socket conectado');
});

socket.on('proxy:snapshot', (state) => {
	console.log('Snapshot inicial:', state);
});

socket.on('proxy:update', (message) => {
	switch (message.type) {
		case 'session-connected':
			console.log(`Sesion conectada: @${message.payload.username}`);
			break;
		case 'session-event':
			console.log(
				`Evento ${message.payload.event} en @${message.payload.username}`,
				message.payload.data,
				message.payload.counters
			);
			break;
		case 'session-error':
			console.error(`Error en @${message.payload.username}:`, message.payload.error);
			break;
		default:
			console.log('Update:', message.type, message.payload);
	}
});

function connectTikTokUser(username) {
	socket.emit('proxy:connect', username, (response) => {
		if (!response?.ok) {
			console.error('No se pudo solicitar la conexion:', response?.error);
			return;
		}

		if (response.session?.status === 'error') {
			console.error('TikTok rechazo o fallo la conexion:', response.session.lastError);
			return;
		}

		console.log('Sesion solicitada correctamente:', response.session);
	});
}

connectTikTokUser('@usuario');
```

## Relacion con el codigo del proyecto

Esta documentacion se basa en la implementacion actual del proxy y en la libreria `tiktok-live-connector` usada por el proyecto.

- La logica Socket.IO del proxy esta en `src/proxy/proxyManager.js`.
- El ejemplo visual de consumo esta en `example-activity-log.html`.
- La version actual del conector es `tiktok-live-connector@2.4.0`.

## Referencia externa

Para ver el detalle completo de los payloads emitidos por TikTok Live Connector, revisa:

- https://github.com/zerodytrash/TikTok-Live-Connector

Esa documentacion es la referencia correcta para los campos internos de eventos como `chat`, `gift`, `like`, `member`, `follow`, `share`, `streamEnd`, `disconnected` y `error`.
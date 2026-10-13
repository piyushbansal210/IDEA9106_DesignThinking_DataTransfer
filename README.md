# CrossBorder Transfer Lab

A two-browser demonstration app. The Node.js server relays encrypted messages over WebSockets. Browser payloads are encrypted/decrypted with Web Crypto AES-256-GCM. Text/personal details and files/images up to 8 MiB are supported.

## Run locally

1. Install Node.js 18+.
2. In this folder run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in two separate browser windows.
5. Sign in with `admin` / `demo123` in both.
6. Use the same room code in both (default `privacy-demo-01`). Select Australia in one and Europe/EEA in the other, then click Connect to room.
7. Send text or a file from either browser. The other browser decrypts and displays it.

## Using two computers / VPNs

`localhost` only works on the same computer. To connect two separate devices, deploy this app to a server reachable by both browsers and use its `wss://your-domain` URL in the Relay server URL field. For production, configure HTTPS/WSS, authentication, room authorization, rate limiting, origin checks, secure key exchange, server-side monitoring and retention controls. Do not expose a raw demo server to the public internet with real personal data.

## Security limitations

- Login is only a client-side demo gate, not real authentication.
- Shared room code is used to derive a key via PBKDF2; this is for demonstrations, not production cryptographic key exchange.
- The relay forwards ciphertext only, but metadata (connection IP, room code, timing, payload size and declared region) is visible to the relay/operator.
- Audit log lives in the browser memory and can be edited by the user; it is not a tamper-proof audit log.
- “Region” is a user-selected label; VPN geography is not verified, and a VPN location does not determine which laws apply.
- The privacy policy selector is educational and is not legal advice or a compliance engine.


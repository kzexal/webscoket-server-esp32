"use strict";
/////////////////////////////////////////////////////////////////
/*
IA Assistant
*/
/////////////////////////////////////////////////////////////////
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const app = (0, express_1.default)();
const WS_PORT = parseInt(process.env.WS_PORT || "8888");
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "8000");
const wsServer = new ws_1.WebSocketServer({ port: WS_PORT }, () => console.log(`WS server is listening at ws://localhost:${WS_PORT}`));
// array of connected websocket clients
let connectedClients = [];
wsServer.on("connection", (ws, req) => {
    console.log("Connected");
    // add new connected client
    connectedClients.push(ws);
    // listen for messages from the streamer, the clients will not send anything so we don't need to filter
    ws.on("message", (data) => {
        connectedClients.forEach((ws, i) => {
            if (ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(data);
            }
            else {
                connectedClients.splice(i, 1);
            }
        });
    });
});
// HTTP stuff
app.use("/image", express_1.default.static("image"));
app.use("/js", express_1.default.static("js"));
app.get("/audio", (req, res) => res.sendFile(path_1.default.resolve(__dirname, "./audio_client.html")));
app.listen(HTTP_PORT, () => console.log(`HTTP server listening at http://localhost:${HTTP_PORT}`));

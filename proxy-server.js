import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import http from 'http';
import WebSocket from 'ws';

const { Server: WebSocketServer } = WebSocket;

const app = express();
const port = 3001;

app.use(cors({ origin: '*' }));

const wss = new WebSocketServer({ noServer: true });

// Maintain a list of connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    try {
      const { coin, interval } = JSON.parse(message);
      // Set the coin and interval properties on the WebSocket instance
      ws.coin = coin || '';
      ws.interval = interval || '';
      console.log('Coin:', ws.coin);
      console.log('Interval:', ws.interval);

      // Send the latest data to the newly connected client immediately on request
      sendLatestData(ws);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error.message);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  // const { coin, interval } = req.params;
  
  // Set the coin and interval properties on the WebSocket instance
  ws.coin = ''; // Set the default value or retrieve it from the client
  ws.interval = ''; // Set the default value or retrieve it from the client

  // Send the latest data to the newly connected client immediately
  sendLatestData(ws);

  // Send the latest data to the newly connected client
  const dataUpdateInterval = setInterval(() => {
    sendLatestData(ws);
  }, 60000); // 60000 milliseconds = 1 minute

  // Save the interval ID on the WebSocket instance for cleanup
  ws.dataUpdateInterval = dataUpdateInterval;
});

// eslint-disable-next-line no-undef
app.get('/api/data/:coin/:interval', async (req, res) => {
  console.log('Request received:', req.params);
  try {
    // const { coin, interval } = req.params; // Remove this line

    if (!req.params.coin || !req.params.interval) {
      res.status(400).json({ error: 'Bad Request. Coin and interval are required parameters.' });
      return;
    }

    const fileName = `${req.params.coin.toUpperCase()}USDT-data-${req.params.interval}.json`;
    const url = `https://storage.googleapis.com/rc-robot-binance-api/data/${fileName}`;

    const response = await fetch(url, { credentials: 'include' });

    const data = await response.json();

    // Sort the data by event time in descending order
    const sortedData = data.sort((a, b) => new Date(b.event_time) - new Date(a.event_time));

    // Send the sorted data to all connected clients
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(sortedData));
      }
    });

    res.json(sortedData);
  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const sendLatestData = async (ws) => {
  const coin = ws.coin;
  const interval = ws.interval;
  console.log('Coin:', coin);
  console.log('Interval:', interval);

  const fileName = `${coin.toUpperCase()}USDT-data-${interval}.json`;
  console.log('Constructed fileName:', fileName);

  const url = `https://storage.googleapis.com/rc-robot-binance-api/data/${fileName}`;
  console.log('Constructed URL:', url);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.error(`File not found for ${coin} with interval ${interval}`);
      } else {
        console.error(`HTTP error! Status: ${response.status}`);
      }
      return;
    }

    const data = await response.json();
    const sortedData = data.sort((a, b) => new Date(b.event_time) - new Date(a.event_time));
    ws.send(JSON.stringify(sortedData));
  } catch (error) {
    console.error('Error sending updated data:', error);
  }
};

const server = http.createServer(app);

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(port, () => {
  console.log(`Proxy server is running on port ${port}`);
});

#!/usr/bin/env node
// Stdio-to-Streamable-HTTP proxy for SNOMED MCP server.
// Bridges Claude Code's stdio MCP client to the remote HTTP server,
// injecting the required Host header that iris-mcp-server enforces.
// Uses http.request (not fetch) because fetch cannot override the Host header.
// Messages are queued and sent sequentially to maintain session state.

import { createInterface } from 'readline';
import http from 'http';

const REMOTE_HOST = 'snomed-public-alb-295804725.us-east-2.elb.amazonaws.com';
const REMOTE_PORT = 8080;
const REMOTE_PATH = '/mcp';

let sessionId = null;
let stdinClosed = false;
let processing = false;
const queue = [];

const rl = createInterface({ input: process.stdin, terminal: false });

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function maybeExit() {
  if (stdinClosed && queue.length === 0 && !processing) {
    process.exit(0);
  }
}

function processQueue() {
  if (processing || queue.length === 0) {
    maybeExit();
    return;
  }
  processing = true;
  const message = queue.shift();
  forwardToRemote(message, () => {
    processing = false;
    processQueue();
  });
}

function forwardToRemote(message, done) {
  const body = JSON.stringify(message);
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Host': 'localhost:8080',
    'Content-Length': Buffer.byteLength(body)
  };
  if (sessionId) {
    headers['mcp-session-id'] = sessionId;
  }

  const req = http.request({
    hostname: REMOTE_HOST,
    port: REMOTE_PORT,
    path: REMOTE_PATH,
    method: 'POST',
    headers,
    setHost: false
  }, (res) => {
    const newSession = res.headers['mcp-session-id'];
    if (newSession) sessionId = newSession;

    if (res.statusCode === 202) {
      done();
      return;
    }

    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode !== 200) {
        if (message.id !== undefined) {
          send({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: `HTTP ${res.statusCode}: ${data}` } });
        }
      } else {
        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('text/event-stream')) {
          for (const line of data.split('\n')) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6).trim();
              if (payload) {
                try { send(JSON.parse(payload)); } catch {}
              }
            }
          }
        } else {
          try { send(JSON.parse(data)); } catch {}
        }
      }
      done();
    });
  });

  req.on('error', (err) => {
    if (message.id !== undefined) {
      send({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: err.message } });
    }
    done();
  });

  req.write(body);
  req.end();
}

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const message = JSON.parse(trimmed);
    queue.push(message);
    processQueue();
  } catch {}
});

rl.on('close', () => {
  stdinClosed = true;
  maybeExit();
});

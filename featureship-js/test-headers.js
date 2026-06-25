const http = require('http');
const { EventSource } = require('eventsource');

const server = http.createServer((req, res) => {
  console.log('Headers received:', req.headers);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.end();
  server.close();
});

server.listen(5001, () => {
  console.log('Test server running on 5001');
  const es = new EventSource('http://localhost:5001/', {
    headers: {
      'Authorization': 'Bearer test-token'
    }
  });
  es.onopen = () => {
    console.log('Opened');
    es.close();
  };
  es.onerror = (e) => {
    console.error('Error', e);
  };
});

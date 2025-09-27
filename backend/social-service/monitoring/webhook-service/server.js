const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 5001;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Alert history for deduplication
const alertHistory = new Map();
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'webhook-service' }));
    return;
  }

  // Alert webhook endpoint
  if (path === '/alerts' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const alertData = JSON.parse(body);
        console.log('Received alert:', JSON.stringify(alertData, null, 2));
        
        await processAlerts(alertData);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Alerts processed' }));
      } catch (error) {
        console.error('Error processing alerts:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to process alerts' }));
      }
    });
    return;
  }

  // Get alert statistics
  if (path === '/stats' && method === 'GET') {
    const stats = {
      totalAlerts: alertHistory.size,
      activeAlerts: Array.from(alertHistory.values()).filter(alert => 
        Date.now() - alert.lastSeen < ALERT_COOLDOWN
      ).length,
      alertsByService: {},
      alertsBySeverity: {}
    };

    Array.from(alertHistory.values()).forEach(alert => {
      const service = alert.labels.service || 'unknown';
      const severity = alert.labels.severity || 'unknown';
      
      stats.alertsByService[service] = (stats.alertsByService[service] || 0) + 1;
      stats.alertsBySeverity[severity] = (stats.alertsBySeverity[severity] || 0) + 1;
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

async function processAlerts(alertData) {
  const alerts = alertData.alerts || [];
  
  for (const alert of alerts) {
    const alertKey = `${alert.labels.alertname}-${alert.labels.service || 'unknown'}`;
    const now = Date.now();
    
    // Check if we've seen this alert recently (deduplication)
    const lastAlert = alertHistory.get(alertKey);
    if (lastAlert && (now - lastAlert.lastSeen) < ALERT_COOLDOWN) {
      console.log(`Skipping duplicate alert: ${alertKey}`);
      continue;
    }
    
    // Update alert history
    alertHistory.set(alertKey, {
      ...alert,
      lastSeen: now,
      count: (lastAlert?.count || 0) + 1
    });
    
    // Process the alert
    await sendAlert(alert);
  }
}

async function sendAlert(alert) {
  const severity = alert.labels.severity || 'unknown';
  const service = alert.labels.service || 'unknown';
  const alertname = alert.labels.alertname || 'Unknown Alert';
  const summary = alert.annotations.summary || 'No summary available';
  const description = alert.annotations.description || 'No description available';
  
  console.log(`Processing alert: ${alertname} (${severity}) for ${service}`);
  
  // Send to Slack
  if (SLACK_WEBHOOK_URL) {
    await sendSlackAlert(alert, {
      severity,
      service,
      alertname,
      summary,
      description
    });
  }
  
  // Send to Telegram
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    await sendTelegramAlert(alert, {
      severity,
      service,
      alertname,
      summary,
      description
    });
  }
  
  // Log to console
  console.log(`Alert sent: ${alertname} - ${summary}`);
}

async function sendSlackAlert(alert, { severity, service, alertname, summary, description }) {
  const color = getSeverityColor(severity);
  const emoji = getSeverityEmoji(severity);
  
  const payload = {
    username: 'Social Service Monitor',
    icon_emoji: ':warning:',
    attachments: [
      {
        color: color,
        title: `${emoji} ${alertname}`,
        text: summary,
        fields: [
          {
            title: 'Service',
            value: service,
            short: true
          },
          {
            title: 'Severity',
            value: severity.toUpperCase(),
            short: true
          },
          {
            title: 'Description',
            value: description,
            short: false
          },
          {
            title: 'Time',
            value: new Date().toISOString(),
            short: true
          }
        ],
        footer: 'Social Service Monitoring',
        ts: Math.floor(Date.now() / 1000)
      }
    ]
  };
  
  try {
    await makeHttpRequest(SLACK_WEBHOOK_URL, 'POST', JSON.stringify(payload), {
      'Content-Type': 'application/json'
    });
    console.log('Slack alert sent successfully');
  } catch (error) {
    console.error('Failed to send Slack alert:', error.message);
  }
}

async function sendTelegramAlert(alert, { severity, service, alertname, summary, description }) {
  const emoji = getSeverityEmoji(severity);
  
  const message = `${emoji} *${alertname}*\n\n` +
    `*Service:* ${service}\n` +
    `*Severity:* ${severity.toUpperCase()}\n` +
    `*Summary:* ${summary}\n` +
    `*Description:* ${description}\n` +
    `*Time:* ${new Date().toISOString()}`;
  
  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'Markdown'
  };
  
  try {
    await makeHttpRequest(telegramUrl, 'POST', JSON.stringify(payload), {
      'Content-Type': 'application/json'
    });
    console.log('Telegram alert sent successfully');
  } catch (error) {
    console.error('Failed to send Telegram alert:', error.message);
  }
}

function getSeverityColor(severity) {
  switch (severity.toLowerCase()) {
    case 'critical': return 'danger';
    case 'warning': return 'warning';
    case 'info': return 'good';
    default: return '#439FE0';
  }
}

function getSeverityEmoji(severity) {
  switch (severity.toLowerCase()) {
    case 'critical': return '🚨';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '📊';
  }
}

function makeHttpRequest(url, method, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    };
    
    const httpModule = urlObj.protocol === 'https:' ? https : http;
    
    const req = httpModule.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(data);
    req.end();
  });
}

// Cleanup old alerts periodically
setInterval(() => {
  const now = Date.now();
  const expiredAlerts = [];
  
  for (const [key, alert] of alertHistory.entries()) {
    if (now - alert.lastSeen > ALERT_COOLDOWN * 2) {
      expiredAlerts.push(key);
    }
  }
  
  expiredAlerts.forEach(key => alertHistory.delete(key));
  
  if (expiredAlerts.length > 0) {
    console.log(`Cleaned up ${expiredAlerts.length} expired alerts`);
  }
}, 60000); // Run every minute

server.listen(PORT, () => {
  console.log(`Webhook service running on port ${PORT}`);
  console.log(`Slack integration: ${SLACK_WEBHOOK_URL ? 'enabled' : 'disabled'}`);
  console.log(`Telegram integration: ${TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID ? 'enabled' : 'disabled'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down webhook service...');
  server.close(() => {
    process.exit(0);
  });
});
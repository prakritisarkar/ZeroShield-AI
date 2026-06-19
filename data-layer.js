require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require("socket.io");
const { analyzeLog } = require('./ai-engine');
const authRoutes = require('./routes/auth');
const Log = require('./models/Log');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up server and generic WebSockets
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Boot MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() =>
        console.log('[DB] MongoDB elegantly connected for SaaS continuity.')
    )
    .catch(err =>
        console.warn(
            '[DB] MongoDB failed to connect. Running in degraded array mode.',
            err.message
        )
    );

// Register User Authentication Routes
app.use('/api/auth', authRoutes);

// Fallback arrays for prototype performance
const cloudLogs = [];
const denyList = [];
const isolationLogs = [];

const systemServices = [
    { name: 'Auth Gateway', status: 'active', icon: 'Lock' },
    { name: 'API Proxy', status: 'active', icon: 'ArrowRightLeft' },
    { name: 'Data Pipeline', status: 'active', icon: 'Database' },
    { name: 'ML Engine', status: 'active', icon: 'Brain' },
    { name: 'Container Orch', status: 'active', icon: 'Boxes' },
    { name: 'Log Aggregator', status: 'active', icon: 'FileText' }
];

let liveApiWindow = 0;
let liveTrafficWindow = 0;

setInterval(() => {
    liveApiWindow = 0;
    liveTrafficWindow = 0;
}, 1000);

function emitDashboardStats() {
    const totalEvents = cloudLogs.length;
    const latestLog = totalEvents > 0 ? cloudLogs[cloudLogs.length - 1] : null;
    const currentRiskScore =
        latestLog && latestLog.riskScore ? latestLog.riskScore : 0;

    const totalThreatsDetected = Math.floor(totalEvents * 0.625);
    const totalThreatsPrevented = Math.floor(totalEvents * 0.25);
    const recentAutomatedIsolations = [...isolationLogs]
        .reverse()
        .slice(0, 50);

    const apiCallsPerSec =
        liveApiWindow > 0
            ? liveApiWindow
            : Math.floor(Math.random() * 50) + 700;

    const networkMb =
        liveTrafficWindow > 0
            ? (liveTrafficWindow / 1024).toFixed(1)
            : (Math.random() * 2 + 1).toFixed(1);

    const activeUsers = Math.floor(200 + Math.random() * 30);

    io.emit('stats_update', {
        currentRiskScore,
        totalEvents,
        totalThreatsDetected,
        totalThreatsPrevented,
        recentAutomatedIsolations,
        services: systemServices,
        liveMetrics: {
            apiCalls: apiCallsPerSec,
            networkTraffic: parseFloat(networkMb),
            activeUsers
        }
    });
}

io.on('connection', (socket) => {
    emitDashboardStats();

    socket.on('launch_sim_burst', async () => {
        io.emit('live_alert', {
            type: 'warning',
            msg: 'Simulated Zero-day attack burst initiated via WebSocket.',
            src: 'UI/Admin',
            time: new Date().toLocaleTimeString('en-US', {
                hour12: false
            })
        });

        for (let i = 0; i < 50; i++) {
            await processIngestion({
                timestamp: new Date().toISOString(),
                sourceIP: "10.13.37." + Math.floor(Math.random() * 255),
                apiCall: "iam:AttachRolePolicy",
                dataVolume: Math.floor(Math.random() * 1000) + 5000
            });
        }
    });
});

async function processIngestion(data) {
    const { timestamp, sourceIP, apiCall, dataVolume } = data;

    if (denyList.includes(sourceIP)) {
        return {
            status: 403,
            error: "Traffic blocked. IP is on the ZeroShield DenyList."
        };
    }

    liveApiWindow += 1;
    liveTrafficWindow += dataVolume || 0;

    const newLog = {
        id: cloudLogs.length + 1,
        timestamp,
        sourceIP,
        apiCall,
        dataVolume,
        ingestedAt: new Date().toISOString()
    };

    const analysisResult = analyzeLog(newLog, cloudLogs);

    const finalLog = {
        ...newLog,
        riskScore: analysisResult.riskScore,
        isAnomaly: analysisResult.isAnomaly,
        reasons: analysisResult.reasons
    };

    cloudLogs.push(finalLog);

    try {
        const dbLog = new Log(finalLog);
        await dbLog.save();
    } catch (e) {}

    io.emit('new_log', finalLog);
    emitDashboardStats();

    if (analysisResult.isAnomaly) {
        if (analysisResult.riskScore > 60) {
            io.emit('live_alert', {
                type: 'critical',
                msg: 'Anomaly Detected: Volatile Access Pattern.',
                src: sourceIP,
                time: new Date().toLocaleTimeString('en-US', {
                    hour12: false
                })
            });
        }

        if (analysisResult.riskScore > 80) {
            if (!denyList.includes(sourceIP)) {
                denyList.push(sourceIP);

                isolationLogs.push({
                    ip: sourceIP,
                    timestamp: new Date().toISOString(),
                    reason: `Threshold Limit Reached (${analysisResult.riskScore}/100)`
                });

                const activeIdx = systemServices.findIndex(
                    (s) => s.status === 'active'
                );

                if (activeIdx > -1) {
                    systemServices[activeIdx].status = 'isolated';
                }

                io.emit('live_alert', {
                    type: 'critical',
                    msg: 'Service node automatically ISOLATED and IP blacklisted.',
                    src: sourceIP,
                    time: new Date().toLocaleTimeString('en-US', {
                        hour12: false
                    })
                });
            }
        }
    }

    return {
        status: 201,
        message: "Log processed",
        analysis: analysisResult
    };
}

// API ROUTES

app.post('/api/ingest', async (req, res) => {
    const { timestamp, sourceIP, apiCall, dataVolume } = req.body;

    if (!timestamp || !sourceIP || !apiCall || dataVolume === undefined) {
        return res.status(400).json({ error: "Missing fields" });
    }

    const result = await processIngestion({
        timestamp,
        sourceIP,
        apiCall,
        dataVolume
    });

    return res.status(result.status).json(result);
});

app.post('/api/analyze', (req, res) => {
    setTimeout(() => {
        res.status(200).json({ message: "Analysis complete" });
    }, 1000);
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/api/logs', (req, res) => {
    const mockLogs = [
        {
            id: 1,
            time: '20:02:00',
            type: 'threat',
            severity: 'critical',
            message:
                'Zero-day exploit detected on API gateway endpoint /v2/auth',
            source: 'AI Detection Engine'
        },
        {
            id: 2,
            time: '20:00:00',
            type: 'api',
            severity: 'warning',
            message: 'POST /api/v2/users - 403 Forbidden (blocked)',
            source: 'API Gateway'
        },
        {
            id: 3,
            time: '19:58:00',
            type: 'system',
            severity: 'info',
            message: 'Auto-response: IP 192.168.1.45 blocked',
            source: 'Response Engine'
        }
    ];

    res.json(mockLogs);
});

app.get('/api/stats', (req, res) => {
    const totalEvents = cloudLogs.length;

    res.json({
        risk_score:
            cloudLogs.length > 0
                ? cloudLogs[cloudLogs.length - 1].riskScore
                : 12,
        active_alerts: Math.floor(totalEvents * 0.625) || 3,
        monitored_endpoints: 1250,
        system_status: 'Online'
    });
});

app.get('/api/threats', (req, res) => {
    res.json([
        {
            name: "CVE-2024-0001 Exploit",
            desc: "Zero-Day RCE",
            ip: "192.168.1.45",
            cloud: "AWS",
            status: "Active"
        }
    ]);
});

// NEW NOTIFICATION ROUTES

app.get('/api/notifications', (req, res) => {
    res.json([
        {
            id: 'n1',
            title: 'System Online',
            message: 'ZeroShield backend operational.',
            severity: 'info',
            type: 'system',
            timestamp: new Date().toISOString(),
            read: false
        }
    ]);
});

app.post('/api/notifications/read', (req, res) => {
    const { id } = req.body;

    res.status(200).json({
        success: true,
        message: `Notification ${id} marked as read`
    });
});

app.post('/api/simulate', async (req, res) => {
    res.status(202).json({
        message: "Zero-Day Attack burst initiated"
    });

    for (let i = 0; i < 100; i++) {
        await processIngestion({
            timestamp: new Date().toISOString(),
            sourceIP: "10.13.37.99",
            apiCall: "iam:AttachRolePolicy",
            dataVolume: Math.floor(Math.random() * 1000) + 5000
        });
    }
});

server.listen(PORT, () => {
    console.log(`[SYS] ZeroShield Full-Stack Mode Running on port ${PORT}`);
});
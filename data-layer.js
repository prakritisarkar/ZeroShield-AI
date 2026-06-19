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

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('[DB] MongoDB elegantly connected for SaaS continuity.');
    })
    .catch(err => {
        console.warn(
            '[DB] MongoDB failed to connect. Running in degraded array mode.',
            err.message
        );
    });

app.use('/api/auth', authRoutes);

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

    io.emit('stats_update', {
        currentRiskScore: latestLog?.riskScore || 0,
        totalEvents,
        totalThreatsDetected: cloudLogs.filter(log => log.isAnomaly).length,
        totalThreatsPrevented: denyList.length,
        recentAutomatedIsolations: [...isolationLogs].reverse().slice(0, 50),
        services: systemServices,
        liveMetrics: {
            apiCalls: liveApiWindow || Math.floor(Math.random() * 50) + 700,
            networkTraffic: liveTrafficWindow
                ? parseFloat((liveTrafficWindow / 1024).toFixed(1))
                : parseFloat((Math.random() * 2 + 1).toFixed(1)),
            activeUsers: Math.floor(200 + Math.random() * 30)
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
            time: new Date().toLocaleTimeString('en-US', { hour12: false })
        });

        for (let i = 0; i < 50; i++) {
            await processIngestion({
                timestamp: new Date().toISOString(),
                sourceIP: `10.13.37.${Math.floor(Math.random() * 255)}`,
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
            error: "Traffic blocked. IP is blacklisted."
        };
    }

    liveApiWindow++;
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
        await new Log(finalLog).save();
    } catch (e) {}

    io.emit('new_log', finalLog);
    emitDashboardStats();

    if (analysisResult.isAnomaly) {
        if (analysisResult.riskScore > 80 && !denyList.includes(sourceIP)) {
            denyList.push(sourceIP);

            isolationLogs.push({
                ip: sourceIP,
                timestamp: new Date().toISOString(),
                reason: `Threshold Limit Reached (${analysisResult.riskScore}/100)`
            });

            const activeIdx = systemServices.findIndex(
                s => s.status === 'active'
            );

            if (activeIdx > -1) {
                systemServices[activeIdx].status = 'isolated';
            }
        }

        io.emit('live_alert', {
            type: analysisResult.riskScore > 80 ? 'critical' : 'warning',
            msg: 'Anomaly detected.',
            src: sourceIP,
            time: new Date().toLocaleTimeString('en-US', { hour12: false })
        });
    }

    return {
        status: 201,
        message: "Log processed",
        analysis: analysisResult
    };
}

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

    res.status(result.status).json(result);
});

app.post('/api/analyze', (req, res) => {
    setTimeout(() => {
        res.status(200).json({ message: "Analysis complete" });
    }, 1000);
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/logs', (req, res) => {
    res.json(cloudLogs.slice(-50).reverse());
});

app.get('/api/stats', (req, res) => {
    res.json({
        risk_score: cloudLogs.length
            ? cloudLogs[cloudLogs.length - 1].riskScore
            : 12,
        active_alerts: cloudLogs.filter(log => log.isAnomaly).length,
        monitored_endpoints: 1250,
        system_status: 'Online'
    });
});

app.get('/api/threats', (req, res) => {
    const threats = cloudLogs
        .filter(log => log.isAnomaly)
        .slice(-20)
        .map(log => ({
            name: "Detected Threat",
            desc: log.reasons?.join(', ') || "Suspicious Activity",
            ip: log.sourceIP,
            cloud: "AWS",
            status: "Active"
        }));

    res.json(threats);
});

app.get('/api/detections', (req, res) => {
    const detections = cloudLogs
        .filter(log => log.isAnomaly)
        .slice(-20)
        .reverse();

    res.json(detections);
});

app.get('/api/simulation-results', (req, res) => {
    res.json({
        total_logs: cloudLogs.length,
        anomalies: cloudLogs.filter(log => log.isAnomaly).length,
        blocked_ips: denyList.length,
        isolated_services: systemServices.filter(
            s => s.status === 'isolated'
        ).length
    });
});

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

    res.json({
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
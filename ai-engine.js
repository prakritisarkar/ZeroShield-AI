/**
 * AI Threat Detection Engine
 */

function analyzeLog(newLog, existingLogs) {
    let riskScore = 0;
    const reasons = [];

    const historicalLogs = existingLogs.filter(
        log => log.id !== newLog.id
    );

    // Rule 1: suspicious IAM privilege escalation
    if (
        newLog.apiCall.includes('AttachRolePolicy') ||
        newLog.apiCall.includes('iam:')
    ) {
        riskScore += 85;
        reasons.push('Privilege escalation attempt detected');
    }

    // Rule 2: data volume anomaly
    if (historicalLogs.length > 0) {
        const totalVolume = historicalLogs.reduce(
            (sum, log) => sum + log.dataVolume,
            0
        );

        const averageVolume = totalVolume / historicalLogs.length;

        if (newLog.dataVolume > averageVolume * 3) {
            riskScore += 40;
            reasons.push('Abnormal traffic spike detected');
        }

        // Rule 3: new source IP
        const knownIPs = new Set(
            historicalLogs.map(log => log.sourceIP)
        );

        if (!knownIPs.has(newLog.sourceIP)) {
            riskScore += 25;
            reasons.push('Unrecognized source IP');
        }
    }

    riskScore = Math.min(riskScore, 100);

    return {
        isAnomaly: riskScore >= 50,
        riskScore,
        reasons
    };
}

module.exports = {
    analyzeLog
};
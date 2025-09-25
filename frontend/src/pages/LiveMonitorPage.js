import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LiveMonitorPage = () => {
    const [monitorData, setMonitorData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Redirect to the actual live-monitor.html file served by backend
        window.location.href = `${window.location.protocol}//${window.location.hostname}:3001/monitor`;
    }, []);

    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
            fontSize: '18px'
        }}>
            Doorverwijzen naar live monitor...
        </div>
    );
};

export default LiveMonitorPage;
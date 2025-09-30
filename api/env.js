// /api/env.js - Serverless Function zur sicheren Auslieferung der Supabase-Konfiguration

export default function handler(req, res) {
  // CORS Headers für Frontend-Zugriff
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Nur GET-Requests erlauben
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Supabase-Konfiguration aus Umgebungsvariablen laden
    const config = {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    };
    
    // Validierung: Beide Werte müssen vorhanden sein
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      console.error('Supabase environment variables not configured');
      return res.status(500).json({ 
        error: 'Server configuration error' 
      });
    }
    
    // Cache-Headers setzen (5 Minuten)
    res.setHeader('Cache-Control', 'public, max-age=300');
    
    // Konfiguration zurückgeben
    res.status(200).json(config);
    
  } catch (error) {
    console.error('Error in /api/env:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
}

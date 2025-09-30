# Deployment Instructions - Supabase Configuration via API

## Summary

This repository has been configured to load Supabase credentials securely via a serverless API endpoint (`/api/env.js`) instead of hardcoding them in the frontend code.

## Files Added

### 1. `/api/env.js`

A Vercel serverless function that securely serves Supabase configuration from environment variables:
- Returns `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Vercel environment variables
- Includes CORS headers for frontend access
- Validates environment variables before serving
- Sets appropriate cache headers (5 minutes)

## Required Changes to `app.js`

### Current Code (Lines 1-11)

Replace the following lines in `app.js`:

```javascript
// Kfz-Schadenaufnahme App - Main JavaScript File
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuration
const SUPABASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'https://your-project-id.supabase.co' 
    : (import.meta.env?.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co');
const SUPABASE_ANON_KEY = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'your-anon-key-here'
    : (import.meta.env?.VITE_SUPABASE_ANON_KEY || 'your-anon-key-here');

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### New Code

Replace with:

```javascript
// Kfz-Schadenaufnahme App - Main JavaScript File
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase client (will be initialized after loading config)
let supabase = null;

// Load Supabase configuration from API endpoint
async function loadSupabaseConfig() {
    try {
        const response = await fetch('/api/env');
        
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.status}`);
        }
        
        const config = await response.json();
        
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            throw new Error('Invalid configuration received');
        }
        
        // Initialize Supabase client with loaded configuration
        supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
        
        console.log('Supabase client initialized successfully');
        return true;
        
    } catch (error) {
        console.error('Error loading Supabase configuration:', error);
        
        // Show error message to user
        const authMessage = document.getElementById('authMessage');
        if (authMessage) {
            authMessage.textContent = 'Fehler beim Laden der Anwendungskonfiguration. Bitte laden Sie die Seite neu.';
            authMessage.className = 'message error';
            authMessage.style.display = 'block';
        }
        
        return false;
    }
}
```

### Update `initializeApp()` Function

Find the `initializeApp()` function (near the end of the file) and update it to load config first:

```javascript
// Initialize Application
async function initializeApp() {
    // Load Supabase configuration first
    const configLoaded = await loadSupabaseConfig();
    
    if (!configLoaded) {
        console.error('Failed to initialize app: Configuration not loaded');
        return;
    }
    
    setupEventListeners();
    
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        userEmail.textContent = currentUser.email;
        showDashboard();
    } else {
        showAuthSection();
    }
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            userEmail.textContent = currentUser.email;
            
            // Create or update profile
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: currentUser.id,
                    email: currentUser.email,
                    full_name: currentUser.user_metadata?.full_name || null
                });
            
            if (error) {
                console.error('Error creating/updating profile:', error);
            }
            
            showDashboard();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showAuthSection();
        }
    });
}
```

## Vercel Environment Variables

Make sure the following environment variables are set in Vercel:

1. Go to your Vercel project dashboard
2. Navigate to Settings > Environment Variables
3. Add:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Testing

1. After making the changes to `app.js`, commit and push to GitHub
2. Vercel will automatically deploy
3. Test the application to ensure:
   - The app loads without errors
   - Login functionality works
   - All Supabase operations (database, storage, auth) work correctly

## Benefits

- ✅ Supabase keys are never exposed in the frontend code
- ✅ Keys are served securely from Vercel environment variables
- ✅ Easy to update keys without modifying code
- ✅ Better security for production deployment

## Next Steps

1. Apply the changes to `app.js` as described above
2. Commit and push to trigger deployment
3. Verify environment variables are set in Vercel
4. Test the deployed application

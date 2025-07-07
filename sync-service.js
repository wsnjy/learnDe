// Sync Service for Cross-Browser Progress Synchronization
import { db, doc, setDoc, getDoc, onSnapshot } from './firebase-config.js';

class SyncService {
    constructor(app) {
        this.app = app;
        this.userId = null;
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.lastSyncTime = null;
        
        this.setupOnlineStatusListener();
        this.generateOrLoadUserId();
    }

    // Generate or load user ID for this device/browser
    generateOrLoadUserId() {
        let userId = localStorage.getItem('deutschlern_user_id');
        if (!userId) {
            // Generate unique user ID
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('deutschlern_user_id', userId);
        }
        this.userId = userId;
        console.log('User ID:', this.userId);
        
        // Set up real-time sync listener
        this.setupRealtimeSync();
    }

    // Setup online/offline status listener
    setupOnlineStatusListener() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Back online - attempting sync...');
            this.syncToCloud();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Gone offline - data will sync when reconnected');
        });
    }

    // Setup real-time sync listener
    setupRealtimeSync() {
        if (!this.isOnline) return;
        
        try {
            const userDocRef = doc(db, 'users', this.userId);
            
            // Listen for real-time updates
            onSnapshot(userDocRef, (docSnapshot) => {
                if (docSnapshot.exists() && !this.syncInProgress) {
                    const cloudData = docSnapshot.data();
                    const cloudTimestamp = cloudData.lastModified;
                    const localTimestamp = this.app.userProgress.lastModified || 0;
                    
                    // Only sync if cloud data is newer
                    if (cloudTimestamp > localTimestamp) {
                        console.log('Newer data found in cloud, syncing...');
                        this.syncFromCloud(cloudData);
                    }
                }
            }, (error) => {
                console.warn('Real-time sync listener error:', error);
            });
        } catch (error) {
            console.warn('Failed to setup real-time sync:', error);
        }
    }

    // Sync local data to cloud
    async syncToCloud() {
        if (!this.isOnline || this.syncInProgress || !this.userId) return;
        
        this.syncInProgress = true;
        
        try {
            const dataToSync = {
                userProgress: {
                    ...this.app.userProgress,
                    learnedWords: Array.from(this.app.userProgress.learnedWords),
                    completedParts: Array.from(this.app.userProgress.completedParts),
                    unlockedLevels: Array.from(this.app.userProgress.unlockedLevels),
                    dailyActivity: Array.from(this.app.userProgress.dailyActivity)
                },
                settings: this.app.settings,
                lastModified: Date.now(),
                syncedAt: new Date().toISOString()
            };

            const userDocRef = doc(db, 'users', this.userId);
            await setDoc(userDocRef, dataToSync, { merge: true });
            
            this.lastSyncTime = Date.now();
            this.app.userProgress.lastModified = this.lastSyncTime;
            this.app.saveUserData(); // Update local storage with sync timestamp
            
            console.log('Data synced to cloud successfully');
            this.showSyncStatus('✅ Synced to cloud');
            
        } catch (error) {
            console.error('Failed to sync to cloud:', error);
            this.showSyncStatus('❌ Sync failed');
        } finally {
            this.syncInProgress = false;
        }
    }

    // Sync data from cloud to local
    async syncFromCloud(cloudData = null) {
        if (!this.isOnline || this.syncInProgress || !this.userId) return;
        
        this.syncInProgress = true;
        
        try {
            let data = cloudData;
            
            if (!data) {
                const userDocRef = doc(db, 'users', this.userId);
                const docSnapshot = await getDoc(userDocRef);
                
                if (!docSnapshot.exists()) {
                    console.log('No cloud data found, uploading current progress...');
                    await this.syncToCloud();
                    return;
                }
                
                data = docSnapshot.data();
            }

            // Merge cloud data with local data
            const cloudProgress = data.userProgress;
            if (cloudProgress) {
                // Convert arrays back to Sets/Maps
                this.app.userProgress = {
                    ...this.app.userProgress,
                    ...cloudProgress,
                    learnedWords: new Set(cloudProgress.learnedWords || []),
                    completedParts: new Set(cloudProgress.completedParts || []),
                    unlockedLevels: new Set(cloudProgress.unlockedLevels || ['A1.1']),
                    dailyActivity: new Map(cloudProgress.dailyActivity || []),
                    lastModified: data.lastModified
                };
            }

            if (data.settings) {
                this.app.settings = { ...this.app.settings, ...data.settings };
            }

            // Save merged data locally
            this.app.saveUserData();
            
            // Update UI
            this.app.updateLevelLocks();
            this.app.updateUI();
            this.app.renderDashboard();
            this.app.generateHeatmap();
            
            console.log('Data synced from cloud successfully');
            this.showSyncStatus('⬇️ Synced from cloud');
            
        } catch (error) {
            console.error('Failed to sync from cloud:', error);
            this.showSyncStatus('❌ Sync failed');
        } finally {
            this.syncInProgress = false;
        }
    }

    // Show sync status to user
    showSyncStatus(message) {
        // Create or update sync status indicator
        let statusElement = document.getElementById('syncStatus');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'syncStatus';
            statusElement.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--card-bg);
                color: var(--text-primary);
                padding: 8px 12px;
                border-radius: 8px;
                box-shadow: var(--card-shadow);
                border: 1px solid var(--border-color);
                font-size: 0.875rem;
                z-index: 500;
                transition: opacity 0.3s ease;
                pointer-events: none;
            `;
            document.body.appendChild(statusElement);
        }
        
        statusElement.textContent = message;
        statusElement.style.opacity = '1';
        
        // Hide after 3 seconds
        setTimeout(() => {
            statusElement.style.opacity = '0';
            // Remove from DOM after transition completes
            setTimeout(() => {
                if (statusElement && statusElement.parentNode) {
                    statusElement.parentNode.removeChild(statusElement);
                }
            }, 300);
        }, 3000);
    }

    // Manual sync trigger
    async manualSync() {
        this.showSyncStatus('🔄 Syncing...');
        await this.syncFromCloud();
        await this.syncToCloud();
    }

    // Get user ID for sharing
    getUserId() {
        return this.userId;
    }

    // Set user ID (for device linking)
    async setUserId(newUserId) {
        if (newUserId && newUserId !== this.userId) {
            this.userId = newUserId;
            localStorage.setItem('deutschlern_user_id', newUserId);
            
            // Sync data for new user ID
            await this.syncFromCloud();
            this.setupRealtimeSync();
        }
    }
}

export default SyncService;
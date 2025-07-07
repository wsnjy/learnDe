// Sync Service for Cross-Browser Progress Synchronization with Firebase Auth
import { 
    db, 
    auth,
    doc, 
    setDoc, 
    getDoc, 
    onSnapshot,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    onAuthStateChanged,
    signOut
} from './firebase-config.js';

class SyncService {
    constructor(app) {
        this.app = app;
        this.userId = null;
        this.userEmail = null;
        this.currentUser = null;
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.lastSyncTime = null;
        this.realtimeListener = null;
        
        this.setupOnlineStatusListener();
        this.setupAuthStateListener();
        this.setupAuthModal();
    }

    // Setup Firebase Auth state listener
    setupAuthStateListener() {
        onAuthStateChanged(auth, (user) => {
            if (user && user.emailVerified) {
                // User is signed in and email is verified
                this.currentUser = user;
                this.userId = user.uid;
                this.userEmail = user.email;
                console.log('User authenticated:', this.userEmail);
                
                this.hideAuthModal();
                this.updateUserDisplay();
                this.setupRealtimeSync();
                
                // Initialize app if not already done
                if (this.app.init && !this.app.initialized) {
                    this.app.init();
                }
                
            } else if (user && !user.emailVerified) {
                // User exists but email not verified
                this.showVerificationNotice();
                
            } else {
                // User is signed out
                this.currentUser = null;
                this.userId = null;
                this.userEmail = null;
                this.showAuthModal();
                this.clearRealtimeSync();
            }
        });
    }

    // Setup auth modal and form handlers
    setupAuthModal() {
        // Show auth modal initially
        this.showAuthModal();
        
        // Setup form switching
        const showRegisterLink = document.getElementById('showRegister');
        const showLoginLink = document.getElementById('showLogin');
        
        showRegisterLink?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToRegister();
        });
        
        showLoginLink?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToLogin();
        });
        
        // Setup form submissions
        this.setupLoginForm();
        this.setupRegisterForm();
        this.setupVerificationHandlers();
    }

    // Show auth modal
    showAuthModal() {
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.style.display = 'flex';
        }
    }

    // Hide auth modal
    hideAuthModal() {
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.style.display = 'none';
        }
    }

    // Switch to register form
    switchToRegister() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const authSubtitle = document.getElementById('authSubtitle');
        
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
        if (authSubtitle) authSubtitle.textContent = 'Daftar akun baru untuk mulai belajar';
        
        this.clearAuthStatus();
    }

    // Switch to login form
    switchToLogin() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const verificationNotice = document.getElementById('verificationNotice');
        const authSubtitle = document.getElementById('authSubtitle');
        
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
        if (verificationNotice) verificationNotice.style.display = 'none';
        if (authSubtitle) authSubtitle.textContent = 'Masuk ke akun Anda untuk melanjutkan belajar';
        
        this.clearAuthStatus();
    }

    // Setup login form handlers
    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        
        if (loginForm) {
            loginForm.onsubmit = async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('loginEmail').value.trim();
                const password = document.getElementById('loginPassword').value;
                
                if (!email || !password) {
                    this.showAuthStatus('Please fill in all fields', 'error');
                    return;
                }

                this.showAuthStatus('Signing in...', 'loading');
                this.setFormDisabled(true);
                
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    
                    if (!userCredential.user.emailVerified) {
                        this.showAuthStatus('Please verify your email first', 'error');
                        await signOut(auth);
                        return;
                    }
                    
                    this.showAuthStatus('Login successful!', 'success');
                    
                } catch (error) {
                    console.error('Login error:', error);
                    let message = 'Login failed';
                    
                    switch (error.code) {
                        case 'auth/user-not-found':
                            message = 'No account found with this email';
                            break;
                        case 'auth/wrong-password':
                            message = 'Incorrect password';
                            break;
                        case 'auth/invalid-email':
                            message = 'Invalid email address';
                            break;
                        case 'auth/too-many-requests':
                            message = 'Too many failed attempts. Please try again later';
                            break;
                        default:
                            message = error.message;
                    }
                    
                    this.showAuthStatus(message, 'error');
                } finally {
                    this.setFormDisabled(false);
                }
            };
        }
    }

    // Setup register form handlers
    setupRegisterForm() {
        const registerForm = document.getElementById('registerForm');
        
        if (registerForm) {
            registerForm.onsubmit = async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('registerEmail').value.trim();
                const password = document.getElementById('registerPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                
                if (!email || !password || !confirmPassword) {
                    this.showAuthStatus('Please fill in all fields', 'error');
                    return;
                }
                
                if (password !== confirmPassword) {
                    this.showAuthStatus('Passwords do not match', 'error');
                    return;
                }
                
                if (password.length < 6) {
                    this.showAuthStatus('Password must be at least 6 characters', 'error');
                    return;
                }

                this.showAuthStatus('Creating account...', 'loading');
                this.setFormDisabled(true);
                
                try {
                    console.log('Attempting to create user with Firebase Auth...');
                    console.log('Auth object:', auth);
                    console.log('Email:', email);
                    
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    console.log('User created successfully:', userCredential.user.uid);
                    
                    // Send verification email
                    console.log('Sending verification email...');
                    await sendEmailVerification(userCredential.user);
                    console.log('Verification email sent');
                    
                    this.showAuthStatus('Account created! Please check your email for verification link.', 'success');
                    this.showVerificationNotice();
                    
                } catch (error) {
                    console.error('Registration error details:', {
                        code: error.code,
                        message: error.message,
                        stack: error.stack
                    });
                    
                    let message = 'Registration failed';
                    
                    switch (error.code) {
                        case 'auth/configuration-not-found':
                            message = 'Firebase Authentication not configured. Please check Firebase Console.';
                            break;
                        case 'auth/email-already-in-use':
                            message = 'An account with this email already exists';
                            break;
                        case 'auth/invalid-email':
                            message = 'Invalid email address';
                            break;
                        case 'auth/weak-password':
                            message = 'Password is too weak';
                            break;
                        case 'auth/operation-not-allowed':
                            message = 'Email/password authentication is not enabled in Firebase Console';
                            break;
                        default:
                            message = `${error.code}: ${error.message}`;
                    }
                    
                    this.showAuthStatus(message, 'error');
                } finally {
                    this.setFormDisabled(false);
                }
            };
        }
    }

    // Setup verification notice handlers
    setupVerificationHandlers() {
        const resendVerificationBtn = document.getElementById('resendVerification');
        const backToLoginBtn = document.getElementById('backToLogin');
        
        resendVerificationBtn?.addEventListener('click', async () => {
            if (auth.currentUser) {
                try {
                    await sendEmailVerification(auth.currentUser);
                    this.showAuthStatus('Verification email sent!', 'success');
                } catch (error) {
                    this.showAuthStatus('Failed to send verification email', 'error');
                }
            }
        });
        
        backToLoginBtn?.addEventListener('click', () => {
            this.switchToLogin();
        });
    }

    // Show verification notice
    showVerificationNotice() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const verificationNotice = document.getElementById('verificationNotice');
        
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'none';
        if (verificationNotice) verificationNotice.style.display = 'block';
        
        this.clearAuthStatus();
    }

    // Helper function to disable/enable forms
    setFormDisabled(disabled) {
        const inputs = document.querySelectorAll('#authModal input, #authModal button');
        inputs.forEach(input => {
            input.disabled = disabled;
        });
    }

    // Show auth status message
    showAuthStatus(message, type) {
        const authStatus = document.getElementById('authStatus');
        if (authStatus) {
            authStatus.textContent = message;
            authStatus.className = `auth-status ${type}`;
            
            if (type === 'success') {
                setTimeout(() => {
                    this.clearAuthStatus();
                }, 3000);
            }
        }
    }

    // Clear auth status
    clearAuthStatus() {
        const authStatus = document.getElementById('authStatus');
        if (authStatus) {
            authStatus.textContent = '';
            authStatus.className = 'auth-status';
        }
    }

    // Update user display in header and settings
    updateUserDisplay() {
        const userEmailDisplay = document.getElementById('userEmailDisplay');
        const accountEmailElement = document.getElementById('accountEmail');
        
        if (userEmailDisplay && this.userEmail) {
            userEmailDisplay.textContent = this.userEmail;
        }
        
        if (accountEmailElement && this.userEmail) {
            accountEmailElement.textContent = `Email: ${this.userEmail}`;
        }
    }

    // Logout function
    async logout() {
        try {
            await signOut(auth);
            // onAuthStateChanged will handle the rest
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    // Clear real-time sync
    clearRealtimeSync() {
        if (this.realtimeListener) {
            this.realtimeListener();
            this.realtimeListener = null;
        }
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
        if (!this.isOnline || !this.userId) return;
        
        // Clear existing listener
        this.clearRealtimeSync();
        
        try {
            const userDocRef = doc(db, 'users', this.userId);
            
            // Listen for real-time updates
            this.realtimeListener = onSnapshot(userDocRef, (docSnapshot) => {
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
                    dailyActivity: Object.fromEntries(this.app.userProgress.dailyActivity)
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
                    dailyActivity: new Map(Object.entries(cloudProgress.dailyActivity || {})),
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
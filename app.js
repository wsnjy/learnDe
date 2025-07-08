class GermanLearningApp {
    constructor() {
        this.vocabulary = [];
        this.levels = [];
        this.currentCard = null;
        this.isFlipped = false;
        this.sessionWords = [];
        this.currentSessionIndex = 0;
        this.currentPartId = null;
        this.speechSynthesis = null;
        this.syncService = null;
        this.userProgress = {
            currentLevel: 'A1',
            learnedWords: new Set(),
            completedParts: new Set(),
            unlockedLevels: new Set(['A1.1']),
            totalReviews: 0,
            correctAnswers: 0,
            learningStreak: 0,
            dailyActivity: new Map(),
            lastStudyDate: null,
            lastModified: Date.now()
        };
        this.settings = {
            learningDirection: 'de-id',
            voiceEnabled: true,
            cardsPerSession: 20,
            currentLevel: 'A1',
            theme: 'system',
            currentView: 'dashboard'
        };
        this.speechSynthesis = window.speechSynthesis;
        
        // Session tracking
        this.currentSession = {
            wordsLearned: 0,
            correctAnswers: 0,
            totalAnswers: 0,
            startTime: null,
            targetWords: 20, // Default from settings
            difficultyBreakdown: {
                veryHard: 0,  // difficulty 1
                hard: 0,      // difficulty 2
                medium: 0,    // difficulty 3
                easy: 0,      // difficulty 4
                veryEasy: 0   // difficulty 5
            }
        };
        
        // Initialize FSRS algorithm
        this.initializeFSRS();
        
        this.initializeVoices();
        this.initializeSyncService();
        // App initialization moved to after login
    }
    // Initialize FSRS algorithm  
    initializeFSRS() {
        // Temporarily disable FSRS to fix login issues
        console.log('FSRS temporarily disabled - using simple spaced repetition algorithm');
        this.fsrsEnabled = false;
        this.fsrs = null;
        this.FSRSClass = null;
        this.createEmptyCardFn = null;
        this.generatorParametersFn = null;
        this.RatingEnum = null;
    }
    
    // Initialize FSRS cards for existing vocabulary
    initializeFSRSCards() {
        if (!this.fsrsEnabled || !this.createEmptyCardFn) return;
        
        this.vocabulary.forEach(level => {
            level.parts.forEach(part => {
                part.cards.forEach(card => {
                    if (!card.fsrsCard) {
                        card.fsrsCard = this.createEmptyCardFn();
                    }
                });
            });
        });
        console.log('FSRS cards initialized for existing vocabulary');
    }

    async init() {
        try {
            this.initialized = true;
            await this.loadAllVocabularyParts();
            this.loadUserData();
            
            // Initialize FSRS after vocabulary is loaded
            this.initializeFSRS();
            this.initializeFSRSCards();
            
            this.updateLevelLocks(); // Move this before initializeTheme
            this.initializeTheme();
            this.setupEventListeners();
            this.updateUI();
            this.generateHeatmap();
            this.renderDashboard();
            this.switchView(this.settings.currentView); // Initialize correct view
            // Initialize sync after everything is loaded
            if (this.syncService) {
                await this.syncService.syncFromCloud();
            }
        }
        catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize the application. Please refresh the page.');
        }
    }
    async loadAllVocabularyParts() {
        this.showLoading(true);
        try {
            const fileStructure = [
                { level: 'A1', subLevel: '1', parts: 8 },
                { level: 'A1', subLevel: '2', parts: 6 },
                { level: 'A2', subLevel: '1', parts: 10 },
                { level: 'A2', subLevel: '2', parts: 6 },
                { level: 'B1', subLevel: '1', parts: 7 },
                { level: 'B1', subLevel: '2', parts: 5 }
            ];
            this.levels = [];
            for (const levelInfo of fileStructure) {
                const levelId = `${levelInfo.level}.${levelInfo.subLevel}`;
                const level = {
                    id: levelId,
                    name: `${levelInfo.level}.${levelInfo.subLevel}`,
                    parts: [],
                    isUnlocked: false,
                    progress: 0
                };
                for (let partNum = 1; partNum <= levelInfo.parts; partNum++) {
                    const filename = `german-${levelInfo.level.toLowerCase()}.${levelInfo.subLevel}-part${partNum}.json`;
                    const partId = `${levelId}-part${partNum}`;
                    try {
                        const response = await fetch(`./dataJson/${filename}`);
                        if (response.ok) {
                            const partData = await response.json();
                            const vocabularyPart = {
                                id: partId,
                                name: partData.name || `Part ${partNum}`,
                                description: partData.description || '',
                                level: levelInfo.level,
                                subLevel: levelInfo.subLevel,
                                partNumber: partNum,
                                cards: partData.cards.map((card, index) => ({
                                    id: `${partId}_${index}`,
                                    german: card.german,
                                    indonesian: card.indonesian,
                                    english: card.english || '',
                                    level: levelInfo.level,
                                    type: card.type || 'noun',
                                    difficulty: card.difficulty || 3,
                                    lastReviewed: null,
                                    nextReview: null,
                                    reviewCount: 0,
                                    correctCount: 0,
                                    incorrectCount: 0,
                                    partId: partId,
                                    learned: false,
                                    // FSRS specific fields
                                    fsrsCard: null, // Will be initialized when FSRS loads
                                    fsrsState: {
                                        difficulty: 5.0,    // Initial difficulty (D)
                                        stability: 2.0,     // Initial stability (S)
                                        retrievability: 1.0 // Initial retrievability (R)
                                    }
                                })),
                                isUnlocked: false,
                                isCompleted: false,
                                progress: 0
                            };
                            level.parts.push(vocabularyPart);
                            this.vocabulary.push(...vocabularyPart.cards);
                        }
                    }
                    catch (error) {
                        console.warn(`Failed to load ${filename}:`, error);
                    }
                }
                this.levels.push(level);
            }
        }
        catch (error) {
            console.error('Failed to load vocabulary parts:', error);
            this.vocabulary = this.generateSampleVocabulary();
        }
        finally {
            this.showLoading(false);
        }
    }
    generateSampleVocabulary() {
        const sampleWords = [
            { german: 'Hallo', indonesian: 'Halo', level: 'A1', type: 'phrase' },
            { german: 'Danke', indonesian: 'Terima kasih', level: 'A1', type: 'phrase' },
            { german: 'das Haus', indonesian: 'Rumah', level: 'A1', type: 'noun' },
            { german: 'das Wasser', indonesian: 'Air', level: 'A1', type: 'noun' },
            { german: 'essen', indonesian: 'makan', level: 'A1', type: 'verb' },
            { german: 'schön', indonesian: 'cantik/indah', level: 'A1', type: 'adjective' },
            { german: 'die Familie', indonesian: 'Keluarga', level: 'A1', type: 'noun' },
            { german: 'der Freund', indonesian: 'Teman', level: 'A1', type: 'noun' },
            { german: 'arbeiten', indonesian: 'bekerja', level: 'A2', type: 'verb' },
            { german: 'verstehen', indonesian: 'memahami', level: 'A2', type: 'verb' },
            { german: 'die Erfahrung', indonesian: 'Pengalaman', level: 'B1', type: 'noun' },
            { german: 'entwickeln', indonesian: 'mengembangkan', level: 'B1', type: 'verb' }
        ];
        return sampleWords.map((word, index) => ({
            id: `word_${index}`,
            german: word.german,
            indonesian: word.indonesian,
            level: word.level,
            type: word.type,
            difficulty: 3,
            lastReviewed: null,
            nextReview: null,
            reviewCount: 0,
            correctCount: 0,
            incorrectCount: 0,
            partId: 'sample-part',
            learned: false
        }));
    }
    loadUserData() {
        const savedProgress = localStorage.getItem('deutschlern_progress');
        const savedSettings = localStorage.getItem('deutschlern_settings');
        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            console.log('Loading saved progress:', progress);
            console.log('Saved dailyActivity:', progress.dailyActivity);
            console.log('Saved learningStreak:', progress.learningStreak);
            console.log('Saved lastStudyDate:', progress.lastStudyDate);
            
            this.userProgress = {
                ...this.userProgress,
                ...progress,
                learnedWords: new Set(progress.learnedWords || []),
                completedParts: new Set(progress.completedParts || []),
                unlockedLevels: new Set(progress.unlockedLevels || ['A1.1']),
                dailyActivity: new Map(progress.dailyActivity || [])
            };
            
            console.log('Loaded userProgress:', this.userProgress);
        } else {
            console.log('No saved progress found');
        }
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
    }
    saveUserData() {
        // Update last modified timestamp
        this.userProgress.lastModified = Date.now();
        const progressToSave = {
            ...this.userProgress,
            learnedWords: Array.from(this.userProgress.learnedWords),
            completedParts: Array.from(this.userProgress.completedParts),
            unlockedLevels: Array.from(this.userProgress.unlockedLevels),
            dailyActivity: Array.from(this.userProgress.dailyActivity)
        };
        
        console.log('Saving user data...');
        console.log('dailyActivity to save:', progressToSave.dailyActivity);
        console.log('learningStreak to save:', progressToSave.learningStreak);
        console.log('lastStudyDate to save:', progressToSave.lastStudyDate);
        
        localStorage.setItem('deutschlern_progress', JSON.stringify(progressToSave));
        localStorage.setItem('deutschlern_settings', JSON.stringify(this.settings));
        
        console.log('Data saved to localStorage');
        
        // Trigger sync to cloud if available
        if (this.syncService) {
            this.syncService.syncToCloud();
        }
    }
    initializeTheme() {
        const theme = this.settings.theme;
        this.applyTheme(theme);
    }
    applyTheme(theme) {
        const root = document.documentElement;
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        }
        else {
            root.setAttribute('data-theme', theme);
        }
        this.updateThemeButton();
    }
    updateThemeButton() {
        const themeBtn = document.getElementById('themeToggle');
        if (!themeBtn)
            return;
        const currentTheme = document.documentElement.getAttribute('data-theme');
        themeBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    }
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.settings.theme = newTheme;
        this.applyTheme(newTheme);
        this.saveUserData();
    }
    setupEventListeners() {
        // Start button
        const startBtn = document.getElementById('startBtn');
        startBtn?.addEventListener('click', () => this.startLearning());
        // Card click to flip
        const flashcard = document.getElementById('flashcard');
        flashcard?.addEventListener('click', () => this.flipCard());
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        themeToggle?.addEventListener('click', () => this.toggleTheme());
        // Difficulty buttons
        const difficultyBtns = document.querySelectorAll('.diff-btn');
        difficultyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target;
                const difficulty = parseInt(target.dataset.difficulty || '3');
                this.handleDifficultyResponse(difficulty);
            });
        });
        // Voice buttons
        const voiceBtnFront = document.getElementById('voiceBtnFront');
        const voiceBtnBack = document.getElementById('voiceBtnBack');
        voiceBtnFront?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card flip
            this.playPronunciation();
        });
        voiceBtnBack?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card flip
            this.playPronunciation();
        });
        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        settingsBtn?.addEventListener('click', () => this.toggleSettings());
        // Panel backdrop click to close
        const panelBackdrop = document.getElementById('panelBackdrop');
        panelBackdrop?.addEventListener('click', () => this.hideAllPanels());
        // Settings controls
        const learningDirection = document.getElementById('learningDirection');
        learningDirection?.addEventListener('change', (e) => {
            this.settings.learningDirection = e.target.value;
            this.saveUserData();
            // Update display to show voice button on correct side
            if (this.currentCard) {
                this.displayCard();
            }
        });
        const levelSelect = document.getElementById('levelSelect');
        levelSelect?.addEventListener('change', (e) => {
            this.settings.currentLevel = e.target.value;
            this.saveUserData();
            this.updateUI();
        });
        const voiceEnabled = document.getElementById('voiceEnabled');
        voiceEnabled?.addEventListener('change', (e) => {
            this.settings.voiceEnabled = e.target.checked;
            this.saveUserData();
            // Update voice button visibility
            if (this.currentCard) {
                this.displayCard();
            }
        });
        const cardsPerSession = document.getElementById('cardsPerSession');
        cardsPerSession?.addEventListener('change', (e) => {
            this.settings.cardsPerSession = parseInt(e.target.value);
            this.saveUserData();
        });
        // Sync controls
        const manualSyncBtn = document.getElementById('manualSyncBtn');
        manualSyncBtn?.addEventListener('click', () => {
            if (this.syncService) {
                this.syncService.manualSync();
            }
        });
        
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        logoutBtn?.addEventListener('click', () => {
            if (this.syncService && confirm('Are you sure you want to logout?')) {
                this.syncService.logout();
            }
        });
        
        // Update account email display when sync service is ready
        if (this.syncService) {
            const accountEmailElement = document.getElementById('accountEmail');
            if (accountEmailElement && this.syncService.userEmail) {
                accountEmailElement.textContent = `Email: ${this.syncService.userEmail}`;
            }
        }
        
        // Session completion modal handlers
        const continueSessionBtn = document.getElementById('continueSessionBtn');
        const finishSessionBtn = document.getElementById('finishSessionBtn');
        const sessionModalCloseBtn = document.getElementById('sessionModalCloseBtn');
        const sessionCompleteModal = document.getElementById('sessionCompleteModal');
        
        continueSessionBtn?.addEventListener('click', () => {
            this.hideSessionCompleteModal();
            this.extendSession();
        });
        
        finishSessionBtn?.addEventListener('click', () => {
            this.hideSessionCompleteModal();
            this.endSession();
        });
        
        // Close button functionality
        sessionModalCloseBtn?.addEventListener('click', () => {
            this.hideSessionCompleteModal();
            this.endSession(); // End session when user closes modal
        });
        
        // Click outside modal to close
        sessionCompleteModal?.addEventListener('click', (e) => {
            if (e.target === sessionCompleteModal) {
                this.hideSessionCompleteModal();
                this.endSession(); // End session when clicking outside
            }
        });
        
        // Global keyboard event handler
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when in practice view and have a current card
            const practiceView = document.getElementById('practiceView');
            const isInPracticeMode = practiceView && practiceView.style.display !== 'none';
            
            if (e.code === 'Space' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
                if (isInPracticeMode && this.currentCard) {
                    e.preventDefault();
                    this.flipCard();
                }
            }
            else if (e.code === 'Enter') {
                if (isInPracticeMode && this.currentCard) {
                    e.preventDefault();
                    this.playPronunciation();
                }
            }
            else if (e.code === 'Digit1') {
                if (isInPracticeMode && this.currentCard) {
                    e.preventDefault();
                    this.handleDifficultyResponse(1);
                }
            }
            else if (e.code === 'Digit2') {
                if (isInPracticeMode && this.currentCard) {
                    e.preventDefault();
                    this.handleDifficultyResponse(2);
                }
            }
            else if (e.code === 'Digit3') {
                if (isInPracticeMode && this.currentCard) {
                    e.preventDefault();
                    this.handleDifficultyResponse(3);
                }
            }
            else if (e.code === 'Digit4') {
                if (isInPracticeMode && this.currentCard) {
                    e.preventDefault();
                    this.handleDifficultyResponse(4);
                }
            }
            else if (e.code === 'Digit5') {
                if (isInPracticeMode && this.currentCard) {
                    e.preventDefault();
                    this.handleDifficultyResponse(5);
                }
            }
            else if (e.key === 'Escape') {
                // Session complete modal
                if (sessionCompleteModal?.style.display === 'flex') {
                    this.hideSessionCompleteModal();
                    this.endSession(); // End session when pressing Escape
                }
                // Level statistics modal
                const levelStatsModal = document.getElementById('levelStatsModal');
                if (levelStatsModal?.style.display === 'flex') {
                    this.hideLevelStatisticsModal();
                }
                // Hide all panels
                this.hideAllPanels();
            }
        });
        
        // Level statistics modal handlers
        const levelStatsCloseBtn = document.getElementById('levelStatsCloseBtn');
        const levelStatsModal = document.getElementById('levelStatsModal');
        const reviewAllLevelBtn = document.getElementById('reviewAllLevelBtn');
        const reviewHardWordsBtn = document.getElementById('reviewHardWordsBtn');
        
        // Close button functionality
        levelStatsCloseBtn?.addEventListener('click', () => {
            this.hideLevelStatisticsModal();
        });
        
        // Click outside modal to close
        levelStatsModal?.addEventListener('click', (e) => {
            if (e.target === levelStatsModal) {
                this.hideLevelStatisticsModal();
            }
        });
        
        // Review all words button
        reviewAllLevelBtn?.addEventListener('click', () => {
            this.reviewAllLevelWords();
        });
        
        // Review hard words button
        reviewHardWordsBtn?.addEventListener('click', () => {
            this.reviewHardWords();
        });
        
        // Keyboard shortcuts
        // Navigation tabs
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const target = e.target;
                const view = target.dataset.view;
                this.switchView(view);
            });
        });
    }
    switchView(view) {
        this.settings.currentView = view;
        this.saveUserData();
        // Update tab active state
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.getAttribute('data-view') === view) {
                tab.classList.add('active');
            }
        });
        // Show/hide views
        const dashboardView = document.getElementById('dashboardView');
        const practiceView = document.getElementById('practiceView');
        const statisticsView = document.getElementById('statisticsView');
        const startBtn = document.getElementById('startBtn');
        // Hide all views first
        if (dashboardView)
            dashboardView.style.display = 'none';
        if (practiceView)
            practiceView.style.display = 'none';
        if (statisticsView)
            statisticsView.style.display = 'none';
        // Show selected view
        if (view === 'dashboard') {
            if (dashboardView)
                dashboardView.style.display = 'block';
            this.renderDashboard();
        }
        else if (view === 'practice') {
            if (practiceView)
                practiceView.style.display = 'block';
            // Show start button if no current part is selected
            if (!this.currentPartId && startBtn) {
                startBtn.style.display = 'block';
                startBtn.textContent = 'Start Random Practice';
            }
        }
        else if (view === 'statistics') {
            if (statisticsView)
                statisticsView.style.display = 'block';
            this.renderStatistics();
        }
    }
    renderDashboard() {
        const container = document.getElementById('levelsContainer');
        if (!container)
            return;
        container.innerHTML = '';
        this.levels.forEach(level => {
            const levelElement = this.createLevelElement(level);
            container.appendChild(levelElement);
        });
        this.updateDashboardStats();
    }
    createLevelElement(level) {
        const levelDiv = document.createElement('div');
        levelDiv.className = `level-section ${level.isUnlocked ? '' : 'locked'}`;
        levelDiv.innerHTML = `
            <div class="level-header">
                <div class="level-title">
                    <span class="level-lock">${level.isUnlocked ? '🔓' : '🔒'}</span>
                    <span>${level.name}</span>
                </div>
                <div class="level-progress">
                    <div class="level-progress-text">${level.progress.toFixed(0)}% completed</div>
                    <div class="level-progress-bar">
                        <div class="level-progress-fill" style="width: ${level.progress}%"></div>
                    </div>
                </div>
            </div>
            <div class="parts-grid">
                ${level.parts.map(part => this.createPartCardHTML(part)).join('')}
            </div>
        `;
        // Add click listeners to part cards after DOM is updated
        setTimeout(() => {
            const partCards = levelDiv.querySelectorAll('.part-card');
            partCards.forEach((card, index) => {
                const part = level.parts[index];
                console.log(`Setting up click for part ${index}: ${part.name}, unlocked: ${part.isUnlocked}`);
                if (part.isUnlocked) {
                    card.style.cursor = 'pointer';
                    card.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(`Clicked on part: ${part.name}`);
                        this.startPart(part);
                    });
                }
                else {
                    card.style.cursor = 'not-allowed';
                }
            });
        }, 0);
        return levelDiv;
    }
    createPartCardHTML(part) {
        const statusIcon = part.isCompleted ? '✅' : part.isUnlocked ? '📖' : '🔒';
        const cardClass = part.isCompleted ? 'completed' : part.isUnlocked ? '' : 'locked';
        return `
            <div class="part-card ${cardClass}" data-part-id="${part.id}">
                <div class="part-header">
                    <div class="part-title">${part.name}</div>
                    <div class="part-status">${statusIcon}</div>
                </div>
                <div class="part-info">${part.cards.length} cards</div>
                <div class="part-progress">
                    <span>${part.progress.toFixed(0)}% learned</span>
                    <div class="part-progress-bar">
                        <div class="part-progress-fill" style="width: ${part.progress}%"></div>
                    </div>
                </div>
            </div>
        `;
    }
    startPart(part) {
        this.currentPartId = part.id;
        this.sessionWords = part.cards.filter(card => !card.learned);
        if (this.sessionWords.length === 0) {
            this.showError('All cards in this part have been learned!');
            return;
        }
        
        // Initialize session tracking
        this.currentSession = {
            wordsLearned: 0,
            correctAnswers: 0,
            totalAnswers: 0,
            startTime: Date.now(),
            targetWords: Math.min(this.settings.cardsPerSession, this.sessionWords.length),
            difficultyBreakdown: {
                veryHard: 0,  // difficulty 1
                hard: 0,      // difficulty 2
                medium: 0,    // difficulty 3
                easy: 0,      // difficulty 4
                veryEasy: 0   // difficulty 5
            }
        };
        
        this.currentSessionIndex = 0;
        this.currentCard = this.sessionWords[0];
        this.isFlipped = false;
        this.switchView('practice');
        this.displayCard();
        this.showLearningControls();
    }
    
    // Show detailed level statistics modal
    showLevelStatistics(level) {
        const modal = document.getElementById('levelStatsModal');
        if (!modal) return;
        
        // Calculate level statistics
        const stats = this.calculateLevelStatistics(level);
        
        // Update modal content
        this.updateLevelStatisticsModal(level, stats);
        
        // Store current level for use in other functions
        this.currentStatsLevel = level;
        
        // Prevent background scrolling
        document.body.style.overflow = 'hidden';
        
        // Show modal
        modal.style.display = 'flex';
        
        // Focus management
        const closeButton = document.getElementById('levelStatsCloseBtn');
        if (closeButton) {
            setTimeout(() => closeButton.focus(), 100);
        }
    }
    
    // Calculate comprehensive statistics for a level
    calculateLevelStatistics(level) {
        const stats = {
            totalWords: 0,
            learnedWords: 0,
            difficultyBreakdown: {
                veryHard: [], // difficulty 1
                hard: [],     // difficulty 2  
                medium: [],   // difficulty 3
                easy: [],     // difficulty 4
                veryEasy: []  // difficulty 5
            },
            averageDifficulty: 0,
            progress: 0
        };
        
        let totalDifficulty = 0;
        let difficultyCount = 0;
        
        // Process all cards in the level
        level.parts.forEach(part => {
            part.cards.forEach(card => {
                stats.totalWords++;
                
                if (card.learned) {
                    stats.learnedWords++;
                    
                    // Get the last difficulty rating from user (we'll use reviewCount as proxy)
                    // In a real implementation, you'd store the last user rating
                    let lastDifficulty = 3; // default medium
                    
                    // Calculate difficulty based on correctCount vs incorrectCount ratio
                    const totalReviews = card.correctCount + card.incorrectCount;
                    if (totalReviews > 0) {
                        const accuracy = card.correctCount / totalReviews;
                        if (accuracy >= 0.9) lastDifficulty = 5; // Very Easy
                        else if (accuracy >= 0.7) lastDifficulty = 4; // Easy
                        else if (accuracy >= 0.5) lastDifficulty = 3; // Medium
                        else if (accuracy >= 0.3) lastDifficulty = 2; // Hard
                        else lastDifficulty = 1; // Very Hard
                    }
                    
                    totalDifficulty += lastDifficulty;
                    difficultyCount++;
                    
                    // Add to appropriate difficulty bucket
                    switch (lastDifficulty) {
                        case 1:
                            stats.difficultyBreakdown.veryHard.push(card);
                            break;
                        case 2:
                            stats.difficultyBreakdown.hard.push(card);
                            break;
                        case 3:
                            stats.difficultyBreakdown.medium.push(card);
                            break;
                        case 4:
                            stats.difficultyBreakdown.easy.push(card);
                            break;
                        case 5:
                            stats.difficultyBreakdown.veryEasy.push(card);
                            break;
                    }
                }
            });
        });
        
        // Calculate derived statistics
        stats.progress = stats.totalWords > 0 ? Math.round((stats.learnedWords / stats.totalWords) * 100) : 0;
        stats.averageDifficulty = difficultyCount > 0 ? (totalDifficulty / difficultyCount) : 0;
        
        return stats;
    }
    
    // Update level statistics modal content
    updateLevelStatisticsModal(level, stats) {
        // Update header
        document.getElementById('levelStatsTitle').textContent = `${level.name} Statistics`;
        document.getElementById('levelStatsSubtitle').textContent = `Difficulty breakdown of learned words`;
        
        // Update summary cards
        document.getElementById('levelTotalWords').textContent = stats.totalWords;
        document.getElementById('levelLearnedWords').textContent = stats.learnedWords;
        document.getElementById('levelProgress').textContent = `${stats.progress}%`;
        document.getElementById('levelAvgDifficulty').textContent = stats.averageDifficulty.toFixed(1);
        
        // Generate difficulty chart
        this.generateDifficultyChart(stats.difficultyBreakdown);
    }
    
    // Generate interactive bar chart for difficulty breakdown
    generateDifficultyChart(difficultyBreakdown) {
        const chartContainer = document.getElementById('difficultyChart');
        if (!chartContainer) return;
        
        chartContainer.innerHTML = '';
        
        const difficultyLevels = [
            { key: 'veryHard', label: '😵 Very Hard', emoji: '😵', className: 'difficulty-very-hard' },
            { key: 'hard', label: '😰 Hard', emoji: '😰', className: 'difficulty-hard' },
            { key: 'medium', label: '🤔 Medium', emoji: '🤔', className: 'difficulty-medium' },
            { key: 'easy', label: '😊 Easy', emoji: '😊', className: 'difficulty-easy' },
            { key: 'veryEasy', label: '😍 Very Easy', emoji: '😍', className: 'difficulty-very-easy' }
        ];
        
        // Find max count for scaling
        const maxCount = Math.max(...difficultyLevels.map(level => difficultyBreakdown[level.key].length));
        const minBarHeight = 4; // minimum bar height in pixels
        
        difficultyLevels.forEach(diffLevel => {
            const count = difficultyBreakdown[diffLevel.key].length;
            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const barHeight = Math.max(percentage, minBarHeight);
            
            const barElement = document.createElement('div');
            barElement.className = 'chart-bar';
            barElement.dataset.difficulty = diffLevel.key;
            
            barElement.innerHTML = `
                <div class="chart-bar-container">
                    <div class="chart-bar-fill ${diffLevel.className}" 
                         style="height: ${barHeight}%">
                        ${count > 0 ? count : ''}
                    </div>
                </div>
                <div class="chart-bar-label">${diffLevel.emoji}</div>
                <div class="chart-bar-count">${count} words</div>
            `;
            
            // Add click handler to review words of this difficulty
            barElement.addEventListener('click', () => {
                if (count > 0) {
                    this.reviewWordsByDifficulty(diffLevel.key, difficultyBreakdown[diffLevel.key]);
                }
            });
            
            chartContainer.appendChild(barElement);
        });
    }
    
    // Hide level statistics modal
    hideLevelStatisticsModal() {
        const modal = document.getElementById('levelStatsModal');
        if (modal) {
            // Restore background scrolling
            document.body.style.overflow = '';
            
            // Add fade out animation
            modal.style.opacity = '0';
            
            setTimeout(() => {
                modal.style.display = 'none';
                modal.style.opacity = '1'; // Reset for next time
            }, 200);
        }
    }
    
    // Review words by specific difficulty level
    reviewWordsByDifficulty(difficultyKey, words) {
        if (!words || words.length === 0) {
            this.showError(`No words found for this difficulty level.`);
            return;
        }
        
        console.log(`Starting review session for ${difficultyKey} words:`, words.length);
        
        // Close the statistics modal first
        this.hideLevelStatisticsModal();
        
        // Set up review session with filtered words
        this.sessionWords = [...words]; // Create a copy
        this.currentPartId = `difficulty_${difficultyKey}`;
        
        // Initialize session tracking
        this.currentSession = {
            wordsLearned: 0,
            correctAnswers: 0,
            totalAnswers: 0,
            startTime: Date.now(),
            targetWords: Math.min(this.settings.cardsPerSession, words.length),
            difficultyBreakdown: {
                veryHard: 0,  // difficulty 1
                hard: 0,      // difficulty 2
                medium: 0,    // difficulty 3
                easy: 0,      // difficulty 4
                veryEasy: 0   // difficulty 5
            }
        };
        
        this.currentSessionIndex = 0;
        this.currentCard = this.sessionWords[0];
        this.isFlipped = false;
        this.switchView('practice');
        this.displayCard();
        this.showLearningControls();
        
        // Show notification about the review session
        const difficultyLabels = {
            veryHard: 'Very Hard 😵',
            hard: 'Hard 😰',
            medium: 'Medium 🤔',
            easy: 'Easy 😊',
            veryEasy: 'Very Easy 😍'
        };
        
        console.log(`Starting review session: ${difficultyLabels[difficultyKey]} words (${words.length} cards)`);
    }
    
    // Review all words from current level
    reviewAllLevelWords() {
        if (!this.currentStatsLevel) return;
        
        const learnedWords = [];
        this.currentStatsLevel.parts.forEach(part => {
            part.cards.forEach(card => {
                if (card.learned) {
                    learnedWords.push(card);
                }
            });
        });
        
        if (learnedWords.length === 0) {
            this.showError(`No learned words in ${this.currentStatsLevel.name} yet!`);
            return;
        }
        
        this.hideLevelStatisticsModal();
        this.reviewLevelWords(this.currentStatsLevel);
    }
    
    // Review only hard words (difficulty 1-2) from current level
    reviewHardWords() {
        if (!this.currentStatsLevel) return;
        
        const stats = this.calculateLevelStatistics(this.currentStatsLevel);
        const hardWords = [...stats.difficultyBreakdown.veryHard, ...stats.difficultyBreakdown.hard];
        
        if (hardWords.length === 0) {
            this.showError(`No hard words found in ${this.currentStatsLevel.name}.`);
            return;
        }
        
        this.reviewWordsByDifficulty('hard', hardWords);
    }
    
    // Debug method to check progress data (can be called from console)
    debugProgress() {
        console.log('=== DEBUG PROGRESS DATA ===');
        console.log('userProgress:', this.userProgress);
        console.log('learningStreak:', this.userProgress.learningStreak);
        console.log('lastStudyDate:', this.userProgress.lastStudyDate);
        console.log('dailyActivity Map size:', this.userProgress.dailyActivity.size);
        console.log('dailyActivity entries:', Array.from(this.userProgress.dailyActivity.entries()));
        console.log('totalReviews:', this.userProgress.totalReviews);
        
        // Check localStorage
        const savedProgress = localStorage.getItem('deutschlern_progress');
        if (savedProgress) {
            const parsed = JSON.parse(savedProgress);
            console.log('localStorage progress:', parsed);
        } else {
            console.log('No data in localStorage');
        }
        
        console.log('=== END DEBUG ===');
        return this.userProgress;
    }
    
    // Test method to simulate daily activity (for debugging)
    addTestActivity(dateStr = null, count = 5) {
        const today = dateStr || new Date().toISOString().split('T')[0];
        const currentActivity = this.userProgress.dailyActivity.get(today) || 0;
        this.userProgress.dailyActivity.set(today, currentActivity + count);
        
        console.log(`Added ${count} activities for ${today}. Total: ${currentActivity + count}`);
        
        this.saveUserData();
        this.generateHeatmap();
        this.updateStudyPatterns();
    }
    
    // Test method to reset progress (for debugging)
    resetProgress() {
        if (confirm('Reset all progress? This cannot be undone!')) {
            this.userProgress = {
                currentLevel: 'A1',
                learnedWords: new Set(),
                completedParts: new Set(),
                unlockedLevels: new Set(['A1.1']),
                totalReviews: 0,
                correctAnswers: 0,
                learningStreak: 0,
                dailyActivity: new Map(),
                lastStudyDate: null,
                lastModified: Date.now()
            };
            this.saveUserData();
            console.log('Progress reset');
            location.reload();
        }
    }
    updateLevelLocks() {
        console.log('Updating level locks, levels count:', this.levels.length);
        // Update part completion and progress first
        this.levels.forEach((level, levelIndex) => {
            level.parts.forEach((part, partIndex) => {
                const learnedCards = part.cards.filter(card => this.userProgress.learnedWords.has(card.id)).length;
                part.progress = part.cards.length > 0 ? (learnedCards / part.cards.length) * 100 : 0;
                part.isCompleted = part.progress === 100;
                // Mark cards as learned based on user progress
                part.cards.forEach(card => {
                    card.learned = this.userProgress.learnedWords.has(card.id);
                });
                console.log(`Level ${levelIndex}, Part ${partIndex}: ${part.progress}% complete`);
            });
            // Calculate level progress
            const totalCards = level.parts.reduce((sum, part) => sum + part.cards.length, 0);
            const learnedCards = level.parts.reduce((sum, part) => sum + part.cards.filter(card => card.learned).length, 0);
            level.progress = totalCards > 0 ? (learnedCards / totalCards) * 100 : 0;
            console.log(`Level ${levelIndex} (${level.name}): ${level.progress}% complete`);
        });
        // First level and first part are always unlocked
        if (this.levels.length > 0) {
            this.levels[0].isUnlocked = true;
            if (this.levels[0].parts.length > 0) {
                this.levels[0].parts[0].isUnlocked = true;
                console.log('First level and part unlocked:', this.levels[0].name, 'Part 1');
                console.log('Part 1 details:', this.levels[0].parts[0]);
            }
        }
        // Unlock parts within each level
        this.levels.forEach(level => {
            for (let i = 0; i < level.parts.length - 1; i++) {
                if (level.parts[i].isCompleted) {
                    level.parts[i + 1].isUnlocked = true;
                    console.log(`Unlocked part ${i + 1} in level ${level.name}`);
                }
            }
        });
        // Unlock next levels when previous level is completed
        for (let i = 0; i < this.levels.length - 1; i++) {
            if (this.levels[i].progress >= 100) {
                this.levels[i + 1].isUnlocked = true;
                console.log(`Unlocked level ${this.levels[i + 1].name}`);
            }
        }
        console.log('Level locks updated');
    }
    updateDashboardStats() {
        const totalCardsLearned = document.getElementById('totalCardsLearned');
        const currentStreak = document.getElementById('currentStreak');
        const unlockedLevels = document.getElementById('unlockedLevels');
        if (totalCardsLearned) {
            totalCardsLearned.textContent = this.userProgress.learnedWords.size.toString();
        }
        if (currentStreak) {
            currentStreak.textContent = this.userProgress.learningStreak.toString();
        }
        if (unlockedLevels) {
            const unlockedCount = this.levels.filter(level => level.isUnlocked).length;
            unlockedLevels.textContent = unlockedCount.toString();
        }
    }
    startLearning() {
        // Use current part if available, otherwise get words for session
        if (this.currentPartId) {
            const currentPart = this.levels
                .flatMap(level => level.parts)
                .find(part => part.id === this.currentPartId);
            if (currentPart) {
                this.sessionWords = currentPart.cards.filter(card => !card.learned);
            }
            else {
                this.sessionWords = this.getWordsForSession();
            }
        }
        else {
            this.sessionWords = this.getWordsForSession();
        }
        
        // Initialize session tracking
        this.currentSession = {
            wordsLearned: 0,
            correctAnswers: 0,
            totalAnswers: 0,
            startTime: Date.now(),
            targetWords: Math.min(this.settings.cardsPerSession, this.sessionWords.length),
            difficultyBreakdown: {
                veryHard: 0,  // difficulty 1
                hard: 0,      // difficulty 2
                medium: 0,    // difficulty 3
                easy: 0,      // difficulty 4
                veryEasy: 0   // difficulty 5
            }
        };
        
        this.currentSessionIndex = 0;
        if (this.sessionWords.length === 0) {
            this.showError('No words available. Please select a part from the dashboard.');
            return;
        }
        this.currentCard = this.sessionWords[0];
        this.isFlipped = false;
        this.displayCard();
        this.showLearningControls();
    }
    getWordsForSession() {
        console.log('Getting words for session...');
        console.log('Total levels:', this.levels.length);
        console.log('Total vocabulary:', this.vocabulary.length);
        // If we have structured levels data, use it
        if (this.levels.length > 0) {
            const unlockedParts = this.levels
                .filter(level => level.isUnlocked)
                .flatMap(level => level.parts)
                .filter(part => part.isUnlocked);
            console.log('Unlocked parts:', unlockedParts.length);
            const availableWords = unlockedParts
                .flatMap(part => part.cards)
                .filter(card => !card.learned);
            console.log('Available words from parts:', availableWords.length);
            if (availableWords.length > 0) {
                const shuffled = availableWords.sort(() => Math.random() - 0.5);
                return shuffled.slice(0, Math.min(this.settings.cardsPerSession, availableWords.length));
            }
        }
        // Fallback: use all vocabulary (sample data or loaded directly)
        console.log('Using fallback vocabulary');
        const availableWords = this.vocabulary.filter(card => !card.learned);
        console.log('Available words from vocabulary:', availableWords.length);
        if (availableWords.length === 0) {
            return [];
        }
        // Shuffle and limit to session size
        const shuffled = availableWords.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(this.settings.cardsPerSession, availableWords.length));
    }
    displayCard() {
        if (!this.currentCard)
            return;
        const wordDisplay = document.getElementById('wordDisplay');
        const translation = document.getElementById('translation');
        const wordInfo = document.getElementById('wordInfo');
        const voiceBtnFront = document.getElementById('voiceBtnFront');
        const voiceBtnBack = document.getElementById('voiceBtnBack');
        const flashcard = document.getElementById('flashcard');
        if (flashcard) {
            flashcard.classList.remove('flipped');
        }
        if (wordDisplay && translation && wordInfo) {
            if (this.settings.learningDirection === 'de-id') {
                // German on front, Indonesian on back
                wordDisplay.textContent = this.currentCard.german;
                translation.textContent = this.currentCard.indonesian;
                // Show voice button on front (German side)
                if (voiceBtnFront) {
                    voiceBtnFront.style.display = this.settings.voiceEnabled ? 'block' : 'none';
                }
                if (voiceBtnBack) {
                    voiceBtnBack.style.display = 'none';
                }
            }
            else {
                // Indonesian on front, German on back
                wordDisplay.textContent = this.currentCard.indonesian;
                translation.textContent = this.currentCard.german;
                // Show voice button on back (German side)
                if (voiceBtnFront) {
                    voiceBtnFront.style.display = 'none';
                }
                if (voiceBtnBack) {
                    voiceBtnBack.style.display = this.settings.voiceEnabled ? 'block' : 'none';
                }
            }
            wordInfo.textContent = `${this.currentCard.type.toUpperCase()} • ${this.currentCard.level}`;
        }
        this.isFlipped = false;
        this.updateProgress();
    }
    flipCard() {
        const flashcard = document.getElementById('flashcard');
        if (flashcard) {
            flashcard.classList.toggle('flipped');
            this.isFlipped = !this.isFlipped;
        }
    }
    handleDifficultyResponse(difficulty) {
        console.log('handleDifficultyResponse called once with difficulty:', difficulty);
        if (!this.currentCard) return;
        
        // Track session progress
        this.currentSession.totalAnswers++;
        if (difficulty >= 4) {
            this.currentSession.correctAnswers++;
        }
        
        // Track difficulty breakdown
        switch (difficulty) {
            case 1:
                this.currentSession.difficultyBreakdown.veryHard++;
                break;
            case 2:
                this.currentSession.difficultyBreakdown.hard++;
                break;
            case 3:
                this.currentSession.difficultyBreakdown.medium++;
                break;
            case 4:
                this.currentSession.difficultyBreakdown.easy++;
                break;
            case 5:
                this.currentSession.difficultyBreakdown.veryEasy++;
                break;
        }
        
        // Update card statistics
        this.currentCard.reviewCount++;
        this.currentCard.lastReviewed = new Date();
        if (difficulty >= 4) {
            this.currentCard.correctCount++;
            this.userProgress.correctAnswers++;
            this.userProgress.learnedWords.add(this.currentCard.id);
            this.currentCard.learned = true;
            this.currentSession.wordsLearned++;
        }
        else {
            this.currentCard.incorrectCount++;
        }
        this.userProgress.totalReviews++;
        
        // Calculate next review date using FSRS algorithm
        const interval = this.calculateNextInterval(this.currentCard, difficulty);
        this.currentCard.nextReview = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
        
        // Update daily activity and streak
        const today = new Date().toISOString().split('T')[0];
        const currentActivity = this.userProgress.dailyActivity.get(today) || 0;
        this.userProgress.dailyActivity.set(today, currentActivity + 1);
        
        console.log(`Daily activity updated: ${today} = ${currentActivity + 1}`);
        console.log('Current dailyActivity map:', Array.from(this.userProgress.dailyActivity.entries()));
        
        // Update streak (fixed logic)
        if (this.userProgress.lastStudyDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            console.log(`Streak check: lastStudyDate=${this.userProgress.lastStudyDate}, today=${today}, yesterday=${yesterdayStr}`);
            
            if (this.userProgress.lastStudyDate === yesterdayStr) {
                // Consecutive day - extend streak
                this.userProgress.learningStreak++;
                console.log('Streak extended:', this.userProgress.learningStreak);
            }
            else if (this.userProgress.lastStudyDate === null || this.userProgress.lastStudyDate === '') {
                // First time or reset - start streak
                this.userProgress.learningStreak = 1;
                console.log('Streak started:', this.userProgress.learningStreak);
            }
            else {
                // Gap in learning - reset streak
                this.userProgress.learningStreak = 1;
                console.log('Streak reset:', this.userProgress.learningStreak);
            }
            this.userProgress.lastStudyDate = today;
        } else {
            console.log('Same day - streak unchanged:', this.userProgress.learningStreak);
        }
        
        this.updateLevelLocks();
        this.saveUserData();
        
        // Force refresh statistics and heatmap
        this.updateStudyPatterns();
        this.generateHeatmap();
        
        // Check if session target reached
        if (this.currentSession.totalAnswers >= this.currentSession.targetWords) {
            this.showSessionCompleteModal();
            return;
        }
        
        this.nextCard();
    }
    // FSRS-based interval calculation
    calculateNextInterval(card, userRating) {
        // If FSRS is not available, use simple algorithm
        if (!this.fsrsEnabled || !this.fsrs || !card.fsrsCard) {
            return this.calculateSimpleInterval(userRating, card.reviewCount);
        }
        
        // Map user rating (1-5) to FSRS Rating enum
        const fsrsRating = this.mapUserRatingToFSRS(userRating);
        
        // Get current date for scheduling
        const now = new Date();
        
        // Use FSRS algorithm to calculate next review schedule
        try {
            const schedulingInfo = this.fsrs.repeat(card.fsrsCard, now);
            
            // Get the scheduled card based on user rating
            let scheduledCard;
            switch (fsrsRating) {
                case this.RatingEnum.Again:
                    scheduledCard = schedulingInfo[this.RatingEnum.Again];
                    break;
                case this.RatingEnum.Hard:
                    scheduledCard = schedulingInfo[this.RatingEnum.Hard];
                    break;
                case this.RatingEnum.Good:
                    scheduledCard = schedulingInfo[this.RatingEnum.Good];
                    break;
                case this.RatingEnum.Easy:
                    scheduledCard = schedulingInfo[this.RatingEnum.Easy];
                    break;
                default:
                    scheduledCard = schedulingInfo[this.RatingEnum.Good];
            }
            
            // Update card's FSRS state
            card.fsrsCard = scheduledCard.card;
            card.fsrsState = {
                difficulty: scheduledCard.card.difficulty,
                stability: scheduledCard.card.stability,
                retrievability: scheduledCard.card.retrievability
            };
            
            // Calculate interval in days
            const nextReviewDate = scheduledCard.card.due;
            const intervalMs = nextReviewDate.getTime() - now.getTime();
            const intervalDays = Math.max(1, Math.ceil(intervalMs / (1000 * 60 * 60 * 24)));
            
            console.log(`FSRS scheduled next review in ${intervalDays} days (D:${card.fsrsState.difficulty.toFixed(2)}, S:${card.fsrsState.stability.toFixed(2)}, R:${card.fsrsState.retrievability.toFixed(2)})`);
            
            return intervalDays;
        } catch (error) {
            console.error('FSRS calculation error:', error);
            // Fallback to simple algorithm if FSRS fails
            return this.calculateSimpleInterval(userRating, card.reviewCount);
        }
    }
    
    // Map user rating (1-5) to FSRS Rating enum
    mapUserRatingToFSRS(userRating) {
        if (!this.RatingEnum) {
            // Fallback values if FSRS is not available
            switch (userRating) {
                case 1: return 1;  // Very Hard -> Again
                case 2: return 2;  // Hard -> Hard
                case 3: return 3;  // Medium -> Good
                case 4: return 3;  // Easy -> Good
                case 5: return 4;  // Very Easy -> Easy
                default: return 3; // Default to Good
            }
        }
        
        switch (userRating) {
            case 1: return this.RatingEnum.Again;  // Very Hard
            case 2: return this.RatingEnum.Hard;   // Hard
            case 3: return this.RatingEnum.Good;   // Medium
            case 4: return this.RatingEnum.Good;   // Easy
            case 5: return this.RatingEnum.Easy;   // Very Easy
            default: return this.RatingEnum.Good;
        }
    }
    
    // Fallback simple interval calculation
    calculateSimpleInterval(difficulty, reviewCount) {
        const baseInterval = 1;
        const multiplier = Math.max(1.3, difficulty * 0.5);
        return Math.round(baseInterval * Math.pow(multiplier, reviewCount - 1));
    }
    
    // Get cards that need review based on FSRS algorithm
    getCardsNeedingReview() {
        const now = new Date();
        const cardsNeedingReview = [];
        
        this.vocabulary.forEach(level => {
            level.parts.forEach(part => {
                part.cards.forEach(card => {
                    if (card.nextReview && card.nextReview <= now) {
                        // Calculate current retrievability using FSRS
                        const timeSinceReview = (now.getTime() - card.lastReviewed?.getTime()) / (1000 * 60 * 60 * 24);
                        if (card.fsrsState && card.fsrsState.stability > 0) {
                            const retrievability = Math.exp(-timeSinceReview / card.fsrsState.stability);
                            card.currentRetrievability = retrievability;
                        }
                        cardsNeedingReview.push(card);
                    }
                });
            });
        });
        
        // Sort by priority: lower retrievability = higher priority
        cardsNeedingReview.sort((a, b) => {
            const aRetrievability = a.currentRetrievability || 0;
            const bRetrievability = b.currentRetrievability || 0;
            return aRetrievability - bRetrievability;
        });
        
        return cardsNeedingReview;
    }
    
    // Calculate FSRS statistics
    getFSRSStats() {
        let totalCards = 0;
        let averageDifficulty = 0;
        let averageStability = 0;
        let cardsNeedingReview = 0;
        
        this.vocabulary.forEach(level => {
            level.parts.forEach(part => {
                part.cards.forEach(card => {
                    totalCards++;
                    if (card.fsrsState) {
                        averageDifficulty += card.fsrsState.difficulty;
                        averageStability += card.fsrsState.stability;
                    }
                    if (card.nextReview && card.nextReview <= new Date()) {
                        cardsNeedingReview++;
                    }
                });
            });
        });
        
        return {
            totalCards,
            averageDifficulty: totalCards > 0 ? averageDifficulty / totalCards : 0,
            averageStability: totalCards > 0 ? averageStability / totalCards : 0,
            cardsNeedingReview,
            algorithm: 'FSRS (Free Spaced Repetition Scheduler)'
        };
    }
    nextCard() {
        this.currentSessionIndex++;
        if (this.currentSessionIndex >= this.sessionWords.length) {
            this.endSession();
            return;
        }
        this.currentCard = this.sessionWords[this.currentSessionIndex];
        this.displayCard();
    }
    endSession() {
        this.showCompletionMessage();
        this.hideLearningControls();
        this.updateUI();
        this.generateHeatmap();
        this.switchView('dashboard');
    }
    
    showCompletionMessage() {
        const wordDisplay = document.getElementById('wordDisplay');
        if (wordDisplay) {
            wordDisplay.textContent = `Session Complete! 🎉\n${this.sessionWords.length} words reviewed.`;
        }
    }
    
    // Session completion modal methods
    showSessionCompleteModal() {
        const modal = document.getElementById('sessionCompleteModal');
        if (!modal) return;
        
        // Calculate session stats
        const timeSpent = Math.round((Date.now() - this.currentSession.startTime) / 1000 / 60); // minutes
        const accuracy = this.currentSession.totalAnswers > 0 
            ? Math.round((this.currentSession.correctAnswers / this.currentSession.totalAnswers) * 100) 
            : 0;
        
        // Update modal content
        document.getElementById('sessionWordsLearned').textContent = this.currentSession.wordsLearned;
        document.getElementById('sessionAccuracy').textContent = `${accuracy}%`;
        document.getElementById('sessionTimeSpent').textContent = `${timeSpent}m`;
        
        // Update difficulty breakdown
        const breakdown = this.currentSession.difficultyBreakdown;
        document.getElementById('veryHardCount').textContent = breakdown.veryHard;
        document.getElementById('hardCount').textContent = breakdown.hard;
        document.getElementById('mediumCount').textContent = breakdown.medium;
        document.getElementById('easyCount').textContent = breakdown.easy;
        document.getElementById('veryEasyCount').textContent = breakdown.veryEasy;
        
        // Prevent background scrolling
        document.body.style.overflow = 'hidden';
        
        // Show modal with smooth animation
        modal.style.display = 'flex';
        
        // Focus management for accessibility
        const closeButton = document.getElementById('sessionModalCloseBtn');
        if (closeButton) {
            setTimeout(() => closeButton.focus(), 100);
        }
    }
    
    hideSessionCompleteModal() {
        const modal = document.getElementById('sessionCompleteModal');
        if (modal) {
            // Restore background scrolling
            document.body.style.overflow = '';
            
            // Add fade out animation
            modal.style.opacity = '0';
            
            setTimeout(() => {
                modal.style.display = 'none';
                modal.style.opacity = '1'; // Reset for next time
            }, 200);
        }
    }
    
    extendSession() {
        // Extend session by another round
        this.currentSession.targetWords += this.settings.cardsPerSession;
        console.log(`Session extended. New target: ${this.currentSession.targetWords} words`);
        
        // Continue with next card if available
        this.nextCard();
    }
    playPronunciation() {
        if (!this.currentCard || !this.settings.voiceEnabled || !this.speechSynthesis)
            return;
        const textToSpeak = this.settings.learningDirection === 'de-id'
            ? this.currentCard.german
            : this.currentCard.german; // Always pronounce German
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        // Get available voices and find German voice
        const voices = this.speechSynthesis.getVoices();
        const germanVoice = voices.find(voice => voice.lang === 'de-DE' ||
            voice.lang === 'de' ||
            voice.lang.startsWith('de-') ||
            voice.name.toLowerCase().includes('german') ||
            voice.name.toLowerCase().includes('deutsch'));
        // Set German voice if available
        if (germanVoice) {
            utterance.voice = germanVoice;
        }
        utterance.lang = 'de-DE';
        utterance.rate = 0.8; // Slightly slower for learning
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        this.speechSynthesis.speak(utterance);
    }
    initializeVoices() {
        if (!this.speechSynthesis)
            return;
        // Load voices when available
        const loadVoices = () => {
            const voices = this.speechSynthesis.getVoices();
            if (voices.length > 0) {
                console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
                const germanVoices = voices.filter(voice => voice.lang === 'de-DE' ||
                    voice.lang === 'de' ||
                    voice.lang.startsWith('de-') ||
                    voice.name.toLowerCase().includes('german') ||
                    voice.name.toLowerCase().includes('deutsch'));
                console.log('German voices found:', germanVoices.map(v => `${v.name} (${v.lang})`));
            }
        };
        // Voices might not be loaded immediately
        if (this.speechSynthesis.getVoices().length > 0) {
            loadVoices();
        }
        else {
            this.speechSynthesis.addEventListener('voiceschanged', loadVoices);
        }
    }
    async initializeSyncService() {
        try {
            // Dynamically import SyncService
            const SyncServiceModule = await import('./sync-service.js');
            const SyncService = SyncServiceModule.default;
            this.syncService = new SyncService(this);
        }
        catch (error) {
            console.warn('Failed to initialize sync service:', error);
            console.log('App will work in offline mode only');
        }
    }
    updateUI() {
        this.updateProgress();
        this.updateStats();
        this.updateSettings();
    }
    updateProgress() {
        const currentLevel = document.getElementById('currentLevel');
        const progressText = document.getElementById('progressText');
        const progressFill = document.getElementById('progressFill');
        if (currentLevel) {
            currentLevel.textContent = this.settings.currentLevel;
        }
        const levelWords = this.vocabulary.filter(word => word.level === this.settings.currentLevel);
        const learnedInLevel = levelWords.filter(word => this.userProgress.learnedWords.has(word.id)).length;
        const totalInLevel = levelWords.length;
        const progressPercentage = totalInLevel > 0 ? (learnedInLevel / totalInLevel) * 100 : 0;
        if (progressText) {
            progressText.textContent = `${learnedInLevel} / ${totalInLevel} words learned`;
        }
        if (progressFill) {
            progressFill.style.width = `${progressPercentage}%`;
        }
    }
    updateStats() {
        const totalWords = document.getElementById('totalWords');
        const learnedWords = document.getElementById('learnedWords');
        const reviewsDue = document.getElementById('reviewsDue');
        const accuracy = document.getElementById('accuracy');
        if (totalWords) {
            totalWords.textContent = this.vocabulary.length.toString();
        }
        if (learnedWords) {
            learnedWords.textContent = this.userProgress.learnedWords.size.toString();
        }
        if (reviewsDue) {
            const now = new Date();
            const due = this.vocabulary.filter(word => word.nextReview && word.nextReview <= now).length;
            reviewsDue.textContent = due.toString();
        }
        if (accuracy) {
            const accuracyPercent = this.userProgress.totalReviews > 0
                ? Math.round((this.userProgress.correctAnswers / this.userProgress.totalReviews) * 100)
                : 0;
            accuracy.textContent = `${accuracyPercent}%`;
        }
    }
    updateSettings() {
        const learningDirection = document.getElementById('learningDirection');
        const levelSelect = document.getElementById('levelSelect');
        const voiceEnabled = document.getElementById('voiceEnabled');
        const cardsPerSession = document.getElementById('cardsPerSession');
        if (learningDirection)
            learningDirection.value = this.settings.learningDirection;
        if (levelSelect)
            levelSelect.value = this.settings.currentLevel;
        if (voiceEnabled)
            voiceEnabled.checked = this.settings.voiceEnabled;
        if (cardsPerSession)
            cardsPerSession.value = this.settings.cardsPerSession.toString();
    }
    generateHeatmap() {
        const heatmap = document.getElementById('heatmap');
        if (!heatmap) {
            console.warn('Heatmap element not found');
            return;
        }
        
        heatmap.innerHTML = '';
        console.log('Generating heatmap...');
        console.log('dailyActivity map size:', this.userProgress.dailyActivity.size);
        console.log('dailyActivity entries:', Array.from(this.userProgress.dailyActivity.entries()));
        
        const today = new Date();
        const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
        let activeDaysCount = 0;
        
        for (let i = 0; i < 365; i++) {
            const date = new Date(oneYearAgo.getTime() + i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            const activity = this.userProgress.dailyActivity.get(dateStr) || 0;
            
            if (activity > 0) {
                activeDaysCount++;
                console.log(`Active day found: ${dateStr} = ${activity} reviews`);
            }
            
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            
            // Set activity level (0-4) based on number of reviews
            let level = 0;
            if (activity > 0) level = 1;
            if (activity >= 5) level = 2;
            if (activity >= 10) level = 3;
            if (activity >= 20) level = 4;
            
            cell.dataset.level = level.toString();
            cell.title = `${dateStr}: ${activity} reviews`;
            heatmap.appendChild(cell);
        }
        
        console.log(`Heatmap generated: ${activeDaysCount} active days found`);
    }
    toggleSettings() {
        const settingsPanel = document.getElementById('settingsPanel');
        const backdrop = document.getElementById('panelBackdrop');
        if (settingsPanel) {
            const computedStyle = window.getComputedStyle(settingsPanel);
            const isVisible = computedStyle.display !== 'none' && settingsPanel.style.display !== 'none';
            console.log('Settings panel toggle - currently visible:', isVisible);
            if (isVisible) {
                this.hideAllPanels();
            }
            else {
                // Show backdrop
                if (backdrop) {
                    backdrop.classList.add('show');
                }
                // Show panel with animation
                settingsPanel.style.display = 'block';
                settingsPanel.classList.add('show');
                settingsPanel.classList.remove('hide');
                // Remove show class after animation
                setTimeout(() => {
                    settingsPanel.classList.remove('show');
                }, 300);
            }
        }
    }
    renderStatistics() {
        // Update basic stats
        this.updateStats();
        // Generate heatmap
        this.generateHeatmap();
        // Render learned words chart
        this.renderLearnedWordsChart();
        // Render level progress stats
        this.renderLevelProgressStats();
        // Update study patterns
        this.updateStudyPatterns();
    }
    
    renderLearnedWordsChart() {
        const container = document.getElementById('learnedWordsChart');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.levels.forEach(level => {
            const totalCards = level.parts.reduce((sum, part) => sum + part.cards.length, 0);
            const learnedCards = level.parts.reduce((sum, part) => 
                sum + part.cards.filter(card => card.learned).length, 0);
            const percentage = totalCards > 0 ? Math.round((learnedCards / totalCards) * 100) : 0;
            
            const cardElement = document.createElement('div');
            cardElement.className = 'level-word-card';
            cardElement.dataset.level = level.name;
            
            cardElement.innerHTML = `
                <div class="level-word-header">
                    <div class="level-word-title">${level.name}</div>
                    <div class="level-word-count">${learnedCards}</div>
                </div>
                <div class="level-word-progress">
                    <div class="level-word-progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="level-word-details">
                    <span>${learnedCards} of ${totalCards} words</span>
                    <span>${percentage}%</span>
                </div>
            `;
            
            // Add click handler to show level statistics modal
            cardElement.addEventListener('click', () => {
                this.showLevelStatistics(level);
            });
            
            container.appendChild(cardElement);
        });
    }
    
    reviewLevelWords(level) {
        // Get all learned words from this level
        const learnedWords = [];
        level.parts.forEach(part => {
            part.cards.forEach(card => {
                if (card.learned) {
                    learnedWords.push(card);
                }
            });
        });
        
        if (learnedWords.length === 0) {
            this.showError(`No learned words in ${level.name} yet! Start learning to see words here.`);
            return;
        }
        
        // Set up review session with learned words
        this.sessionWords = learnedWords;
        this.currentPartId = `review_${level.name}`;
        
        // Initialize session tracking for review
        this.currentSession = {
            wordsLearned: 0,
            correctAnswers: 0,
            totalAnswers: 0,
            startTime: Date.now(),
            targetWords: Math.min(this.settings.cardsPerSession, learnedWords.length),
            difficultyBreakdown: {
                veryHard: 0,  // difficulty 1
                hard: 0,      // difficulty 2
                medium: 0,    // difficulty 3
                easy: 0,      // difficulty 4
                veryEasy: 0   // difficulty 5
            }
        };
        
        this.currentSessionIndex = 0;
        this.currentCard = this.sessionWords[0];
        this.isFlipped = false;
        this.switchView('practice');
        this.displayCard();
        this.showLearningControls();
        
        // Show feedback about review mode
        if (this.syncService) {
            this.syncService.showSyncStatus(`📚 Reviewing ${learnedWords.length} words from ${level.name}`);
        }
    }
    
    renderLevelProgressStats() {
        const container = document.getElementById('levelProgressStats');
        if (!container)
            return;
        container.innerHTML = '';
        this.levels.forEach(level => {
            const levelElement = document.createElement('div');
            levelElement.className = 'level-stat-item';
            const icon = level.isUnlocked ? '🔓' : '🔒';
            const totalCards = level.parts.reduce((sum, part) => sum + part.cards.length, 0);
            const learnedCards = level.parts.reduce((sum, part) => sum + part.cards.filter(card => card.learned).length, 0);
            const percentage = totalCards > 0 ? Math.round((learnedCards / totalCards) * 100) : 0;
            levelElement.innerHTML = `
                <div class="level-stat-info">
                    <div class="level-stat-icon">${icon}</div>
                    <div class="level-stat-details">
                        <h4>${level.name}</h4>
                        <p>${learnedCards} of ${totalCards} words learned</p>
                    </div>
                </div>
                <div class="level-stat-progress">
                    <div class="level-progress-bar">
                        <div class="level-progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="level-stat-percentage">${percentage}%</div>
                </div>
            `;
            container.appendChild(levelElement);
        });
    }
    updateStudyPatterns() {
        // Current streak
        const currentStreakEl = document.getElementById('currentStreak');
        if (currentStreakEl) {
            console.log('Updating current streak display:', this.userProgress.learningStreak);
            currentStreakEl.textContent = this.userProgress.learningStreak.toString();
        } else {
            console.warn('currentStreak element not found');
        }
        // Total sessions (approximate based on reviews)
        const totalSessionsEl = document.getElementById('totalSessions');
        if (totalSessionsEl) {
            const sessions = Math.ceil(this.userProgress.totalReviews / this.settings.cardsPerSession);
            totalSessionsEl.textContent = sessions.toString();
        }
        // Average daily (words learned per active day)
        const averageDailyEl = document.getElementById('averageDaily');
        if (averageDailyEl) {
            const activeDays = this.userProgress.dailyActivity.size;
            const totalLearned = this.userProgress.learnedWords.size;
            const average = activeDays > 0 ? Math.round(totalLearned / activeDays) : 0;
            averageDailyEl.textContent = average.toString();
        }
        
        // Update FSRS statistics
        this.updateFSRSStats();
    }
    
    // Update FSRS statistics in the UI
    updateFSRSStats() {
        const fsrsStats = this.getFSRSStats();
        
        // Algorithm name
        const algorithmEl = document.getElementById('fsrsAlgorithm');
        if (algorithmEl) {
            algorithmEl.textContent = this.fsrsEnabled ? 'FSRS' : 'Simple';
        }
        
        // Average difficulty
        const avgDifficultyEl = document.getElementById('fsrsAvgDifficulty');
        if (avgDifficultyEl) {
            avgDifficultyEl.textContent = this.fsrsEnabled ? fsrsStats.averageDifficulty.toFixed(1) : 'N/A';
        }
        
        // Average stability
        const avgStabilityEl = document.getElementById('fsrsAvgStability');
        if (avgStabilityEl) {
            avgStabilityEl.textContent = this.fsrsEnabled ? fsrsStats.averageStability.toFixed(1) : 'N/A';
        }
        
        // Cards needing review
        const reviewDueEl = document.getElementById('fsrsReviewDue');
        if (reviewDueEl) {
            reviewDueEl.textContent = fsrsStats.cardsNeedingReview.toString();
        }
        
        // Target retention
        const retentionEl = document.getElementById('fsrsRetention');
        if (retentionEl) {
            retentionEl.textContent = this.fsrsEnabled ? '90%' : 'Basic';
        }
        
        // Efficiency gain
        const efficiencyEl = document.getElementById('fsrsEfficiency');
        if (efficiencyEl) {
            efficiencyEl.textContent = this.fsrsEnabled ? '~25%' : '0%';
        }
    }
    
    hidePanel(panel) {
        panel.classList.add('hide');
        panel.classList.remove('show');
        setTimeout(() => {
            panel.style.display = 'none';
            panel.classList.remove('hide');
        }, 300);
    }
    hideAllPanels() {
        const settingsPanel = document.getElementById('settingsPanel');
        const backdrop = document.getElementById('panelBackdrop');
        // Hide backdrop
        if (backdrop) {
            backdrop.classList.remove('show');
        }
        // Hide panels
        if (settingsPanel && settingsPanel.style.display !== 'none') {
            this.hidePanel(settingsPanel);
        }
    }
    showLearningControls() {
        const startBtn = document.getElementById('startBtn');
        const learningControls = document.getElementById('learningControls');
        if (startBtn)
            startBtn.style.display = 'none';
        if (learningControls)
            learningControls.style.display = 'flex';
    }
    hideLearningControls() {
        const startBtn = document.getElementById('startBtn');
        const learningControls = document.getElementById('learningControls');
        if (startBtn)
            startBtn.style.display = 'block';
        if (learningControls)
            learningControls.style.display = 'none';
    }
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }
    showError(message) {
        alert(message); // In production, use a proper toast/notification system
    }
}
// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new GermanLearningApp();
    
    // Expose app to global scope for debugging
    window.deutschApp = app;
    window.debugProgress = () => app.debugProgress();
    window.addTestActivity = (date, count) => app.addTestActivity(date, count);
    window.resetProgress = () => app.resetProgress();
    
    console.log('German Learning App initialized.');
    console.log('Debug commands available:');
    console.log('- debugProgress() - Show current progress data');
    console.log('- addTestActivity(date, count) - Add test activity (default: today, 5 reviews)');
    console.log('- resetProgress() - Reset all progress data');
});

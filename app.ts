// Types and Interfaces
interface VocabularyWord {
    id: string;
    german: string;
    indonesian: string;
    english?: string;
    level: 'A1' | 'A2' | 'B1' | 'B2';
    type: 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase';
    difficulty: number;
    lastReviewed: Date | null;
    nextReview: Date | null;
    reviewCount: number;
    correctCount: number;
    incorrectCount: number;
    partId: string;
    learned: boolean;
}

interface VocabularyPart {
    id: string;
    name: string;
    description: string;
    level: string;
    subLevel: string;
    partNumber: number;
    cards: VocabularyWord[];
    isUnlocked: boolean;
    isCompleted: boolean;
    progress: number;
}

interface Level {
    id: string;
    name: string;
    parts: VocabularyPart[];
    isUnlocked: boolean;
    progress: number;
}

interface UserProgress {
    currentLevel: 'A1' | 'A2' | 'B1' | 'B2';
    learnedWords: Set<string>;
    completedParts: Set<string>;
    unlockedLevels: Set<string>;
    totalReviews: number;
    correctAnswers: number;
    learningStreak: number;
    dailyActivity: Map<string, number>;
    lastStudyDate: string | null;
    lastModified?: number;
}

interface Settings {
    learningDirection: 'de-id' | 'id-de';
    voiceEnabled: boolean;
    cardsPerSession: number;
    currentLevel: 'A1' | 'A2' | 'B1' | 'B2';
    theme: 'light' | 'dark' | 'system';
    currentView: 'dashboard' | 'practice' | 'statistics';
}

class GermanLearningApp {
    private vocabulary: VocabularyWord[] = [];
    private levels: Level[] = [];
    private currentCard: VocabularyWord | null = null;
    private userProgress: UserProgress;
    private settings: Settings;
    private isFlipped: boolean = false;
    private sessionWords: VocabularyWord[] = [];
    private currentSessionIndex: number = 0;
    private currentPartId: string | null = null;
    private speechSynthesis: SpeechSynthesis | null = null;
    private syncService: any = null;

    constructor() {
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
        this.initializeVoices();
        this.initializeSyncService();
        this.init();
    }

    private async init(): Promise<void> {
        try {
            await this.loadAllVocabularyParts();
            this.loadUserData();
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
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize the application. Please refresh the page.');
        }
    }

    private async loadAllVocabularyParts(): Promise<void> {
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
                const level: Level = {
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
                            const vocabularyPart: VocabularyPart = {
                                id: partId,
                                name: partData.name || `Part ${partNum}`,
                                description: partData.description || '',
                                level: levelInfo.level,
                                subLevel: levelInfo.subLevel,
                                partNumber: partNum,
                                cards: partData.cards.map((card: any, index: number) => ({
                                    id: `${partId}_${index}`,
                                    german: card.german,
                                    indonesian: card.indonesian,
                                    english: card.english || '',
                                    level: levelInfo.level as 'A1' | 'A2' | 'B1' | 'B2',
                                    type: card.type || 'noun',
                                    difficulty: card.difficulty || 3,
                                    lastReviewed: null,
                                    nextReview: null,
                                    reviewCount: 0,
                                    correctCount: 0,
                                    incorrectCount: 0,
                                    partId: partId,
                                    learned: false
                                })),
                                isUnlocked: false,
                                isCompleted: false,
                                progress: 0
                            };
                            
                            level.parts.push(vocabularyPart);
                            this.vocabulary.push(...vocabularyPart.cards);
                        }
                    } catch (error) {
                        console.warn(`Failed to load ${filename}:`, error);
                    }
                }
                
                this.levels.push(level);
            }
            
        } catch (error) {
            console.error('Failed to load vocabulary parts:', error);
            this.vocabulary = this.generateSampleVocabulary();
        } finally {
            this.showLoading(false);
        }
    }

    private generateSampleVocabulary(): VocabularyWord[] {
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
            level: word.level as 'A1' | 'A2' | 'B1' | 'B2',
            type: word.type as 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase',
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

    private loadUserData(): void {
        const savedProgress = localStorage.getItem('deutschlern_progress');
        const savedSettings = localStorage.getItem('deutschlern_settings');

        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            this.userProgress = {
                ...this.userProgress,
                ...progress,
                learnedWords: new Set(progress.learnedWords || []),
                completedParts: new Set(progress.completedParts || []),
                unlockedLevels: new Set(progress.unlockedLevels || ['A1.1']),
                dailyActivity: new Map(progress.dailyActivity || [])
            };
        }

        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
    }

    private saveUserData(): void {
        // Update last modified timestamp
        this.userProgress.lastModified = Date.now();
        
        const progressToSave = {
            ...this.userProgress,
            learnedWords: Array.from(this.userProgress.learnedWords),
            completedParts: Array.from(this.userProgress.completedParts),
            unlockedLevels: Array.from(this.userProgress.unlockedLevels),
            dailyActivity: Array.from(this.userProgress.dailyActivity)
        };

        localStorage.setItem('deutschlern_progress', JSON.stringify(progressToSave));
        localStorage.setItem('deutschlern_settings', JSON.stringify(this.settings));
        
        // Trigger sync to cloud if available
        if (this.syncService) {
            this.syncService.syncToCloud();
        }
    }

    private initializeTheme(): void {
        const theme = this.settings.theme;
        this.applyTheme(theme);
    }

    private applyTheme(theme: 'light' | 'dark' | 'system'): void {
        const root = document.documentElement;
        
        if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            root.setAttribute('data-theme', theme);
        }
        
        this.updateThemeButton();
    }

    private updateThemeButton(): void {
        const themeBtn = document.getElementById('themeToggle');
        if (!themeBtn) return;
        
        const currentTheme = document.documentElement.getAttribute('data-theme');
        themeBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    }

    private toggleTheme(): void {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        this.settings.theme = newTheme;
        this.applyTheme(newTheme);
        this.saveUserData();
    }

    private setupEventListeners(): void {
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
                const target = e.target as HTMLElement;
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
        const learningDirection = document.getElementById('learningDirection') as HTMLSelectElement;
        learningDirection?.addEventListener('change', (e) => {
            this.settings.learningDirection = (e.target as HTMLSelectElement).value as 'de-id' | 'id-de';
            this.saveUserData();
            // Update display to show voice button on correct side
            if (this.currentCard) {
                this.displayCard();
            }
        });

        const levelSelect = document.getElementById('levelSelect') as HTMLSelectElement;
        levelSelect?.addEventListener('change', (e) => {
            this.settings.currentLevel = (e.target as HTMLSelectElement).value as 'A1' | 'A2' | 'B1';
            this.saveUserData();
            this.updateUI();
        });

        const voiceEnabled = document.getElementById('voiceEnabled') as HTMLInputElement;
        voiceEnabled?.addEventListener('change', (e) => {
            this.settings.voiceEnabled = (e.target as HTMLInputElement).checked;
            this.saveUserData();
            // Update voice button visibility
            if (this.currentCard) {
                this.displayCard();
            }
        });

        const cardsPerSession = document.getElementById('cardsPerSession') as HTMLInputElement;
        cardsPerSession?.addEventListener('change', (e) => {
            this.settings.cardsPerSession = parseInt((e.target as HTMLInputElement).value);
            this.saveUserData();
        });

        // Sync controls
        const manualSyncBtn = document.getElementById('manualSyncBtn');
        manualSyncBtn?.addEventListener('click', () => {
            if (this.syncService) {
                this.syncService.manualSync();
            }
        });

        // Update user ID display when sync service is ready
        if (this.syncService) {
            const userIdElement = document.getElementById('userId');
            if (userIdElement) {
                userIdElement.textContent = `User ID: ${this.syncService.getUserId()}`;
            }
        }

        // Keyboard shortcuts
        // Navigation tabs
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const view = target.dataset.view as 'dashboard' | 'practice' | 'statistics';
                this.switchView(view);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.flipCard();
            } else if (e.code === 'Digit1') {
                e.preventDefault();
                this.handleDifficultyResponse(1);
            } else if (e.code === 'Digit2') {
                e.preventDefault();
                this.handleDifficultyResponse(2);
            } else if (e.code === 'Digit3') {
                e.preventDefault();
                this.handleDifficultyResponse(3);
            } else if (e.code === 'Digit4') {
                e.preventDefault();
                this.handleDifficultyResponse(4);
            } else if (e.code === 'Digit5') {
                e.preventDefault();
                this.handleDifficultyResponse(5);
            } else if (e.code === 'Escape') {
                e.preventDefault();
                this.hideAllPanels();
            }
        });
    }

    private switchView(view: 'dashboard' | 'practice' | 'statistics'): void {
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
        if (dashboardView) dashboardView.style.display = 'none';
        if (practiceView) practiceView.style.display = 'none';
        if (statisticsView) statisticsView.style.display = 'none';

        // Show selected view
        if (view === 'dashboard') {
            if (dashboardView) dashboardView.style.display = 'block';
            this.renderDashboard();
        } else if (view === 'practice') {
            if (practiceView) practiceView.style.display = 'block';
            
            // Show start button if no current part is selected
            if (!this.currentPartId && startBtn) {
                startBtn.style.display = 'block';
                startBtn.textContent = 'Start Random Practice';
            }
        } else if (view === 'statistics') {
            if (statisticsView) statisticsView.style.display = 'block';
            this.renderStatistics();
        }
    }

    private renderDashboard(): void {
        const container = document.getElementById('levelsContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.levels.forEach(level => {
            const levelElement = this.createLevelElement(level);
            container.appendChild(levelElement);
        });
        
        this.updateDashboardStats();
    }

    private createLevelElement(level: Level): HTMLElement {
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
                    (card as HTMLElement).style.cursor = 'pointer';
                    card.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(`Clicked on part: ${part.name}`);
                        this.startPart(part);
                    });
                } else {
                    (card as HTMLElement).style.cursor = 'not-allowed';
                }
            });
        }, 0);
        
        return levelDiv;
    }

    private createPartCardHTML(part: VocabularyPart): string {
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

    private startPart(part: VocabularyPart): void {
        this.currentPartId = part.id;
        this.sessionWords = part.cards.filter(card => !card.learned);
        
        if (this.sessionWords.length === 0) {
            this.showError('All cards in this part have been learned!');
            return;
        }
        
        this.currentSessionIndex = 0;
        this.currentCard = this.sessionWords[0];
        this.isFlipped = false;
        
        this.switchView('practice');
        this.displayCard();
        this.showLearningControls();
    }

    private updateLevelLocks(): void {
        console.log('Updating level locks, levels count:', this.levels.length);
        
        // Update part completion and progress first
        this.levels.forEach((level, levelIndex) => {
            level.parts.forEach((part, partIndex) => {
                const learnedCards = part.cards.filter(card => 
                    this.userProgress.learnedWords.has(card.id)
                ).length;
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
            const learnedCards = level.parts.reduce((sum, part) => 
                sum + part.cards.filter(card => card.learned).length, 0
            );
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

    private updateDashboardStats(): void {
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

    private startLearning(): void {
        // Use current part if available, otherwise get words for session
        if (this.currentPartId) {
            const currentPart = this.levels
                .flatMap(level => level.parts)
                .find(part => part.id === this.currentPartId);
            
            if (currentPart) {
                this.sessionWords = currentPart.cards.filter(card => !card.learned);
            } else {
                this.sessionWords = this.getWordsForSession();
            }
        } else {
            this.sessionWords = this.getWordsForSession();
        }
        
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

    private getWordsForSession(): VocabularyWord[] {
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

    private displayCard(): void {
        if (!this.currentCard) return;

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
            } else {
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


    private flipCard(): void {
        const flashcard = document.getElementById('flashcard');
        if (flashcard) {
            flashcard.classList.toggle('flipped');
            this.isFlipped = !this.isFlipped;
        }
    }

    private handleDifficultyResponse(difficulty: number): void {
        if (!this.currentCard) return;

        // Update card statistics
        this.currentCard.reviewCount++;
        this.currentCard.lastReviewed = new Date();
        
        if (difficulty >= 4) {
            this.currentCard.correctCount++;
            this.userProgress.correctAnswers++;
            this.userProgress.learnedWords.add(this.currentCard.id);
            this.currentCard.learned = true;
        } else {
            this.currentCard.incorrectCount++;
        }

        this.userProgress.totalReviews++;

        // Calculate next review date using spaced repetition
        const interval = this.calculateNextInterval(difficulty, this.currentCard.reviewCount);
        this.currentCard.nextReview = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);

        // Update daily activity and streak
        const today = new Date().toISOString().split('T')[0];
        const currentActivity = this.userProgress.dailyActivity.get(today) || 0;
        this.userProgress.dailyActivity.set(today, currentActivity + 1);
        
        // Update streak
        if (this.userProgress.lastStudyDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            if (this.userProgress.lastStudyDate === yesterdayStr) {
                this.userProgress.learningStreak++;
            } else if (this.userProgress.lastStudyDate === null) {
                this.userProgress.learningStreak = 1;
            } else {
                this.userProgress.learningStreak = 1;
            }
            this.userProgress.lastStudyDate = today;
        }

        this.updateLevelLocks();
        this.saveUserData();
        this.nextCard();
    }

    private calculateNextInterval(difficulty: number, reviewCount: number): number {
        // Simple spaced repetition algorithm
        const baseInterval = 1;
        const multiplier = Math.max(1.3, difficulty * 0.5);
        return Math.round(baseInterval * Math.pow(multiplier, reviewCount - 1));
    }

    private nextCard(): void {
        this.currentSessionIndex++;
        
        if (this.currentSessionIndex >= this.sessionWords.length) {
            this.endSession();
            return;
        }

        this.currentCard = this.sessionWords[this.currentSessionIndex];
        this.displayCard();
    }

    private endSession(): void {
        this.showCompletionMessage();
        this.hideLearningControls();
        this.updateUI();
        this.generateHeatmap();
    }

    private showCompletionMessage(): void {
        const wordDisplay = document.getElementById('wordDisplay');
        if (wordDisplay) {
            wordDisplay.textContent = `Session Complete! 🎉\n${this.sessionWords.length} words reviewed.`;
        }
    }

    private playPronunciation(): void {
        if (!this.currentCard || !this.settings.voiceEnabled || !this.speechSynthesis) return;

        const textToSpeak = this.settings.learningDirection === 'de-id' 
            ? this.currentCard.german 
            : this.currentCard.german; // Always pronounce German

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        
        // Get available voices and find German voice
        const voices = this.speechSynthesis.getVoices();
        const germanVoice = voices.find(voice => 
            voice.lang === 'de-DE' || 
            voice.lang === 'de' ||
            voice.lang.startsWith('de-') ||
            voice.name.toLowerCase().includes('german') ||
            voice.name.toLowerCase().includes('deutsch')
        );
        
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

    private initializeVoices(): void {
        if (!this.speechSynthesis) return;

        // Load voices when available
        const loadVoices = () => {
            const voices = this.speechSynthesis!.getVoices();
            if (voices.length > 0) {
                console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
                const germanVoices = voices.filter(voice => 
                    voice.lang === 'de-DE' || 
                    voice.lang === 'de' ||
                    voice.lang.startsWith('de-') ||
                    voice.name.toLowerCase().includes('german') ||
                    voice.name.toLowerCase().includes('deutsch')
                );
                console.log('German voices found:', germanVoices.map(v => `${v.name} (${v.lang})`));
            }
        };

        // Voices might not be loaded immediately
        if (this.speechSynthesis.getVoices().length > 0) {
            loadVoices();
        } else {
            this.speechSynthesis.addEventListener('voiceschanged', loadVoices);
        }
    }

    private async initializeSyncService(): Promise<void> {
        try {
            // Dynamically import SyncService
            const SyncServiceModule = await import('./sync-service.js');
            const SyncService = SyncServiceModule.default;
            this.syncService = new SyncService(this);
        } catch (error) {
            console.warn('Failed to initialize sync service:', error);
            console.log('App will work in offline mode only');
        }
    }

    private updateUI(): void {
        this.updateProgress();
        this.updateStats();
        this.updateSettings();
    }

    private updateProgress(): void {
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

    private updateStats(): void {
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
            const due = this.vocabulary.filter(word => 
                word.nextReview && word.nextReview <= now
            ).length;
            reviewsDue.textContent = due.toString();
        }

        if (accuracy) {
            const accuracyPercent = this.userProgress.totalReviews > 0 
                ? Math.round((this.userProgress.correctAnswers / this.userProgress.totalReviews) * 100)
                : 0;
            accuracy.textContent = `${accuracyPercent}%`;
        }
    }

    private updateSettings(): void {
        const learningDirection = document.getElementById('learningDirection') as HTMLSelectElement;
        const levelSelect = document.getElementById('levelSelect') as HTMLSelectElement;
        const voiceEnabled = document.getElementById('voiceEnabled') as HTMLInputElement;
        const cardsPerSession = document.getElementById('cardsPerSession') as HTMLInputElement;

        if (learningDirection) learningDirection.value = this.settings.learningDirection;
        if (levelSelect) levelSelect.value = this.settings.currentLevel;
        if (voiceEnabled) voiceEnabled.checked = this.settings.voiceEnabled;
        if (cardsPerSession) cardsPerSession.value = this.settings.cardsPerSession.toString();
    }

    private generateHeatmap(): void {
        const heatmap = document.getElementById('heatmap');
        if (!heatmap) return;

        heatmap.innerHTML = '';
        
        const today = new Date();
        const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);

        for (let i = 0; i < 365; i++) {
            const date = new Date(oneYearAgo.getTime() + i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            const activity = this.userProgress.dailyActivity.get(dateStr) || 0;
            
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            cell.dataset.level = Math.min(4, Math.floor(activity / 5)).toString();
            cell.title = `${dateStr}: ${activity} reviews`;
            
            heatmap.appendChild(cell);
        }
    }

    private toggleSettings(): void {
        const settingsPanel = document.getElementById('settingsPanel');
        const backdrop = document.getElementById('panelBackdrop');
        
        if (settingsPanel) {
            const computedStyle = window.getComputedStyle(settingsPanel);
            const isVisible = computedStyle.display !== 'none' && settingsPanel.style.display !== 'none';
            
            console.log('Settings panel toggle - currently visible:', isVisible);
            
            if (isVisible) {
                this.hideAllPanels();
            } else {
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

    private renderStatistics(): void {
        // Update basic stats
        this.updateStats();
        
        // Generate heatmap
        this.generateHeatmap();
        
        // Render level progress stats
        this.renderLevelProgressStats();
        
        // Update study patterns
        this.updateStudyPatterns();
    }

    private renderLevelProgressStats(): void {
        const container = document.getElementById('levelProgressStats');
        if (!container) return;

        container.innerHTML = '';

        this.levels.forEach(level => {
            const levelElement = document.createElement('div');
            levelElement.className = 'level-stat-item';
            
            const icon = level.isUnlocked ? '🔓' : '🔒';
            const totalCards = level.parts.reduce((sum, part) => sum + part.cards.length, 0);
            const learnedCards = level.parts.reduce((sum, part) => 
                sum + part.cards.filter(card => card.learned).length, 0);
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

    private updateStudyPatterns(): void {
        // Current streak
        const currentStreakEl = document.getElementById('currentStreak');
        if (currentStreakEl) {
            currentStreakEl.textContent = this.userProgress.learningStreak.toString();
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
    }

    private hidePanel(panel: HTMLElement): void {
        panel.classList.add('hide');
        panel.classList.remove('show');
        
        setTimeout(() => {
            panel.style.display = 'none';
            panel.classList.remove('hide');
        }, 300);
    }

    private hideAllPanels(): void {
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

    private showLearningControls(): void {
        const startBtn = document.getElementById('startBtn');
        const learningControls = document.getElementById('learningControls');
        
        if (startBtn) startBtn.style.display = 'none';
        if (learningControls) learningControls.style.display = 'flex';
    }

    private hideLearningControls(): void {
        const startBtn = document.getElementById('startBtn');
        const learningControls = document.getElementById('learningControls');
        
        if (startBtn) startBtn.style.display = 'block';
        if (learningControls) learningControls.style.display = 'none';
    }

    private showLoading(show: boolean): void {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }

    private showError(message: string): void {
        alert(message); // In production, use a proper toast/notification system
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GermanLearningApp();
});
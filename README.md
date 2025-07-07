# DeutschLern - German Learning Tool

A comprehensive Anki-style German learning application built with TypeScript and designed for deployment on Cloudflare Pages.

## Features

- **Spaced Repetition Learning**: Smart algorithm that shows difficult words more frequently
- **A1-B1 Level Support**: Comprehensive vocabulary covering beginner to intermediate levels
- **Bidirectional Learning**: Switch between German→Indonesian and Indonesian→German
- **Voice Pronunciation**: Native German pronunciation using Web Speech API
- **Progress Tracking**: Visual progress bars and completion statistics
- **Learning Heatmap**: GitHub-style activity visualization
- **Responsive Design**: Works seamlessly on mobile, tablet, and desktop
- **Offline Support**: Local storage for progress persistence

## Quick Start

1. **Development Server**:
   ```bash
   npm install
   npm run dev
   ```

2. **Build for Production**:
   ```bash
   npm run build
   ```

3. **Deploy to Cloudflare Pages**:
   ```bash
   npm run deploy
   ```

## Project Structure

```
├── index.html          # Main application
├── styles.css          # Styling and responsive design
├── app.ts              # TypeScript source code
├── app.js              # Compiled JavaScript
├── embed.html          # Embeddable widget
├── package.json        # Dependencies and scripts
├── wrangler.toml       # Cloudflare Pages configuration
└── dataJson/
    └── vocabulary.json  # German vocabulary data
```

## Vocabulary Data Format

The vocabulary is stored in `dataJson/vocabulary.json` with the following structure:

```json
{
  "id": "unique_id",
  "german": "German word",
  "indonesian": "Indonesian translation",
  "level": "A1|A2|B1",
  "type": "noun|verb|adjective|adverb|phrase",
  "difficulty": 1-5
}
```

## Learning Algorithm - FSRS

The app uses the **Free Spaced Repetition Scheduler (FSRS)** algorithm:
- **Advanced memory modeling**: Based on 3-component model (Difficulty, Stability, Retrievability)
- **Adaptive scheduling**: Learns from your memory patterns and optimizes review intervals
- **90% retention target**: Designed to maintain 90% memory retention with optimal efficiency
- **25% fewer reviews**: Reduces review workload compared to traditional SM-2 algorithm
- **Rating system**: 
  - **😵 Very Hard (1)**: Again - Review immediately
  - **😰 Hard (2)**: Hard - Shorter interval with stability adjustment  
  - **🤔 Medium (3)**: Good - Standard interval increase
  - **😊 Easy (4)**: Good - Standard interval increase
  - **😍 Very Easy (5)**: Easy - Longer interval with bonus stability

## Keyboard Shortcuts

- **Space**: Flip card
- **1**: Mark as Hard
- **2**: Mark as Medium  
- **3**: Mark as Easy

## Customization

### Adding New Vocabulary
1. Edit `dataJson/vocabulary.json`
2. Follow the existing format
3. Rebuild the application

### FSRS Algorithm Configuration
The FSRS algorithm is configured with optimal parameters in `app.js`:

```javascript
// FSRS Parameters (21 weights optimized for general learning)
w: [0.2172, 1.1771, 3.2602, 16.1507, 7.0114, 0.57, 2.0966, 0.0069,
    1.5261, 0.112, 1.0178, 1.849, 0.1133, 0.3127, 2.2934, 0.2191,
    3.0004, 0.7536, 0.3332, 0.1437, 0.2],
desired_retention: 0.9,      // 90% retention rate
maximum_interval: 36500,     // ~100 years max
enable_fuzz: true,           // Prevents ease hell
enable_short_term: false     // Focuses on long-term memory
```

### FSRS Features
- **Memory State Tracking**: Each card maintains difficulty (D), stability (S), and retrievability (R)
- **Adaptive Learning**: Algorithm learns from your response patterns to optimize scheduling
- **Scientific Foundation**: Based on cognitive science research and DSR model
- **Efficiency**: Reduces review burden by ~25% compared to traditional algorithms

## Deployment

### Cloudflare Pages
1. Connect your repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set build output directory: `/`
4. Deploy automatically on push

### Manual Deployment
```bash
npx wrangler pages publish --project-name=deutschlern-app
```

## Browser Support

- Chrome/Edge 88+
- Firefox 84+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

## Performance Features

- **Lazy Loading**: Statistics calculated on demand
- **Local Storage**: Persistent progress without server
- **Efficient DOM Updates**: Minimal reflows and repaints
- **Responsive Images**: Optimized for all screen sizes

## License

MIT License - feel free to use for educational purposes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Support

For issues and feature requests, please use the GitHub issues tracker.
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

## Learning Algorithm

The app uses a spaced repetition algorithm:
- **Easy (😊)**: Review in 5+ days
- **Medium (🤔)**: Review in 2-3 days  
- **Hard (😰)**: Review within 1 day

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

### Modifying Difficulty Algorithm
Update the `calculateNextInterval()` method in `app.ts`:

```typescript
private calculateNextInterval(difficulty: number, reviewCount: number): number {
    const baseInterval = 1;
    const multiplier = Math.max(1.3, difficulty * 0.5);
    return Math.round(baseInterval * Math.pow(multiplier, reviewCount - 1));
}
```

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
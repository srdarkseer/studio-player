# 🎵 Studio Player

A professional-grade music player built with Next.js and Web Audio API, featuring real-time audio effects processing, interactive waveform visualization, and a modern user interface.

![Studio Player Screenshot](./docs/screenshot.png)

## ✨ Features

### 🎛️ **Advanced Audio Processing**

- **Real-time Effects**: Reverb, distortion, and harmonic processing
- **3-Band Equalizer**: Professional bass, mid, and treble controls
- **Frequency Filtering**: High-pass and low-pass filters with precise control
- **Playback Control**: Variable speed and pitch adjustment
- **Professional Audio Chain**: EQ → Filters → Distortion → Reverb → Output

### 🎨 **User Interface**

- **Interactive Waveform**: Click-to-seek visualization with real-time progress
- **Responsive Design**: Optimized for desktop and mobile devices
- **Modern UI Components**: Built with Radix UI and Tailwind CSS
- **Accessibility**: Full ARIA support and keyboard navigation
- **Visual Feedback**: Real-time parameter updates and smooth animations

### 🔧 **Technical Excellence**

- **TypeScript**: Fully typed with comprehensive interfaces
- **Performance Optimized**: React hooks optimization and memory management
- **Error Handling**: Graceful degradation and comprehensive logging
- **Browser Compatibility**: Fallbacks for older Web Audio API implementations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- Modern browser with Web Audio API support

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/studio-player.git
cd studio-player

# Install dependencies
npm install
# or
yarn install
# or
pnpm install
```

### Development

```bash
# Start the development server
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Production Build

```bash
# Build for production
npm run build
npm start

# or
yarn build
yarn start
```

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main music player component
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   └── ui/                   # Reusable UI components
│       ├── button.tsx
│       ├── slider.tsx
│       └── card.tsx
├── lib/
│   └── utils.ts              # Utility functions
└── public/
    └── song/                 # Audio files directory
        └── Love Yourz.mp3    # Demo track
```

## 🎵 Audio Setup

### Adding Your Music

1. Place your audio files in the `public/song/` directory
2. Update the audio source in `src/app/page.tsx`:

```typescript
// Update the src attribute in the audio element
<audio
  ref={audioRef}
  src="/song/your-track.mp3" // Change this path
  crossOrigin="anonymous"
  preload="metadata"
  // ... other props
/>
```

3. Update track metadata in the `TRACK_INFO` constant:

```typescript
const TRACK_INFO: Readonly<TrackInfo> = {
  title: "Your Track Title",
  artist: "Artist Name",
  album: "Album Name",
  genre: "Genre",
  duration: "3:45",
  year: 2024,
} as const;
```

### Supported Formats

- **MP3**: Widely supported, recommended for general use
- **WAV**: Uncompressed, highest quality
- **OGG**: Open source format with good compression
- **AAC**: High-quality, modern codec

## 🎛️ Audio Effects Guide

### Playback Controls

| Control   | Range                | Description                             |
| --------- | -------------------- | --------------------------------------- |
| **Speed** | 0.5x - 2.0x          | Playback rate (affects pitch and tempo) |
| **Pitch** | -12 to +12 semitones | Pitch shift without affecting tempo     |

### Equalizer (EQ)

| Band       | Frequency | Range  | Description            |
| ---------- | --------- | ------ | ---------------------- |
| **Bass**   | ~100 Hz   | ±20 dB | Low-frequency content  |
| **Mid**    | ~1000 Hz  | ±20 dB | Mid-range frequencies  |
| **Treble** | ~10000 Hz | ±20 dB | High-frequency content |

### Effects

| Effect         | Range  | Description                         |
| -------------- | ------ | ----------------------------------- |
| **Reverb**     | 0-100% | Adds spatial depth and ambience     |
| **Distortion** | 0-100% | Harmonic distortion for warmth/grit |

### Filters

| Filter        | Range        | Description                      |
| ------------- | ------------ | -------------------------------- |
| **Low Pass**  | 200-20000 Hz | Removes frequencies above cutoff |
| **High Pass** | 20-2000 Hz   | Removes frequencies below cutoff |
| **Gain**      | 0.1x - 3.0x  | Overall signal amplification     |

## 🛠️ Technical Architecture

### Component Structure

```typescript
MusicPlayer/
├── State Management
│   ├── Playback state (play/pause, time, duration)
│   ├── UI state (liked, loading)
│   └── Effects state (all audio parameters)
├── Audio Processing
│   ├── Web Audio API initialization
│   ├── Effects chain construction
│   └── Real-time parameter updates
├── User Interface
│   ├── Track information display
│   ├── Interactive waveform
│   ├── Playback controls
│   └── Effects panel
└── Event Handling
    ├── Audio events (time update, metadata)
    ├── User interactions (seek, effects)
    └── Cleanup and memory management
```

### Audio Processing Chain

```
Audio Input
    ↓
EQ Filters (Bass → Mid → Treble)
    ↓
High Pass Filter
    ↓
Low Pass Filter
    ↓
Distortion (Wave Shaper)
    ↓
Reverb (Dry/Wet Mix)
    ↓
Master Gain
    ↓
Analyser (for visualization)
    ↓
Audio Output
```

### Performance Optimizations

- **React.useCallback**: Prevents unnecessary re-renders of event handlers
- **React.useMemo**: Caches expensive calculations (progress computation)
- **Proper dependency arrays**: Minimizes useEffect executions
- **Memory cleanup**: Cancels animation frames and closes audio contexts
- **Error boundaries**: Graceful handling of Web Audio API failures

## 🌐 Browser Compatibility

| Browser     | Version | Web Audio API   | Notes                     |
| ----------- | ------- | --------------- | ------------------------- |
| **Chrome**  | 60+     | ✅ Full Support | Recommended               |
| **Firefox** | 55+     | ✅ Full Support | Excellent                 |
| **Safari**  | 14+     | ✅ Full Support | Requires user interaction |
| **Edge**    | 79+     | ✅ Full Support | Chromium-based            |

### Known Limitations

- **Safari**: Requires user interaction before audio context can be created
- **Mobile Browsers**: Some effects may have reduced quality on low-end devices
- **Autoplay**: Most browsers block autoplay without user interaction

## 🔧 Configuration

### Audio Settings

Modify `AUDIO_CONFIG` in `src/app/page.tsx`:

```typescript
const AUDIO_CONFIG = {
  FFT_SIZE: 1024, // Frequency analysis resolution
  ANALYSER_SMOOTHING: 0.8, // Waveform smoothing factor
  WAVEFORM_BARS: 200, // Number of waveform bars
  FALLBACK_DURATION: 211, // Fallback duration in seconds
  // ... other settings
};
```

### UI Customization

The application uses Tailwind CSS for styling. Key customization points:

- **Colors**: Modify gradient classes for different themes
- **Layout**: Adjust spacing and sizing in component classes
- **Effects Panel**: Reorganize or add new effect controls

## 🐛 Troubleshooting

### Common Issues

**Audio won't play:**

- Check browser autoplay policies
- Ensure audio file is accessible
- Verify Web Audio API support

**Effects not working:**

- Check browser console for errors
- Ensure audio context is running
- Verify audio chain connections

**Performance issues:**

- Reduce `FFT_SIZE` for lower CPU usage
- Decrease `WAVEFORM_BARS` count
- Disable effects on lower-end devices

### Debug Mode

Enable detailed logging by setting:

```typescript
// Add to component for debugging
useEffect(() => {
  console.log("Audio effects state:", effects);
  console.log("Audio nodes:", audioNodesRef.current);
}, [effects]);
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- **TypeScript**: Maintain strict typing
- **Documentation**: Comment complex audio processing logic
- **Testing**: Test across different browsers and devices
- **Performance**: Profile audio processing performance
- **Accessibility**: Ensure all features are accessible

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Web Audio API**: For powerful audio processing capabilities
- **Radix UI**: For accessible, unstyled UI components
- **Tailwind CSS**: For utility-first CSS framework
- **Lucide Icons**: For beautiful, consistent icons
- **Next.js**: For the React framework and development experience

## 📞 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs on the GitHub issues page
- **Discussions**: Use GitHub Discussions for questions and ideas

---

Built with ❤️ and 🎵 by the Studio Player team

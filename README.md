# IVR Pro Tools

A modern web application for Interactive Voice Response (IVR) content preparation and audio generation. Built with React and Vite, featuring Ukrainian language support and ElevenLabs integration.

## Features

### 🎯 Text Normalization

- **TTS-Optimized Text Processing**: Automatically normalizes Ukrainian text for better speech synthesis
- **Smart Replacements**: Handles currency, units, abbreviations, and technical terms
- **Real-time Preview**: See normalized text instantly as you type

### 📊 Excel Processing

- **Bulk Text Normalization**: Process entire Excel spreadsheets with text normalization
- **Column-Specific Processing**: Target specific columns for TTS preparation
- **Automatic Download**: Get processed files instantly

### 🎵 Audio Generation

- **ElevenLabs Integration**: Generate high-quality voice audio using ElevenLabs API
- **Bulk Processing**: Convert multiple text entries to audio files in ZIP format
- **Voice Customization**: Adjust speed, stability, similarity, and style parameters
- **Ukrainian Language Support**: Optimized for Ukrainian text-to-speech

## Tech Stack

- **Frontend**: React 19 with Vite
- **UI Components**: ShadCN UI with Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React hooks
- **File Processing**: XLSX for Excel handling, JSZip for archives
- **API Integration**: ElevenLabs SDK
- **Styling**: Tailwind CSS with custom animations

## Getting Started

### Prerequisites

- Node.js 18+
- Bun package manager (recommended)
- ElevenLabs API key (for audio features)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd ivr-pro-tools
```

2. Install dependencies:

```bash
bun install
```

3. Create environment file:

```bash
cp .env.example .env.local
```

4. Configure your API keys in `.env.local`:

```env
VITE_ELEVENLABS_API_KEY=your-api-key-here
VITE_ELEVENLABS_VOICE_ID=your-voice-id-here
```

5. Start development server:

```bash
bun run dev
```

### Build for Production

```bash
bun run build
```

## Usage

### Text Normalizer

1. Navigate to the Text Normalizer page
2. Paste your raw text in the input field
3. See the normalized output in real-time
4. Copy the processed text for use

### Excel Normalizer

1. Go to the Excel Normalizer page
2. Upload your Excel file (.xlsx or .xls)
3. The second column will be automatically normalized
4. Download the processed file

### Audio Generator

1. Visit the Excel to Voice page
2. Upload an Excel file with text content
3. Adjust voice parameters (speed, stability, etc.)
4. Configure text normalization settings
5. Generate audio files - they'll download as a ZIP archive

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # ShadCN UI components
│   ├── HomeWelcome.jsx # Homepage welcome section
│   ├── HomeToolGrid.jsx# Homepage tool navigation
│   ├── VoiceSettings.jsx# Audio generation controls
│   └── ...
├── pages/              # Main application pages
├── lib/                # Utilities and helpers
│   ├── normalizeForTTS.js # Text normalization logic
│   └── utils.js        # General utilities
├── router/             # Application routing
└── styles/             # Global styles and animations
```

## Configuration

### Environment Variables

- `VITE_ELEVENLABS_API_KEY`: Your ElevenLabs API key
- `VITE_ELEVENLABS_VOICE_ID`: Voice ID for audio generation

### Text Normalization Options

The normalization function supports various options:

- Currency formatting (грн → гривень)
- Unit pluralization (ГБ → гігабайтів)
- Abbreviation expansion (SMS → есемес)
- Accent marks for proper pronunciation
- Punctuation and spacing cleanup

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Acknowledgments

- [ElevenLabs](https://elevenlabs.io/) for the TTS API
- [ShadCN](https://ui.shadcn.com/) for the UI component library
- [Vite](https://vitejs.dev/) for the build tool

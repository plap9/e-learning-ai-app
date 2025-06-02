# Dependencies Overview

## 📦 Package Dependencies Summary

### 🚀 Monorepo Management
- **pnpm**: Package manager với workspace support
- **pnpm-workspace.yaml**: Cấu hình workspace cho monorepo

### 🔧 Node.js Services Dependencies

#### 1. API Gateway (`@elearning/api-gateway`)
**Production Dependencies:**
- `express`: Web framework
- `cors`: Cross-Origin Resource Sharing
- `helmet`: Security middleware
- `morgan`: HTTP request logger
- `http-proxy-middleware`: API proxying
- `express-rate-limit`: Rate limiting
- `compression`: Response compression
- `express-validator`: Input validation
- `dotenv`: Environment variables
- `winston`: Logging
- `redis`: Redis client
- `jsonwebtoken`: JWT handling
- `swagger-ui-express`: API documentation
- `yamljs`: YAML parser

**Development Dependencies:**
- `typescript`: TypeScript compiler
- `nodemon`: Development server
- `ts-node`: TypeScript execution
- `jest`: Testing framework
- `eslint`: Code linting
- Type definitions cho tất cả production packages

#### 2. User Service (`@elearning/user-service`)
**Additional Dependencies:**
- `bcryptjs`: Password hashing
- `prisma`: Database ORM
- `@prisma/client`: Prisma client
- `nodemailer`: Email sending
- `joi`: Data validation
- `multer`: File uploads
- `sharp`: Image processing
- `uuid`: UUID generation

#### 3. Content Service (`@elearning/content-service`)
**Additional Dependencies:**
- `axios`: HTTP client
- `slugify`: URL-friendly strings
- `markdown-it`: Markdown processing
- `dompurify`: HTML sanitization
- `jsdom`: DOM manipulation
- `node-cron`: Scheduled tasks
- `openai`: OpenAI API client
- `langchain`: LLM framework

#### 4. Payment Service (`@elearning/payment-service`)
**Additional Dependencies:**
- `stripe`: Stripe payments
- `moment`: Date manipulation
- `raw-body`: Raw body parsing

### 🐍 Python Services Dependencies

#### 5. AI Service (`@elearning/ai-service`)
**Core Framework:**
- `fastapi`: Modern Python web framework
- `uvicorn`: ASGI server
- `pydantic`: Data validation

**AI/ML Libraries:**
- `openai`: OpenAI API client
- `langchain`: LLM application framework
- `transformers`: Hugging Face transformers
- `torch`: PyTorch
- `sentence-transformers`: Semantic similarity
- `numpy`, `pandas`, `scikit-learn`: Data science

**Cloud Services:**
- `google-cloud-translate`: Google Translate
- `google-cloud-texttospeech`: Google TTS
- `google-cloud-speech`: Google STT

**Text Processing:**
- `nltk`: Natural Language Toolkit
- `spacy`: Advanced NLP
- `textblob`: Simple text processing

#### 6. Audio Processing Service (`@elearning/audio-processing-service`)
**Audio Libraries:**
- `librosa`: Audio analysis
- `soundfile`: Audio I/O
- `pydub`: Audio manipulation
- `openai-whisper`: Speech recognition
- `speechrecognition`: Speech recognition
- `pyaudio`: Audio I/O

**Pronunciation Analysis:**
- `phonemizer`: Phoneme conversion
- `g2p-en`: Grapheme-to-phoneme
- `epitran`: Pronunciation transcription
- `praat-parselmouth`: Phonetic analysis

**Audio Processing:**
- `webrtcvad`: Voice activity detection
- `noisereduce`: Noise reduction
- `ffmpeg-python`: Audio format conversion

### 📱 Mobile App Dependencies (`@elearning/mobile-app`)

#### Core React Native:
- `expo`: Development platform
- `react-native`: Mobile framework
- `react`: UI library

#### Navigation:
- `@react-navigation/native`: Navigation system
- `@react-navigation/bottom-tabs`: Tab navigation
- `@react-navigation/stack`: Stack navigation
- `@react-navigation/drawer`: Drawer navigation

#### UI & Styling:
- `nativewind`: Tailwind CSS for React Native
- `tailwindcss`: Utility-first CSS
- `react-native-vector-icons`: Icon library
- `react-native-svg`: SVG support
- `lottie-react-native`: Animations

#### State Management & Forms:
- `zustand`: State management
- `react-hook-form`: Form handling
- `zod`: Schema validation
- `react-query`: Data fetching

#### Expo Modules:
- `expo-av`: Audio/Video
- `expo-camera`: Camera access
- `expo-speech`: Text-to-speech
- `expo-notifications`: Push notifications
- `expo-secure-store`: Secure storage
- `expo-file-system`: File system access

### 🔗 Shared Packages

#### 1. Common Types (`@elearning/common-types`)
- TypeScript types và interfaces dùng chung

#### 2. Auth Utils (`@elearning/auth-utils`)
- `jsonwebtoken`: JWT utilities
- `bcryptjs`: Password hashing utilities

#### 3. Logger (`@elearning/logger`)
- `winston`: Structured logging
- `pino`: Fast JSON logger

#### 4. Config Utils (`@elearning/config-utils`)
- `dotenv`: Environment management
- `joi`: Configuration validation
- `redis`: Redis utilities

## 🛠️ Development Tools

### TypeScript Configuration
- `typescript`: ^5.2.2 across all packages
- `ts-node`: Development execution
- `@types/*`: Type definitions

### Testing
- `jest`: Unit testing framework
- `supertest`: HTTP testing
- `pytest`: Python testing
- `@testing-library/react-native`: Mobile testing

### Linting & Formatting
- `eslint`: Code linting
- `@typescript-eslint/*`: TypeScript ESLint
- `black`: Python code formatting
- `flake8`: Python linting
- `isort`: Python import sorting

### Build Tools
- `rimraf`: Cross-platform rm -rf
- `nodemon`: Development server
- `concurrently`: Run multiple commands

## 📊 Installation Summary

### ✅ Successfully Installed
- **Total packages**: 1641 packages installed
- **Node.js services**: 4 services với complete dependencies
- **Python services**: 2 services với AI/ML stack
- **Shared packages**: 4 shared utilities
- **Mobile app**: Complete React Native + Expo setup

### ⚠️ Fixed Issues During Installation
1. **expo-audio**: Removed invalid package version
2. **@types/slugify**: Removed non-existent package
3. **crypto**: Removed redundant built-in module
4. **Deprecated warnings**: Acknowledged for legacy packages

### 🔧 Configuration Files Created
- `tsconfig.json`: TypeScript configuration for all packages
- `nodemon.json`: Development server configuration
- `package.json`: Package definitions for all services
- `requirements.txt`: Python dependencies for AI services

## 🚀 Next Steps

1. **Build shared packages**: `pnpm --filter @elearning/common-types build`
2. **Start development**: `pnpm dev`
3. **Run tests**: `pnpm test`
4. **Build all services**: `pnpm build`

## 📝 Notes

- All packages use **workspace references** (`workspace:*`) for internal dependencies
- **pnpm workspaces** enables efficient dependency management
- **TypeScript strict mode** enabled for all packages
- **ESLint** configured for consistent code style
- **Jest** ready for unit testing
- **GitHub Actions** configured for CI/CD

The dependency setup is complete and ready for development! 🎉 
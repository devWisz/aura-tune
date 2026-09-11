# 🎧 AuraTune Web Studio

**AuraTune Web Studio** is a high-performance, web-based digital signal processing (DSP) dashboard and audio suite designed to elevate your headphone experience (optimized for JBL Tune series and modern audiophile gear).

Combining modern web audio engines, real-time hardware connectivity, and a **Ruby on Rails API backend**, AuraTune turns any browser into a professional audio engine with custom equalization, AI-assisted hearing profiling, software noise masking, 3D spatialization, and cloud preset sync.

---

## 🌟 Key Features & Capabilities

### 🎛️ 1. Advanced Audio Processing Engine (DSP)
* **10-Band Parametric Equalizer**: High-precision frequency shaping using cascading `BiquadFilterNode` filters with controllable frequency, Q-factor, and gain (-24dB to +24dB).
* **Interactive Spline Curve Editor**: Drag-and-drop EQ curve points on an interactive high-DPI canvas with visual frequency response rendering.
* **Custom AudioWorklet Tube Saturator**: Low-latency off-main-thread JavaScript audio processor simulating analog tube warmth, harmonic excitation, and soft-clip limiting.
* **Dynamic Range Compression**: Real-time level management using `DynamicsCompressorNode` to smooth volume spikes and articulate fine acoustic details.
* **3D Spatial Audio & Convolution Reverb**: Environment simulation engine using `ConvolverNode` and `StereoPannerNode` with impulse responses (Concert Hall, Studio, Binaural Room, Cathedral).
* **Peak Limiter & Loudness Normalizer**: Prevents digital clipping and maintains consistent EBU R128 loudness standards across audio tracks.

### 🧠 2. AI Audiogram & Hearing Profile Generator
* **Interactive Frequency Hearing Test**: Automated 8-point frequency audibility test (125Hz - 16kHz) to measure individual left/right ear hearing contours.
* **Equal-Loudness Compensation Curve**: Algorithmically generates a inverse equalization profile tailored to user-specific hearing sensitivity loss.
* **Cloud Profile Persistence**: Automatically saves audiogram profiles to the Ruby backend for instant retrieval on any device.

### ☁️ 3. Cloud Presets & Community Marketplace
* **Cloud Sync via Ruby API**: Save custom EQ settings, noise layers, and spatial parameters to user accounts.
* **Headphone Preset Marketplace**: Discover, rate, and apply community-crafted EQ profiles tailored for specific headphone models (*JBL Tune 750/760NC*, *Sony WH-1000XM5*, *Sennheiser HD600*, *AirPods Max*).
* **One-Click JSON Import / Export**: Share audio configurations instantly via shareable links or standalone JSON files.

### 🔊 4. Procedural Focus Engine & Soundscapes
* **Procedural Color Noise Generator**: Real-time noise synthesis (White, Pink, Brown noise) with adjustable cutoff filters to eliminate workspace distractions.
* **Binaural Beats Engine**: Customizable Delta, Theta, and Alpha wave binaural generator (1Hz - 30Hz carrier offset) for focus, meditation, and deep work.
* **Layerable Ambient Soundscapes**: Blend procedural noise with high-fidelity rain, ocean waves, and fireplace sound samples stored on the Rails Active Storage CDN.

### 📱 5. Hardware Integration & Telemetry
* **Web Bluetooth Control (`navigator.bluetooth`)**: Direct connection to supported Bluetooth audio devices to monitor battery state, RSSI signal strength, and trigger firmware controls.
* **Media Session API**: Deep integration with OS media controls, keyboard hardware hotkeys (Play/Pause, Track Skip), and lock-screen cover art cards.

### 👥 6. Real-Time Collaborative Listening Rooms
* **ActionCable WebSockets Integration**: Create listening rooms where multiple users sync playback position, shared EQ profiles, and real-time audio visualization streams.

### 🎨 7. 60FPS High-Performance Visualizer Suite
* **Multi-Mode Visualizer Engine**: Real-time HTML5 Canvas & WebGL visualizer rendered synchronously via `AnalyserNode` (FFT size 512–16384).
* **Visualization Modes**: 1080p Spectrum Analyzer, Oscilloscope Waveform, Circular Frequency Vortex, and Waterfall Spectrogram.
* **Glassmorphism UI & Dynamic Lighting**: Visualizer colors glow and react dynamically to low-frequency audio transients (bass hits).

---

## 🛠️ Recommended Tech Stack

| Layer | Technology | Purpose & Rationale |
| :--- | :--- | :--- |
| **Backend API** | **Ruby on Rails 8.0 (API Mode)** | High-productivity RESTful API, authentication, preset management, and Active Storage for IR wave assets. |
| **Real-time WebSockets** | **Rails ActionCable + Redis** | Low-latency WebSockets for live room playback synchronization and user telemetry updates. |
| **Database** | **PostgreSQL** | Relational storage for user profiles, audiograms, headphone model metadata, and preset ratings. |
| **Background Processing** | **Sidekiq + Redis** | Asynchronous audio asset processing, spectral analysis caching, and analytics processing. |
| **Frontend Framework** | **Next.js 14+ (App Router) / React 18** | Ultra-responsive UI rendering, modular audio components, server-side asset optimization. |
| **Styling & UI Components**| **Tailwind CSS + Shadcn UI + Lucide** | Modern dark-mode UI with sleek glassmorphism panels tailored for audio DAWs & dashboards. |
| **Audio Core Engine** | **Web Audio API + AudioWorklet** | Hardware-accelerated browser DSP pipeline operating at 44.1kHz / 48kHz audio sampling rates. |
| **Hardware Layer** | **Web Bluetooth API & Media Session** | Low-level peripheral status monitoring and browser-native OS media integration. |
| **State Management** | **Zustand** | Non-blocking, high-frequency parameter store (0ms reaction time for slider adjustments). |

---

## 🏗️ System Architecture

```text
 +-----------------------------------------------------------------------------------+
 |                                   USER BROWSER                                    |
 |                                                                                   |
 |  +-----------------------------------------------------------------------------+  |
 |  |                        Next.js / React Frontend GUI                         |  |
 |  |    (Shadcn UI Controls, 60FPS Canvas Visualizer, Spline EQ Curve Editor)    |  |
 |  +---------------------------------------+-------------------------------------+  |
 |                                          |                                        |
 |                                          v                                        |
 |  +-----------------------------------------------------------------------------+  |
 |  |                            Zustand State Store                              |  |
 |  |     (Real-Time Param State, Active Preset, Volume, Bluetooth Metrics)      |  |
 |  +---------------+-----------------------+---------------------+---------------+  |
 |                  |                       |                     |                  |
 |                  v                       v                     v                  |
 |  +---------------+-------+   +-----------+----------+   +------+---------------+  |
 |  | Audio Engine Manager  |   | Hardware Controller  |   | ActionCable WS Client|  |
 |  |  (Web Audio Context)  |   |   (Web Bluetooth)    |   |  (Room Sync / Live)  |  |
 |  +---------------+-------+   +-----------+----------+   +------+---------------+  |
 +------------------|-----------------------|---------------------|------------------+
                    |                       |                     |
                    | (DSP Pipeline)        | (Battery / RSSI)    | (WebSockets)
                    v                       v                     v
 +------------------+-----------------------+---------------------+------------------+
 |                            WEB AUDIO DSP PIPELINE NODE GRAPH                      |
 |                                                                                   |
 |  [ Audio Stream ] ---> [ 10-Band Biquad EQ ] ---> [ AudioWorklet Saturator ]     |
 |                                                               |                   |
 |  [ Audio Destination ] <-- [ Analyser Node ] <-- [ 3D Spatial ] <-- [ Compressor ]|
 +-----------------------------------------------------------------------------------+
                                                                  ^
                                                                  | HTTP API / WS
                                                                  v
 +-----------------------------------------------------------------------------------+
 |                               RUBY ON RAILS BACKEND API                           |
 |                                                                                   |
 |  +--------------------+   +---------------------+   +--------------------------+  |
 |  |  Rails API Controllers|   | ActionCable Server  |   |  Active Storage (CDN)    |  |
 |  | (Auth, Presets, AI) |   | (Live Room Channel) |   | (Impulse Response Files) |  |
 |  +---------+----------+   +----------+----------+   +------------+-------------+  |
 |            |                         |                           |                |
 |            +-------------------------+---------------------------+                |
 |                                      |                                            |
 |                                      v                                            |
 |             +------------------------+-------------------------+                  |
 |             | PostgreSQL (Users, Audiograms, Presets, Ratings) |                  |
 |             +--------------------------------------------------+                  |
 +-----------------------------------------------------------------------------------+
```

---

## 📦 Project Structure

```text
aura-tune/
├── backend/                        # Ruby on Rails API Backend
│   ├── app/
│   │   ├── channels/               # ActionCable WebSockets channels (RoomChannel)
│   │   ├── controllers/api/v1/     # REST Controllers (Presets, Audiograms, Headphones)
│   │   ├── models/                 # ActiveRecord Models (User, Preset, Audiogram)
│   │   ├── services/               # Audio Processing & AI Recommendation Engines
│   │   └── uploaders/              # ActiveStorage Impulse Response Uploaders
│   ├── config/                     # Rails routes, CORS, database.yml
│   ├── db/                         # PostgreSQL Migrations & Seeds (Headphone DB)
│   ├── Gemfile                     # Ruby Gems (rails, devise-jwt, sidekiq, redis)
│   └── Rakefile
│
├── frontend/                       # Next.js 14+ / React Frontend
│   ├── public/
│   │   ├── impulse-responses/      # Local fallback IR audio files (.wav)
│   │   └── worklets/               # AudioWorklet JS scripts (saturator.js)
│   ├── src/
│   │   ├── app/                    # Next.js App Router pages
│   │   │   ├── dashboard/          # Main Audio Studio Dashboard
│   │   │   ├── marketplace/        # Community Preset Directory
│   │   │   └── hearing-test/       # AI Audiogram Test Wizard
│   │   ├── components/             # Reusable UI Components
│   │   │   ├── Equalizer.tsx       # 10-Band EQ Controls & Spline Canvas
│   │   │   ├── Visualizer.tsx      # 60FPS Spectrum Analyzer
│   │   │   ├── NoiseGenerator.tsx  # Focus Noise & Binaural Synth
│   │   │   ├── BluetoothCard.tsx   # Device Connectivity Widget
│   │   │   └── RoomSyncCard.tsx    # Live WebSocket Listening Room
│   │   ├── hooks/                  # Custom React Hooks
│   │   │   ├── useAudioContext.ts  # Web Audio API lifecycle manager
│   │   │   ├── useBluetooth.ts     # Web Bluetooth connection hook
│   │   │   └── useActionCable.ts   # Real-time WebSocket hook
│   │   ├── lib/audio/              # Web Audio Engine & DSP Nodes
│   │   │   ├── audioEngine.ts      # Core audio routing graph
│   │   │   ├── biquadFilterBank.ts # 10-Band EQ node generator
│   │   │   ├── noiseSynthesizer.ts # Procedural noise algorithms
│   │   │   └── spatializer.ts      # 3D Panner & Convolver Reverb
│   │   └── store/                  # Zustand Parameter Stores
│   │       └── useAudioStore.ts    # Global audio & preset state
│   ├── package.json
│   └── tailwind.config.js
│
└── README.md
```

---

## ⚡ Quick Start Guide

### Prerequisites
* **Ruby**: 3.3.0+
* **Rails**: 8.0+ / 7.1+
* **Node.js**: 20.x+
* **PostgreSQL**: 15+
* **Redis**: 7+ (for ActionCable & Sidekiq)

---

### 1. Backend Setup (Ruby on Rails)

```bash
# Navigate to backend directory
cd backend

# Install Gem dependencies
bundle install

# Setup PostgreSQL Database
rails db:create db:migrate db:seed

# Start Redis server (in a separate terminal)
redis-server

# Start Rails API Server
rails server -p 3000
```

---

### 2. Frontend Setup (Next.js)

```bash
# Navigate to frontend directory
cd frontend

# Install Node packages
npm install

# Start Next.js Development Server
npm run dev
```

Open `http://localhost:3001` in your Chrome/Brave browser to launch **AuraTune Web Studio**.

---

## 🛡️ Browser Compatibility

| Feature | Chrome / Brave / Edge | Firefox | Safari |
| :--- | :---: | :---: | :---: |
| **Web Audio API Engine** | ✅ Full | ✅ Full | ✅ Full |
| **AudioWorklet DSP** | ✅ Full | ✅ Full | ✅ Full |
| **Web Bluetooth API** | ✅ Native (Flags enabled) | ⚠️ Experimental | ❌ Not Supported |
| **Media Session API** | ✅ Full | ✅ Full | ✅ Full |

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

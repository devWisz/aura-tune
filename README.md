# 🎧 AuraTune Web Studio

**AuraTune Web Studio** is a web-based digital signal processing (DSP) dashboard and audio suite, **built and tuned specifically for the JBL Tune 730BT**. Other headphones are supported through fallback correction profiles, but every default in this build — the EQ curve, the preset library, the crossfeed amount, the masking noise — is chosen for that one model.

Combining modern web audio engines, real-time hardware connectivity, and a **Ruby on Rails API backend**, AuraTune turns any browser into a professional audio engine with custom equalization, AI-assisted hearing profiling, software noise masking, 3D spatialization, and cloud preset sync.

---

## 🎧 Tuned for the JBL Tune 730BT

| Spec | Value |
| --- | --- |
| Driver | 40 mm dynamic |
| Impedance | 32 Ω |
| Rated response | 20 Hz – 20 kHz |
| Bluetooth | 6.0 / LE Audio |
| Codecs | SBC · AAC · LC3 |
| Battery | 76 h (5 min charge → 5 h) |
| Noise control | **Passive isolation only — no ANC** |
| Weight | 218 g, foldable |

Two facts about this headphone drive most of the defaults:

**It ships with the JBL "Pure Bass" curve.** There is a large shelf around
60–125 Hz, a scooped 1–2 kHz, and a hot region near 8 kHz. The house correction
(`730BT Reference`) is a rough inverse of that: it cuts the mid-bass bloom,
restores the mids, and softens the treble peak. Because that curve is almost all
cut, the auto-gain stage adds make-up gain so applying it does not simply sound
quieter than bypass. Presets that *add* bass add it at 31 Hz — sub-bass the
40 mm driver genuinely lacks — rather than at 125 Hz, where it already has too
much.

**It has no active noise cancelling.** The Focus Engine's procedural masking
noise is the substitute, and the `Commute (no ANC)` preset cuts the low end that
street rumble already masks instead of fighting it.

### Connecting them

The browser cannot pair a Bluetooth headphone — pairing belongs to the operating
system. The flow is:

1. Hold the 730BT's power button ~5 s until the LED flashes.
2. Pair it in your OS Bluetooth settings.
3. Select **JBL Tune 730BT** in the studio's device panel. The DSP chain is
   re-routed to it via `setSinkId`, and the house tuning is applied automatically
   the first time it is seen.

Device names are hidden by browsers until the page holds an audio permission, so
the panel offers a one-shot microphone grant to reveal them; the track is stopped
immediately and nothing is recorded.

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
* **Preset Library**: Eight tunings built on the 730BT correction baseline — Reference, Stock Pure Bass, Sub Extension, Voice & Podcast, Commute (no ANC), Gaming Positional, Late Night and Acoustic & Live — plus fallback profiles for *Sony WH-1000XM5*, *Sennheiser HD600* and *AirPods Max*.
* **One-Click JSON Import / Export**: Share audio configurations instantly via shareable links or standalone JSON files.

### 🔊 4. Procedural Focus Engine & Soundscapes
* **Procedural Color Noise Generator**: Real-time noise synthesis (White, Pink, Brown noise) with adjustable cutoff filters to eliminate workspace distractions.
* **Binaural Beats Engine**: Customizable Delta, Theta, and Alpha wave binaural generator (1Hz - 30Hz carrier offset) for focus, meditation, and deep work.
* **Layerable Ambient Soundscapes**: Blend procedural noise with high-fidelity rain, ocean waves, and fireplace sound samples stored on the Rails Active Storage CDN.

### 📱 5. Hardware Integration & Telemetry
* **Output routing (`AudioContext.setSinkId`)**: Re-targets the rendered DSP chain at the 730BT specifically, so the corrected signal lands on the headphones rather than the laptop speakers. This is what actually "connects" them.
* **Web Bluetooth battery telemetry (`navigator.bluetooth`)**: The 730BT is an LE Audio headphone, so it can expose battery level over the standard BLE GATT battery service while advertising. Strictly a side channel — Web Bluetooth cannot carry audio, which the operating system owns over A2DP.
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

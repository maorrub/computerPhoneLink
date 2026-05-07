import { motion, AnimatePresence } from "motion/react";
import { 
  Cpu, 
  MousePointer2, 
  Keyboard, 
  Video, 
  Volume2, 
  ArrowRightLeft, 
  Code2, 
  Layers,
  Terminal,
  Zap,
  ChevronRight
} from "lucide-react";
import { useState } from "react";

// --- Types ---
type Section = 'overview' | 'header' | 'video' | 'audio' | 'control';

interface SpecSection {
  id: Section;
  title: string;
  icon: typeof Video;
  description: string;
}

const SECTIONS: SpecSection[] = [
  { id: 'overview', title: 'Architecture', icon: Cpu, description: 'System overview and ADB transport layer.' },
  { id: 'header', title: 'Message Header', icon: Layers, description: 'Packet encapsulation and framing.' },
  { id: 'video', title: 'Video Stream', icon: Video, description: 'H.264 Annex-B packetization.' },
  { id: 'audio', title: 'Audio Stream', icon: Volume2, description: 'PCM/Opus audio buffer transport.' },
  { id: 'control', title: 'Input Events', icon: MousePointer2, description: 'Mouse and Keyboard control protocol.' },
];

// --- Components ---

const ByteBox = ({ label, size, color = "bg-sky-500/20" }: { label: string, size: string, color?: string }) => (
  <div className={`flex flex-col items-center justify-center p-2 border border-sky-500/30 ${color} rounded-sm min-h-[60px] flex-grow basis-0`}>
    <span className="text-[10px] font-mono opacity-60 uppercase mb-1">{size}</span>
    <span className="text-xs font-mono font-bold text-sky-400">{label}</span>
  </div>
);

const PacketDiagram = ({ bytes }: { bytes: { label: string, size: string, color?: string }[] }) => (
  <div className="flex gap-1 w-full overflow-x-auto pb-4 pt-2">
    {bytes.map((b, i) => (
      <ByteBox key={i} {...b} />
    ))}
  </div>
);

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  return (
    <div className="min-h-screen technical-grid font-sans selection:bg-brand-primary/30">
      {/* Navigation Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-72 glass-panel border-r hidden lg:flex flex-col p-6 z-50">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-brand-primary rounded flex items-center justify-center">
            <Zap className="text-white w-5 h-5" />
          </div>
          <h1 className="font-display font-bold text-xl tracking-tight text-white">DroidLink <span className="text-xs font-mono text-brand-primary">v1.2</span></h1>
        </div>

        <nav className="flex-1 space-y-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 group ${
                activeSection === s.id 
                  ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/20" 
                  : "text-neutral-500 hover:text-neutral-200 hover:bg-white/5"
              }`}
            >
              <s.icon className={`w-4 h-4 ${activeSection === s.id ? "text-brand-primary" : "text-neutral-500 group-hover:text-neutral-300"}`} />
              <span className="font-medium">{s.title}</span>
              {activeSection === s.id && (
                <motion.div layoutId="active-indicator" className="ml-auto">
                   <ChevronRight className="w-3 h-3" />
                </motion.div>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4 rounded-xl bg-sky-950/20 border border-sky-400/10">
          <p className="text-[10px] font-mono text-neutral-500 uppercase mb-2">Protocol Health</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">Ready for Implementation</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-72 min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-12 lg:py-20 lg:px-12">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {activeSection === 'overview' && (
                <article className="prose prose-invert max-w-none">
                  <header className="mb-12">
                    <div className="flex items-center gap-2 text-brand-primary mb-4">
                      <Terminal className="w-5 h-5" />
                      <span className="text-sm font-mono tracking-widest uppercase">Specification Guide</span>
                    </div>
                    <h2 className="text-4xl font-display font-extrabold text-white mb-6 leading-tight">
                      System Architecture & <br/><span className="text-brand-primary">Transport Layer</span>
                    </h2>
                    <p className="text-lg text-neutral-400 leading-relaxed">
                      DroidLink utilizes a duplex communication channel established via ADB Port Forwarding. 
                      The protocol is designed for sub-100ms latency, favoring raw byte-streams over serialization formats like JSON.
                    </p>
                  </header>

                  <section className="space-y-8">
                    <div className="glass-panel rounded-2xl p-6 border-l-4 border-l-brand-primary">
                      <h4 className="flex items-center gap-2 text-white font-bold mb-3">
                        <ArrowRightLeft className="w-4 h-4 text-brand-primary" />
                        ADB Port Forwarding
                      </h4>
                      <p className="text-sm text-neutral-400">
                        The connection relies on <code className="text-sky-300">adb reverse</code> and <code className="text-sky-300">adb forward</code> to tunnel TCP sockets through the USB debug cable.
                      </p>
                      <pre className="bg-black/50 p-4 rounded-lg text-xs font-mono text-emerald-400 border border-neutral-800">
                        $ adb forward tcp:8080 tcp:8080 # Laptop to Phone{"\n"}
                        $ adb reverse tcp:9090 tcp:9090 # Phone to Laptop (Audio/Video)
                      </pre>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-5 glass-panel rounded-xl">
                        <p className="text-xs font-mono text-sky-400 uppercase mb-2">Downlink (Input)</p>
                        <ul className="text-sm text-neutral-400 space-y-2">
                          <li>• Mouse Actions (Click, Move, Scroll)</li>
                          <li>• Keyboard Buffer (Unicode)</li>
                          <li>• System Commands (Home, Back, Recents)</li>
                        </ul>
                      </div>
                      <div className="p-5 glass-panel rounded-xl">
                        <p className="text-xs font-mono text-rose-400 uppercase mb-2">Uplink (Feedback)</p>
                        <ul className="text-sm text-neutral-400 space-y-2">
                          <li>• H.264 Video stream frame-by-frame</li>
                          <li>• 16-bit PCM Audio stream</li>
                          <li>• Device Orientation/Screen metadata</li>
                        </ul>
                      </div>
                    </div>
                  </section>
                </article>
              )}

              {activeSection === 'header' && (
                <article className="prose prose-invert max-w-none">
                  <header className="mb-12">
                    <h2 className="text-4xl font-display font-extrabold text-white mb-6">Message Framing</h2>
                    <p className="text-lg text-neutral-400 leading-relaxed">
                      Every packet sent over the socket must start with a standardized 12-byte header. This allows the receiver to stay synchronized even if the stream fragments.
                    </p>
                  </header>

                  <div className="space-y-10">
                    <div>
                      <h4 className="text-sm font-mono text-neutral-500 uppercase mb-4">Header Byte Layout (12 Bytes Total)</h4>
                      <PacketDiagram bytes={[
                        { label: 'MAGIC', size: '4B', color: 'bg-emerald-500/20' },
                        { label: 'TYPE', size: '1B', color: 'bg-brand-primary/20' },
                        { label: 'FLAGS', size: '1B', color: 'bg-brand-primary/20' },
                        { label: 'VERSION', size: '2B', color: 'bg-neutral-500/10' },
                        { label: 'PAYLOAD', size: '4B', color: 'bg-rose-500/20' },
                      ]} />
                    </div>

                    <div className="glass-panel rounded-xl overflow-hidden border-neutral-800">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white/5 border-b border-neutral-800">
                              <th className="p-4 text-xs font-mono text-neutral-400 uppercase">Field</th>
                              <th className="p-4 text-xs font-mono text-neutral-400 uppercase">Size</th>
                              <th className="p-4 text-xs font-mono text-neutral-400 uppercase">Value / Description</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm">
                            <tr className="border-b border-neutral-800">
                              <td className="p-4 font-mono text-emerald-400">Magic</td>
                              <td className="p-4 text-neutral-500">4 Bytes</td>
                              <td className="p-4 text-neutral-300"><code className="bg-black/40 px-2 py-0.5 rounded">0x44 0x4C 0x4E 0x4B</code> (ASCII "DLNK")</td>
                            </tr>
                            <tr className="border-b border-neutral-800">
                              <td className="p-4 font-mono text-sky-400">Type</td>
                              <td className="p-4 text-neutral-500">1 Byte</td>
                              <td className="p-4 text-neutral-300">0: Video, 1: Audio, 2: Input, 3: Meta</td>
                            </tr>
                            <tr className="border-b border-neutral-800">
                              <td className="p-4 font-mono text-sky-400">Flags</td>
                              <td className="p-4 text-neutral-500">1 Byte</td>
                              <td className="p-4 text-neutral-300">Bit 0: Keyframe, Bit 1: Compressed</td>
                            </tr>
                            <tr>
                              <td className="p-4 font-mono text-rose-400">Length</td>
                              <td className="p-4 text-neutral-500">4 Bytes</td>
                              <td className="p-4 text-neutral-300">Unsigned Big-Endian Int. Length of ensuing payload.</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {activeSection === 'video' && (
                <article className="prose prose-invert max-w-none">
                  <header className="mb-12">
                    <h2 className="text-4xl font-display font-extrabold text-white mb-6">Video Pipeline</h2>
                    <p className="text-neutral-400">
                      The Android device encodes its screen using the <code className="text-sky-300">MediaCodec</code> API to an H.264 elementary stream (Annex-B).
                    </p>
                  </header>

                  <div className="grid md:grid-cols-2 gap-6 my-8">
                    <div className="p-6 glass-panel rounded-2xl">
                      <div className="w-10 h-10 bg-sky-500/20 rounded-lg flex items-center justify-center mb-4">
                        <Layers className="text-sky-400 w-5 h-5" />
                      </div>
                      <h4 className="text-white font-bold mb-2">Annex-B Format</h4>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Data must be prefixed with start codes <code className="text-sky-300">0x00 00 00 01</code>.
                        All NAL units (PPS, SPS, I-Frame, P-Frame) are wrapped in the DLNK header with Type=0.
                      </p>
                    </div>
                    <div className="p-6 glass-panel rounded-2xl">
                      <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center mb-4">
                        <Terminal className="text-amber-400 w-5 h-5" />
                      </div>
                      <h4 className="text-white font-bold mb-2">Electron Playback</h4>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        Use <code className="text-sky-300"> Broadway.js</code> or <code className="text-sky-300">jmuxer</code> 
                        to feed the H.264 stream into a canvas or video element without overhead.
                      </p>
                    </div>
                  </div>

                  <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
                    <h5 className="text-xs font-mono text-neutral-500 uppercase mb-4">Video Configuration Packet</h5>
                    <div className="space-y-2">
                       <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-sky-400">0-4:</span> <span>Width (Uint32)</span>
                       </div>
                       <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-sky-400">4-8:</span> <span>Height (Uint32)</span>
                       </div>
                       <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
                          <span className="text-sky-400">8-16:</span> <span>Presentation Timestamp (Uint64, ms)</span>
                       </div>
                    </div>
                  </div>
                </article>
              )}

              {activeSection === 'control' && (
                <article className="prose prose-invert max-w-none">
                  <header className="mb-12">
                    <h2 className="text-4xl font-display font-extrabold text-white mb-6">Input Event Serializer</h2>
                    <p className="text-neutral-400 leading-relaxed">
                      To minimize overhead, input events are binary packed. Coordinates are normalized to a 0.0 - 1.0 range based on the laptop's UI frame, then mapped to absolute pixels on Android.
                    </p>
                  </header>

                  <div className="space-y-8">
                    <div className="glass-panel p-6 rounded-2xl">
                       <h5 className="text-white font-bold mb-4 flex items-center gap-2">
                         <MousePointer2 className="w-4 h-4 text-brand-primary" />
                         Mouse Payload Structure (10 Bytes)
                       </h5>
                       <PacketDiagram bytes={[
                          { label: 'ACTION', size: '1B', color: 'bg-emerald-500/20' },
                          { label: 'BUTTON', size: '1B', color: 'bg-emerald-500/20' },
                          { label: 'X_NORM', size: '4B', color: 'bg-sky-500/20' },
                          { label: 'Y_NORM', size: '4B', color: 'bg-sky-500/20' },
                       ]} />
                       <div className="grid grid-cols-2 gap-4 mt-6 text-xs font-mono">
                          <div>
                            <p className="text-brand-primary mb-1">Actions:</p>
                            <ul className="text-neutral-500 space-y-1">
                              <li>0x00: DOWN</li>
                              <li>0x01: UP</li>
                              <li>0x02: MOVE</li>
                              <li>0x03: SCROLL</li>
                            </ul>
                          </div>
                          <div>
                            <p className="text-brand-primary mb-1">Normalization:</p>
                            <p className="text-neutral-400">
                              X_NORM = (pageX / width) * 65535{"\n"}
                              Packed as 32bit Float.
                            </p>
                          </div>
                       </div>
                    </div>

                    <div className="glass-panel p-6 rounded-2xl">
                       <h5 className="text-white font-bold mb-4 flex items-center gap-2">
                         <Keyboard className="w-4 h-4 text-rose-400" />
                         Keyboard Payload
                       </h5>
                       <p className="text-sm text-neutral-400 mb-4">
                         Android <code>InputManager</code> is used to inject key events. We use UTF-8 strings for text and raw Android KeyCodes for special keys.
                       </p>
                       <pre className="bg-black/50 p-4 rounded-lg text-xs font-mono text-emerald-400 border border-neutral-800">
                        Type: 2 (Input) | Flag: 0x01 (Key){"\n"}
                        Payload: [Uint16 KeyCode] [Uint16 MetaState (Shift/Ctrl)]
                       </pre>
                    </div>
                  </div>
                </article>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Action Button for Contact/Export */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3">
        <button className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-lg shadow-brand-primary/20 hover:scale-110 transition-transform cursor-pointer">
          <Code2 className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}


import { useEffect, useState, useCallback } from "react";
import { Volume2, Loader2 } from "lucide-react";

type VoiceSelectorProps = {
  selectedVoiceName?: string;
  onChange: (name: string) => void;
};

export function VoiceSelector({ selectedVoiceName, onChange }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingVoice, setSpeakingVoice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function loadVoices() {
      const all = window.speechSynthesis.getVoices();
      const enVoices = all.filter((v) => v.lang.startsWith("en"));
      setVoices(enVoices);
      setLoading(false);
    }

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const playVoice = useCallback((voice: SpeechSynthesisVoice) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Hello, this is a test.");
    utterance.voice = voice;
    utterance.rate = 0.95;
    setSpeakingVoice(voice.name);
    utterance.onend = () => setSpeakingVoice(null);
    utterance.onerror = () => setSpeakingVoice(null);
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopVoice = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeakingVoice(null);
  }, []);

  if (loading) {
    return (
      <div className="voice-selector-loading">
        <Loader2 size={16} className="spin" />
        <span>Loading voices...</span>
      </div>
    );
  }

  return (
    <div className="voice-selector">
      <div className="voice-list">
        <label className="voice-item">
          <input
            type="radio"
            name="tts-voice"
            value=""
            checked={!selectedVoiceName}
            onChange={() => onChange("")}
          />
          <span className="voice-label">Default</span>
          <button
            className="voice-play-btn"
            type="button"
            onClick={() => {
              window.speechSynthesis.cancel();
              const utt = new SpeechSynthesisUtterance("Hello, this is a test.");
              utt.rate = 0.95;
              setSpeakingVoice("__default__");
              utt.onend = () => setSpeakingVoice(null);
              utt.onerror = () => setSpeakingVoice(null);
              window.speechSynthesis.speak(utt);
            }}
            title="Preview default voice"
          >
            {speakingVoice === "__default__" ? (
              <span className="voice-stop-icon" onClick={stopVoice}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              </span>
            ) : (
              <Volume2 size={13} strokeWidth={2.2} />
            )}
          </button>
        </label>
        {voices.map((voice) => (
          <label key={voice.name} className="voice-item">
            <input
              type="radio"
              name="tts-voice"
              value={voice.name}
              checked={selectedVoiceName === voice.name}
              onChange={() => onChange(voice.name)}
            />
            <span className="voice-label">
              {voice.name}
              <small className="voice-lang">{voice.lang}</small>
            </span>
            <button
              className="voice-play-btn"
              type="button"
              onClick={() => playVoice(voice)}
              title={`Preview ${voice.name}`}
            >
              {speakingVoice === voice.name ? (
                <span className="voice-stop-icon" onClick={stopVoice}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                </span>
              ) : (
                <Volume2 size={13} strokeWidth={2.2} />
              )}
            </button>
          </label>
        ))}
      </div>
    </div>
  );
}
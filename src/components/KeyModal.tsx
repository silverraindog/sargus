import React, { useState } from 'react';
import { Key, CheckCircle, ShieldAlert, X, ExternalLink, ShieldCheck } from 'lucide-react';

interface KeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKey: string;
  onSaveKey: (key: string) => void;
}

export const KeyModal: React.FC<KeyModalProps> = ({ isOpen, onClose, currentKey, onSaveKey }) => {
  const [inputKey, setInputKey] = useState(currentKey || '');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setErrorMsg('Please enter a valid Torn API key');
      return;
    }
    if (inputKey.length < 8) {
      setErrorMsg('Torn API key should be at least 16 characters long');
      return;
    }
    setErrorMsg('');
    onSaveKey(inputKey.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center shrink-0">
            <Key className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Setup Your Torn API Key</h3>
            <p className="text-xs text-slate-400">Enter your key to load your live stats &amp; scout targets privately</p>
          </div>
        </div>

        {/* Security & Privacy Callout */}
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2 mb-4">
          <div className="flex items-center gap-2 font-semibold text-emerald-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Secure &amp; Private Key Handling</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Your API Key is saved <strong>only inside your browser's local storage</strong>. It is never stored on external servers or shared with other users.
          </p>
          <a
            href="https://www.torn.com/preferences.php#tab=api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-red-400 hover:underline font-mono text-[11px] font-bold"
          >
            Get your API Key from Torn Preferences <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1">
              Your Torn API Key (Minimal / Public Access)
            </label>
            <input
              type="text"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Paste your 16-character Torn API key here..."
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
              autoFocus
            />
            {errorMsg && (
              <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                {errorMsg}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-xs font-extrabold shadow-lg shadow-red-950/60 border border-red-500/40 flex items-center gap-2 transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              Save &amp; Start Scouting
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

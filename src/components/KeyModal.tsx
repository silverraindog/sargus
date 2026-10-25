import React, { useState } from 'react';
import { Key, CheckCircle, ShieldAlert, X, ExternalLink } from 'lucide-react';
import { DEMO_API_KEY } from '../services/tornApi';

interface KeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentKey: string;
  onSaveKey: (key: string) => void;
}

export const KeyModal: React.FC<KeyModalProps> = ({ isOpen, onClose, currentKey, onSaveKey }) => {
  const [inputKey, setInputKey] = useState(currentKey || DEMO_API_KEY);
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

  const handleUseDemoKey = () => {
    setInputKey(DEMO_API_KEY);
    setErrorMsg('');
    onSaveKey(DEMO_API_KEY);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl text-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Key className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Torn API Authentication</h3>
            <p className="text-xs text-slate-400">Authenticate to query live player profiles & target battle stats</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1">
              Your Torn API Key (Public / Minimal Permission)
            </label>
            <input
              type="text"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="e.g. KS2IeiX56Cl52z3B"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-red-500 transition-colors"
            />
            {errorMsg && (
              <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                {errorMsg}
              </p>
            )}
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span>Quick Demo Key</span>
              <button
                type="button"
                onClick={handleUseDemoKey}
                className="px-2.5 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded font-mono font-medium transition-colors"
              >
                Use Example Key ("KS2IeiX56Cl52z3B")
              </button>
            </div>
            <p>
              Your key is saved locally in your browser storage. Require minimum <strong>Public Access</strong> selection in Torn City settings.
            </p>
            <a
              href="https://www.torn.com/preferences.php#tab=api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-red-400 hover:underline text-xs"
            >
              Get API Key from Torn Settings <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition-colors flex items-center gap-2 shadow-lg shadow-red-950/50"
            >
              <CheckCircle className="w-4 h-4" />
              Save &amp; Authenticate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

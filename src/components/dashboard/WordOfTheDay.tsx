'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, Sparkles, RefreshCw, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Vocabulary } from '@/types';

interface WordOfTheDayProps {
  vocabularies: Vocabulary[];
}

export function WordOfTheDay({ vocabularies }: WordOfTheDayProps) {
  const [currentWord, setCurrentWord] = useState<Vocabulary | null>(null);

  useEffect(() => {
    if (vocabularies.length > 0) {
      // Pick cumbersome or random
      const cumbersome = vocabularies.find((v) => v.word.toLowerCase() === 'cumbersome');
      if (cumbersome) {
        setCurrentWord(cumbersome);
      } else {
        const random = vocabularies[Math.floor(Math.random() * vocabularies.length)];
        setCurrentWord(random);
      }
    }
  }, [vocabularies]);

  const handleShuffle = () => {
    if (vocabularies.length > 0) {
      const nextIndex = Math.floor(Math.random() * vocabularies.length);
      setCurrentWord(vocabularies[nextIndex]);
    }
  };

  const handleSpeak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!currentWord) return null;

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 p-6 rounded-2xl text-white shadow-xl border border-slate-800 relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </span>
          <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">
            Word of the Day
          </h3>
        </div>
        <button
          onClick={handleShuffle}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Randomize word"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline space-x-3">
          <h2 className="text-2xl font-bold tracking-wide text-white">{currentWord.word}</h2>
          {currentWord.phonetic && (
            <span className="text-sm font-mono text-indigo-300">{currentWord.phonetic}</span>
          )}
          <button
            onClick={() => handleSpeak(currentWord.word)}
            className="p-1.5 text-slate-400 hover:text-indigo-300 rounded-full hover:bg-slate-800 transition-colors"
            title="Listen Pronunciation"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 capitalize">
          {currentWord.wordType} • {currentWord.level || 'IELTS 7.0+'}
        </div>

        <div className="pt-2 border-t border-slate-800">
          <p className="text-sm font-medium text-emerald-400">
            Meaning: <span className="text-white">{currentWord.meaning}</span>
          </p>
          {currentWord.example && (
            <p className="text-xs text-slate-300 mt-2 italic bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
              &quot;{currentWord.example}&quot;
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Link
          href="/study"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-indigo-300 hover:text-white transition-colors"
        >
          <span>Start Spaced Repetition Study</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

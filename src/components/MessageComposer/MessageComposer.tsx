import { useState, useRef, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import styles from './MessageComposer.module.css';

export function MessageComposer() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isGenerating = useChatStore((s) => s.isGenerating);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isGenerating) return;
    sendMessage(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.composer}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message AJAWAI…"
          rows={1}
          disabled={isGenerating}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!text.trim() || isGenerating}
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>
      <p className={styles.hint}>AJAWAI 2.1 — STEP-3-VL-10B · Q4 · Memory-first</p>
    </div>
  );
}

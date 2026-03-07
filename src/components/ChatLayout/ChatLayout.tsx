import { useChatStore } from '../../store/chatStore';
import { ChatBubble } from '../ChatBubble';
import { MessageComposer } from '../MessageComposer';
import { DebugPanel } from '../DebugPanel';
import { WelcomeScreen } from './WelcomeScreen';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import styles from './ChatLayout.module.css';

export function ChatLayout() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeConversationId);
  const isGenerating = useChatStore((s) => s.isGenerating);

  const activeConversation = conversations.find((c) => c.id === activeId);
  const messages = activeConversation?.messages ?? [];

  const scrollRef = useAutoScroll([messages.length, isGenerating]);

  return (
    <div className={styles.layout}>
      <div className={styles.messages} ref={scrollRef}>
        {messages.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <div className={styles.messageList}>
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            {isGenerating && (
              <div className={styles.typing}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            )}
          </div>
        )}
      </div>
      <DebugPanel />
      <MessageComposer />
    </div>
  );
}

import { Bot, User } from 'lucide-react';
import clsx from 'clsx';
import type { Message } from '../../lib/types';
import styles from './ChatBubble.module.css';

interface Props {
  message: Message;
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={clsx(styles.row, isUser && styles.userRow)}>
      <div className={clsx(styles.avatar, isUser ? styles.userAvatar : styles.aiAvatar)}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className={clsx(styles.bubble, isUser ? styles.userBubble : styles.aiBubble)}>
        {message.content}
      </div>
    </div>
  );
}


import React, { useEffect } from 'react';
import { ChatMessage, MessageSender, MessagePurpose } from '../types';
import { Lightbulb, MessageSquareText, UserCircle, Zap, AlertTriangle } from 'lucide-react';

interface SenderIconProps {
  sender: MessageSender;
  purpose: MessagePurpose;
  messageText: string;
}

const SenderIcon: React.FC<SenderIconProps> = ({ sender, purpose, messageText }) => {
  const iconClass = "w-5 h-5 mr-2 flex-shrink-0";
  switch (sender) {
    case MessageSender.User:
      return <UserCircle className={`${iconClass} text-blue-400`} />;
    case MessageSender.Cognito:
      return <Lightbulb className={`${iconClass} text-green-400`} />;
    case MessageSender.Muse:
      return <Zap className={`${iconClass} text-purple-400`} />;
    case MessageSender.System:
      if (purpose === MessagePurpose.SystemNotification &&
          (messageText.toLowerCase().includes("error") ||
           messageText.toLowerCase().includes("错误") ||
           messageText.toLowerCase().includes("警告"))) {
        return <AlertTriangle className={`${iconClass} text-red-400`} />;
      }
      return <MessageSquareText className={`${iconClass} text-gray-400`} />;
    default:
      return null;
  }
};

const getSenderNameStyle = (sender: MessageSender): string => {
  switch (sender) {
    case MessageSender.User: return "text-blue-300";
    case MessageSender.Cognito: return "text-green-300";
    case MessageSender.Muse: return "text-purple-300";
    case MessageSender.System: return "text-gray-400";
    default: return "text-gray-200";
  }
};

const getBubbleStyle = (sender: MessageSender, purpose: MessagePurpose, messageText: string): string => {
  let baseStyle = "mb-4 p-4 rounded-lg shadow-md max-w-xl break-words ";
  if (purpose === MessagePurpose.SystemNotification) {
    if (messageText.toLowerCase().includes("error") ||
        messageText.toLowerCase().includes("错误") ||
        messageText.toLowerCase().includes("警告") ||
        messageText.toLowerCase().includes("critical") ||
        messageText.toLowerCase().includes("严重")) {
      return baseStyle + "bg-red-800 border border-red-700 text-center text-sm italic mx-auto text-red-200";
    }
    return baseStyle + "bg-gray-700 text-center text-sm italic mx-auto";
  }
  switch (sender) {
    case MessageSender.User:
      return baseStyle + "bg-blue-600 ml-auto rounded-br-none";
    case MessageSender.Cognito:
      return baseStyle + "bg-green-700 mr-auto rounded-bl-none";
    case MessageSender.Muse:
      return baseStyle + "bg-purple-700 mr-auto rounded-bl-none";
    default:
      return baseStyle + "bg-gray-600 mr-auto";
  }
};

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const { text: messageText, sender, purpose, timestamp, durationMs, image } = message;
  const formattedTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    if (window.MathJax) {
      window.MathJax.typesetPromise();
    }
  }, [messageText]);

  return (
    <div className={`flex ${sender === MessageSender.User ? 'justify-end' : 'justify-start'}`}>
      <div className={`${getBubbleStyle(sender, purpose, messageText)}`}>
        <div className="flex items-center mb-1">
          <SenderIcon sender={sender} purpose={purpose} messageText={messageText} />
          <span className={`font-semibold ${getSenderNameStyle(sender)}`}>{sender}</span>
        </div>
        {messageText && (
          <p className="text-sm text-gray-200 whitespace-pre-wrap">
            {messageText}
          </p>
        )}
        {image && sender === MessageSender.User && (
          <div className={`mt-2 ${messageText ? 'pt-2 border-t border-blue-500' : ''}`}>
            <img
              src={image.dataUrl}
              alt={image.name || "用户上传的图片"}
              className="max-w-xs max-h-64 rounded-md object-contain"
            />
          </div>
        )}
        <div className="text-xs text-gray-400 mt-2 flex justify-between items-center">
          <span>{formattedTime}</span>
          {durationMs !== undefined && durationMs > 0 && (
            <span className="italic">(耗时: {(durationMs / 1000).toFixed(2)}s)</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
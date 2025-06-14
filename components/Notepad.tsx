import React, { useState, useMemo, useEffect } from 'react';
import { MessageSender } from '../types';
import { FileText, Edit3, Eye, Code } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface NotepadProps {
  content: string;
  lastUpdatedBy?: MessageSender | null;
  isLoading: boolean;
}

const Notepad: React.FC<NotepadProps> = ({ content, lastUpdatedBy, isLoading }) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const getSenderColor = (sender?: MessageSender | null) => {
    if (sender === MessageSender.Cognito) return 'text-green-400';
    if (sender === MessageSender.Muse) return 'text-purple-400';
    return 'text-gray-400';
  };

  const processedHtml = useMemo(() => {
    if (isPreviewMode) {
      const rawHtml = marked.parse(content) as string;
      return DOMPurify.sanitize(rawHtml);
    }
    return '';
  }, [content, isPreviewMode]);

  useEffect(() => {
    if (window.MathJax) {
      window.MathJax.typesetPromise();
    }
  }, [processedHtml, content, isPreviewMode]);

  return (
    <div className="h-full flex flex-col bg-slate-800 border-l border-gray-700">
      <header className="p-3 border-b border-gray-700 flex items-center justify-between bg-slate-900">
        <div className="flex items-center">
          <FileText size={20} className="mr-2 text-sky-400" />
          <h2 className="text-lg font-semibold text-sky-400">记事本</h2>
        </div>
        <div className="flex items-center space-x-2">
          {isLoading && <span className="text-xs text-gray-400 italic">AI 思考中...</span>}
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="p-1.5 text-gray-400 hover:text-sky-400 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-sky-500 rounded-md"
            title={isPreviewMode ? "查看原始内容" : "预览 Markdown"}
            aria-label={isPreviewMode ? "Switch to raw text view" : "Switch to Markdown preview"}
          >
            {isPreviewMode ? <Code size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </header>
      <div className="flex-grow overflow-y-auto relative">
        {isPreviewMode ? (
          <div
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: processedHtml }}
            aria-label="Markdown 预览"
          />
        ) : (
          <textarea
            readOnly
            value={content}
            className="w-full h-full p-3 bg-slate-800 text-gray-300 resize-none border-none focus:ring-0 font-mono text-sm leading-relaxed"
            aria-label="共享记事本内容 (原始内容)"
          />
        )}
      </div>
      <footer className="p-2 border-t border-gray-700 text-xs text-gray-500 bg-slate-900">
        {lastUpdatedBy ? (
          <div className="flex items-center">
            <Edit3 size={14} className={`mr-1.5 ${getSenderColor(lastUpdatedBy)}`} />
            最后更新者: <span className={`font-medium ml-1 ${getSenderColor(lastUpdatedBy)}`}>{lastUpdatedBy}</span>
          </div>
        ) : (
          <span>记事本内容未被 AI 修改过。</span>
        )}
      </footer>
    </div>
  );
};

export default Notepad;


import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, MessageSender, MessagePurpose } from './types';
import { generateResponse } from './services/geminiService';
import ChatInput from './components/ChatInput';
import MessageBubble from './components/MessageBubble';
import Notepad from './components/Notepad';
import {
  MODELS,
  DEFAULT_MODEL_API_NAME,
  COGNITO_SYSTEM_PROMPT_HEADER,
  MUSE_SYSTEM_PROMPT_HEADER,
  MAX_DISCUSSION_TURNS_PER_MODEL,
  INITIAL_NOTEPAD_CONTENT,
  NOTEPAD_INSTRUCTION_PROMPT_PART,
  NOTEPAD_UPDATE_TAG_START,
  NOTEPAD_UPDATE_TAG_END,
  AiModel
} from './constants';
import { BotMessageSquare, AlertTriangle, RefreshCcw, SlidersHorizontal, Cpu } from 'lucide-react';

interface ParsedAIResponse {
  spokenText: string;
  newNotepadContent: string | null;
}

const parseNotepadUpdate = (responseText: string): ParsedAIResponse => {
  const startIndex = responseText.lastIndexOf(NOTEPAD_UPDATE_TAG_START);
  const endIndex = responseText.lastIndexOf(NOTEPAD_UPDATE_TAG_END);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const newNotepadContent = responseText.substring(startIndex + NOTEPAD_UPDATE_TAG_START.length, endIndex).trim();
    let spokenText = responseText.substring(0, startIndex).trim();
    if (!spokenText && newNotepadContent && responseText.trim() === `${NOTEPAD_UPDATE_TAG_START}${newNotepadContent}${NOTEPAD_UPDATE_TAG_END}`) {
        spokenText = "(AI 更新了记事本)";
    } else if (!spokenText && !newNotepadContent && responseText.includes(NOTEPAD_UPDATE_TAG_START)) {
        spokenText = responseText.replace(NOTEPAD_UPDATE_TAG_START, "").replace(NOTEPAD_UPDATE_TAG_END, "").trim();
         return { spokenText: spokenText || "(AI 尝试更新记事本但内容为空)", newNotepadContent: null };
    }
    return { spokenText: spokenText || "(AI 更新了记事本)", newNotepadContent };
  }
  return { spokenText: responseText.trim(), newNotepadContent: null };
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Extract base64 data after comma
    };
    reader.onerror = (error) => reject(error);
  });
};


const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState<boolean>(false);
  const [currentTotalProcessingTimeMs, setCurrentTotalProcessingTimeMs] = useState<number>(0);

  const [notepadContent, setNotepadContent] = useState<string>(INITIAL_NOTEPAD_CONTENT);
  const [lastNotepadUpdateBy, setLastNotepadUpdateBy] = useState<MessageSender | null>(null);

  const [selectedModelApiName, setSelectedModelApiName] = useState<string>(DEFAULT_MODEL_API_NAME);
  const [isThinkingBudgetEnabled, setIsThinkingBudgetEnabled] = useState<boolean>(true);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const currentQueryStartTimeRef = useRef<number | null>(null);

  const currentModelDetails = MODELS.find(m => m.apiName === selectedModelApiName) || MODELS[0];
  const modelSupportsThinkingBudget = currentModelDetails.supportsThinkingBudget;

  const addMessage = (
    text: string,
    sender: MessageSender,
    purpose: MessagePurpose,
    durationMs?: number,
    image?: ChatMessage['image']
  ) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text,
      sender,
      purpose,
      timestamp: new Date(),
      durationMs,
      image
    }]);
  };

  const initializeChat = () => {
    setMessages([]);
    setNotepadContent(INITIAL_NOTEPAD_CONTENT);
    setLastNotepadUpdateBy(null);

    if (!process.env.API_KEY) {
      setIsApiKeyMissing(true);
      addMessage(
        "严重警告：API_KEY 未配置。请确保设置 API_KEY 环境变量，以便应用程序正常运行。",
        MessageSender.System,
        MessagePurpose.SystemNotification
      );
    } else {
      setIsApiKeyMissing(false);
       addMessage(
        `欢迎使用Dual AI Chat！在下方输入您的问题或上传图片。${MessageSender.Cognito} 和 ${MessageSender.Muse} 将进行讨论，并可能使用右侧的共享记事本。然后 ${MessageSender.Cognito} 会给您回复。当前模型: ${currentModelDetails.name}`,
        MessageSender.System,
        MessagePurpose.SystemNotification
      );
    }
  };

  useEffect(() => {
    initializeChat();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

   useEffect(() => {
     const welcomeMessage = messages.find(msg => msg.text.startsWith("欢迎使用Dual AI Chat！"));
     if (welcomeMessage && !isApiKeyMissing) {
        setMessages(msgs => msgs.map(msg =>
            msg.id === welcomeMessage.id
            ? {...msg, text: `欢迎使用Dual AI Chat！在下方输入您的问题或上传图片。${MessageSender.Cognito} 和 ${MessageSender.Muse} 将进行讨论，并可能使用右侧的共享记事本。然后 ${MessageSender.Cognito} 会给您回复。当前模型: ${currentModelDetails.name}`}
            : msg
        ));
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModelDetails.name, isApiKeyMissing]);


  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    let intervalId: number | undefined;
    if (isLoading && currentQueryStartTimeRef.current) {
      intervalId = window.setInterval(() => {
        if (currentQueryStartTimeRef.current) {
          setCurrentTotalProcessingTimeMs(performance.now() - currentQueryStartTimeRef.current);
        }
      }, 100);
    } else if (!isLoading && intervalId) {
      clearInterval(intervalId);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoading]);

  const handleClearChat = () => {
    setIsLoading(false);
    setCurrentTotalProcessingTimeMs(0);
    if (currentQueryStartTimeRef.current) {
        currentQueryStartTimeRef.current = null;
    }
    setMessages([]);
    setNotepadContent(INITIAL_NOTEPAD_CONTENT);
    setLastNotepadUpdateBy(null);
     if (!isApiKeyMissing) {
       addMessage(
        `欢迎使用Dual AI Chat！在下方输入您的问题或上传图片。${MessageSender.Cognito} 和 ${MessageSender.Muse} 将进行讨论，并可能使用右侧的共享记事本。然后 ${MessageSender.Cognito} 会给您回复。当前模型: ${currentModelDetails.name}`,
        MessageSender.System,
        MessagePurpose.SystemNotification
      );
    } else {
         addMessage(
            "严重警告：API_KEY 未配置。请确保设置 API_KEY 环境变量，以便应用程序正常运行。",
            MessageSender.System,
            MessagePurpose.SystemNotification
      );
    }
  };

  const handleSendMessage = async (userInput: string, imageFile?: File | null) => {
    if (isApiKeyMissing || isLoading) return;
    if (!userInput.trim() && !imageFile) return; // Do not send if both are empty


    let userImageForDisplay: ChatMessage['image'] | undefined = undefined;
    if (imageFile) {
      const dataUrl = URL.createObjectURL(imageFile);
      userImageForDisplay = { dataUrl, name: imageFile.name, type: imageFile.type };
    }

    addMessage(userInput, MessageSender.User, MessagePurpose.UserInput, undefined, userImageForDisplay);
    setIsLoading(true);
    currentQueryStartTimeRef.current = performance.now();
    setCurrentTotalProcessingTimeMs(0);

    const discussionLog: string[] = [];
    let lastTurnTextForLog = "";
    const shouldApplyBudgetZeroForApi = modelSupportsThinkingBudget && !isThinkingBudgetEnabled;

    let imageApiPart: { inlineData: { mimeType: string; data: string } } | undefined = undefined;
    if (imageFile) {
      try {
        const base64Data = await fileToBase64(imageFile);
        imageApiPart = {
          inlineData: {
            mimeType: imageFile.type,
            data: base64Data,
          },
        };
      } catch (error) {
        console.error("Error converting file to base64:", error);
        addMessage("图片处理失败，请重试。", MessageSender.System, MessagePurpose.SystemNotification);
        setIsLoading(false);
        return;
      }
    }

    const imageInstructionForAI = imageApiPart ? "用户还提供了一张图片。请在您的分析和回复中同时考虑此图片和文本查询。" : "";

    try {
      const commonPromptInstructions = NOTEPAD_INSTRUCTION_PROMPT_PART.replace('{notepadContent}', notepadContent);

      addMessage(`${MessageSender.Cognito} 正在为 ${MessageSender.Muse} 准备第一个观点 (使用 ${currentModelDetails.name})...`, MessageSender.System, MessagePurpose.SystemNotification);
      let cognitoPrompt = `${COGNITO_SYSTEM_PROMPT_HEADER} 用户的查询 (中文) 是: "${userInput}". ${imageInstructionForAI} 您的任务是与 ${MessageSender.Muse}（一个创意AI）讨论此查询。制定您对 ${MessageSender.Muse} 的初始陈述或问题以开始讨论。保持您的回复简洁并使用中文。\n${commonPromptInstructions}`;
      let cognitoResultRaw = await generateResponse(cognitoPrompt, selectedModelApiName, COGNITO_SYSTEM_PROMPT_HEADER, shouldApplyBudgetZeroForApi, imageApiPart);

      if (cognitoResultRaw.error) {
        if (cognitoResultRaw.error.includes("API key not valid")) setIsApiKeyMissing(true);
        throw new Error(cognitoResultRaw.text);
      }
      let { spokenText: cognitoSpokenText, newNotepadContent: cognitoNotepadUpdate } = parseNotepadUpdate(cognitoResultRaw.text);
      if (cognitoNotepadUpdate !== null) {
        setNotepadContent(cognitoNotepadUpdate);
        setLastNotepadUpdateBy(MessageSender.Cognito);
      }
      addMessage(cognitoSpokenText, MessageSender.Cognito, MessagePurpose.CognitoToMuse, cognitoResultRaw.durationMs);
      lastTurnTextForLog = cognitoSpokenText;
      discussionLog.push(`${MessageSender.Cognito}: ${lastTurnTextForLog}`);

      for (let turn = 0; turn < MAX_DISCUSSION_TURNS_PER_MODEL; turn++) {
        const currentNotepadForPrompt = notepadContent; // Use latest notepad content for each turn
        const dynamicPromptInstructions = NOTEPAD_INSTRUCTION_PROMPT_PART.replace('{notepadContent}', currentNotepadForPrompt);

        addMessage(`${MessageSender.Muse} 正在回应 ${MessageSender.Cognito} (使用 ${currentModelDetails.name})...`, MessageSender.System, MessagePurpose.SystemNotification);
        const musePrompt = `${MUSE_SYSTEM_PROMPT_HEADER} 用户的查询 (中文) 是: "${userInput}". ${imageInstructionForAI} 当前讨论 (均为中文):\n${discussionLog.join("\n")}\n${MessageSender.Cognito} (逻辑AI) 刚刚说 (中文): "${lastTurnTextForLog}". 请回复 ${MessageSender.Cognito}。继续讨论。保持您的回复简洁并使用中文。\n${dynamicPromptInstructions}`;
        const museResultRaw = await generateResponse(musePrompt, selectedModelApiName, MUSE_SYSTEM_PROMPT_HEADER, shouldApplyBudgetZeroForApi, imageApiPart);
        if (museResultRaw.error) {
            if (museResultRaw.error.includes("API key not valid")) setIsApiKeyMissing(true);
            throw new Error(museResultRaw.text);
        }
        let { spokenText: museSpokenText, newNotepadContent: museNotepadUpdate } = parseNotepadUpdate(museResultRaw.text);
        if (museNotepadUpdate !== null) {
          setNotepadContent(museNotepadUpdate);
          setLastNotepadUpdateBy(MessageSender.Muse);
        }
        addMessage(museSpokenText, MessageSender.Muse, MessagePurpose.MuseToCognito, museResultRaw.durationMs);
        lastTurnTextForLog = museSpokenText;
        discussionLog.push(`${MessageSender.Muse}: ${lastTurnTextForLog}`);

        const cognitoCurrentNotepadForPrompt = notepadContent;
        const cognitoDynamicPromptInstructions = NOTEPAD_INSTRUCTION_PROMPT_PART.replace('{notepadContent}', cognitoCurrentNotepadForPrompt);
        addMessage(`${MessageSender.Cognito} 正在回应 ${MessageSender.Muse} (使用 ${currentModelDetails.name})...`, MessageSender.System, MessagePurpose.SystemNotification);
        const cognitoReplyPrompt = `${COGNITO_SYSTEM_PROMPT_HEADER} 用户的查询 (中文) 是: "${userInput}". ${imageInstructionForAI} 当前讨论 (均为中文):\n${discussionLog.join("\n")}\n${MessageSender.Muse} (创意AI) 刚刚说 (中文): "${lastTurnTextForLog}". 请回复 ${MessageSender.Muse}。继续讨论。保持您的回复简洁并使用中文。\n${cognitoDynamicPromptInstructions}`;
        const cognitoReplyResultRaw = await generateResponse(cognitoReplyPrompt, selectedModelApiName, COGNITO_SYSTEM_PROMPT_HEADER, shouldApplyBudgetZeroForApi, imageApiPart);
        if (cognitoReplyResultRaw.error) {
            if (cognitoReplyResultRaw.error.includes("API key not valid")) setIsApiKeyMissing(true);
            throw new Error(cognitoReplyResultRaw.text);
        }
        let { spokenText: cognitoReplySpokenText, newNotepadContent: cognitoReplyNotepadUpdate } = parseNotepadUpdate(cognitoReplyResultRaw.text);
        if (cognitoReplyNotepadUpdate !== null) {
          setNotepadContent(cognitoReplyNotepadUpdate);
          setLastNotepadUpdateBy(MessageSender.Cognito);
        }
        addMessage(cognitoReplySpokenText, MessageSender.Cognito, MessagePurpose.CognitoToMuse, cognitoReplyResultRaw.durationMs);
        lastTurnTextForLog = cognitoReplySpokenText;
        discussionLog.push(`${MessageSender.Cognito}: ${lastTurnTextForLog}`);
      }

      const finalNotepadForPrompt = notepadContent;
      const finalPromptInstructions = NOTEPAD_INSTRUCTION_PROMPT_PART.replace('{notepadContent}', finalNotepadForPrompt);
      addMessage(`${MessageSender.Cognito} 正在综合讨论内容，准备最终答案 (使用 ${currentModelDetails.name})...`, MessageSender.System, MessagePurpose.SystemNotification);
      const finalAnswerPrompt = `${COGNITO_SYSTEM_PROMPT_HEADER} 用户最初的查询 (中文) 是: "${userInput}". ${imageInstructionForAI} 您 (${MessageSender.Cognito}) 和 ${MessageSender.Muse} 进行了以下讨论 (均为中文):\n${discussionLog.join("\n")}\n基于整个交流过程和共享记事本的最终状态，综合所有关键点，并为用户制定一个全面、有用的最终答案。直接回复用户，而不是 ${MessageSender.Muse}。确保答案结构良好，易于理解，并使用中文。如果相关，您可以在答案中引用记事本。如果认为有必要，您也可以使用标准的记事本更新说明最后一次更新记事本。\n${finalPromptInstructions}`;
      const finalAnswerResultRaw = await generateResponse(finalAnswerPrompt, selectedModelApiName, COGNITO_SYSTEM_PROMPT_HEADER, shouldApplyBudgetZeroForApi, imageApiPart);
      if (finalAnswerResultRaw.error) {
        if (finalAnswerResultRaw.error.includes("API key not valid")) setIsApiKeyMissing(true);
        throw new Error(finalAnswerResultRaw.text);
      }
      let { spokenText: finalSpokenText, newNotepadContent: finalNotepadUpdate } = parseNotepadUpdate(finalAnswerResultRaw.text);
      if (finalNotepadUpdate !== null) {
        setNotepadContent(finalNotepadUpdate);
        setLastNotepadUpdateBy(MessageSender.Cognito);
      }
      addMessage(finalSpokenText, MessageSender.Cognito, MessagePurpose.FinalResponse, finalAnswerResultRaw.durationMs);

    } catch (error) {
      console.error("聊天流程中发生错误:", error);
      const errorMessageText = error instanceof Error ? error.message : "处理您的请求时发生意外错误。";
      if (errorMessageText.includes("API_KEY 未配置") || errorMessageText.includes("API密钥无效")) {
        setIsApiKeyMissing(true);
         addMessage(
          `错误：${errorMessageText} 请检查您的API密钥配置。聊天功能可能无法正常工作。`,
          MessageSender.System,
          MessagePurpose.SystemNotification,
          0
        );
      } else {
        addMessage(`错误: ${errorMessageText}`, MessageSender.System, MessagePurpose.SystemNotification, 0);
      }
    } finally {
      setIsLoading(false);
      if(currentQueryStartTimeRef.current) {
        setCurrentTotalProcessingTimeMs(performance.now() - currentQueryStartTimeRef.current);
         // Revoke object URL for the displayed user image if it exists to free resources
        if (userImageForDisplay?.dataUrl.startsWith('blob:')) {
            URL.revokeObjectURL(userImageForDisplay.dataUrl);
        }
      }
      currentQueryStartTimeRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-7xl mx-auto bg-gray-900 shadow-2xl rounded-lg overflow-hidden">
      <header className="p-4 bg-gray-900 border-b border-gray-700 flex items-center justify-between shrink-0 space-x-2 md:space-x-4">
        <div className="flex items-center shrink-0">
          <BotMessageSquare size={28} className="mr-2 md:mr-3 text-sky-400" />
          <h1 className="text-xl md:text-2xl font-semibold text-sky-400">Dual AI Chat</h1>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-3 flex-wrap justify-end">
          <div className="flex items-center">
            <label htmlFor="modelSelector" className="text-sm text-gray-300 mr-1.5 flex items-center shrink-0">
              <Cpu size={18} className="mr-1 text-sky-400"/>
              模型:
            </label>
            <select
              id="modelSelector"
              value={selectedModelApiName}
              onChange={(e) => setSelectedModelApiName(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-md p-1.5 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              aria-label="选择AI模型"
            >
              {MODELS.map((model) => (
                <option key={model.id} value={model.apiName}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          <label
            htmlFor="thinkingToggle"
            className={`flex items-center text-sm text-gray-300 transition-opacity ${!modelSupportsThinkingBudget ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:text-sky-400'}`}
            title={
              modelSupportsThinkingBudget
                ? (isThinkingBudgetEnabled ? "切换为快速模式 (禁用AI思考预算)" : "切换为高质量模式 (启用AI思考预算)")
                : "此模型不支持思考预算设置"
            }
          >
            <SlidersHorizontal size={18} className={`mr-1.5 ${modelSupportsThinkingBudget && isThinkingBudgetEnabled ? 'text-sky-400' : 'text-gray-500'}`} />
            <span className="mr-2 select-none shrink-0">思考预算:</span>
            <div className="relative">
              <input
                type="checkbox"
                id="thinkingToggle"
                className="sr-only peer"
                checked={isThinkingBudgetEnabled}
                onChange={() => {
                  if (modelSupportsThinkingBudget) {
                    setIsThinkingBudgetEnabled(!isThinkingBudgetEnabled);
                  }
                }}
                disabled={!modelSupportsThinkingBudget}
                aria-label="切换AI思考预算"
              />
              <div className={`block w-10 h-6 rounded-full transition-colors ${modelSupportsThinkingBudget ? (isThinkingBudgetEnabled ? 'bg-sky-500 peer-checked:bg-sky-500' : 'bg-gray-600') : 'bg-gray-700'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${modelSupportsThinkingBudget && isThinkingBudgetEnabled ? 'peer-checked:translate-x-4' : ''} ${!modelSupportsThinkingBudget ? 'bg-gray-400' : ''}`}></div>
            </div>
            <span className="ml-2 w-28 text-left select-none shrink-0">
              {modelSupportsThinkingBudget
                ? (isThinkingBudgetEnabled ? '高质量 (启用)' : '快速 (禁用)')
                : '(不支持)'}
            </span>
          </label>

          <button
            onClick={handleClearChat}
            className="p-2 text-gray-400 hover:text-sky-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded-md shrink-0"
            aria-label="清空对话和记事本"
            title="清空对话和记事本"
          >
            <RefreshCcw size={22} />
          </button>
        </div>
      </header>

      <div className="flex flex-row flex-grow overflow-hidden">
        <div className="flex flex-col w-2/3 md:w-3/5 lg:w-2/3 h-full">
          <div ref={chatContainerRef} className="flex-grow p-4 space-y-4 overflow-y-auto bg-gray-800 scroll-smooth">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} isApiKeyMissing={isApiKeyMissing} />
        </div>

        <div className="w-1/3 md:w-2/5 lg:w-1/3 h-full bg-slate-800">
          <Notepad
            content={notepadContent}
            lastUpdatedBy={lastNotepadUpdateBy}
            isLoading={isLoading}
          />
        </div>
      </div>

      { (isLoading || (currentTotalProcessingTimeMs > 0 && !isLoading) || (isLoading && currentTotalProcessingTimeMs === 0)) && (
         <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 bg-gray-900 bg-opacity-80 text-white p-2 rounded-md shadow-lg text-xs z-50">
            总耗时: {(currentTotalProcessingTimeMs / 1000).toFixed(2)}s
        </div>
      )}
       {isApiKeyMissing &&
        !messages.some(msg => msg.text.includes("API_KEY 未配置") || msg.text.includes("API密钥无效")) &&
        !messages.some(msg => msg.text.includes("严重警告：API_KEY 未配置")) &&
        (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 p-3 bg-red-700 text-white rounded-lg shadow-lg flex items-center text-sm z-50">
            <AlertTriangle size={20} className="mr-2" /> API密钥未配置或无效。请检查控制台获取更多信息。
        </div>
      )}
    </div>
  );
};

export default App;

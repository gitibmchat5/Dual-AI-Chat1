
export const GEMINI_FLASH_MODEL_ID = 'gemini-2.5-flash-preview-05-20';
export const GEMINI_PRO_MODEL_ID = 'gemini-2.5-pro-preview-05-06';

export interface AiModel {
  id: string; // A short identifier like 'flash-05-20' or 'pro-05-06'
  name: string; // User-friendly name for display
  apiName: string; // Actual model name for the API
  supportsThinkingBudget: boolean;
}

export const MODELS: AiModel[] = [
  {
    id: 'flash-05-20',
    name: 'Gemini 2.5 Flash (05-20)',
    apiName: GEMINI_FLASH_MODEL_ID,
    supportsThinkingBudget: true,
  },
  {
    id: 'pro-05-06',
    name: 'Gemini 2.5 Pro (05-06)',
    apiName: GEMINI_PRO_MODEL_ID,
    supportsThinkingBudget: false,
  },
];

// Default model is the first one in the list (Flash model)
export const DEFAULT_MODEL_API_NAME = MODELS[0].apiName;

export const COGNITO_SYSTEM_PROMPT_HEADER = "You are Cognito, a highly logical AI.";
export const MUSE_SYSTEM_PROMPT_HEADER = "You are Muse, a highly creative AI.";

export const THINKING_BUDGET_DISABLED = { thinkingConfig: { thinkingBudget: 0 } };

export const MAX_DISCUSSION_TURNS_PER_MODEL = 2;

export const INITIAL_NOTEPAD_CONTENT = `这是一个共享记事本。
Cognito 和 Muse 可以在这里合作记录想法、草稿或关键点。

使用指南:
- AI 模型可以通过在其回复中包含特定指令来更新此记事本。
- 记事本的内容将包含在发送给 AI 的后续提示中。

初始状态：空白。`;

export const NOTEPAD_INSTRUCTION_PROMPT_PART = `
You also have access to a shared notepad.
Current Notepad Content:
---
{notepadContent}
---
Instructions for Notepad:
1. To update the notepad, include a section at the very end of your response, formatted exactly as:
   <notepad_update>
   [YOUR NEW FULL NOTEPAD CONTENT HERE. THIS WILL REPLACE THE ENTIRE CURRENT NOTEPAD CONTENT.]
   </notepad_update>
2. If you do not want to change the notepad, do NOT include the <notepad_update> section at all.
3. Your primary spoken response to the ongoing discussion should come BEFORE any <notepad_update> section. Ensure you still provide a spoken response.
`;

export const NOTEPAD_UPDATE_TAG_START = "<notepad_update>";
export const NOTEPAD_UPDATE_TAG_END = "</notepad_update>";
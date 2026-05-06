// @flow
import optionalRequire from './OptionalRequire';
import {
  type AiConfiguration,
  type AiRequest,
  type AiRequestAssistantMessage,
  type AiRequestUserMessage,
} from './GDevelopServices/Generation';

const electron = optionalRequire('electron');
const ipcRenderer = electron ? electron.ipcRenderer : null;

const buildCodexPrompt = ({
  userRequest,
  gameProjectJson,
  projectSpecificExtensionsSummaryJson,
}: {|
  userRequest: string,
  gameProjectJson: string | null,
  projectSpecificExtensionsSummaryJson: string | null,
|}) => {
  return `You are helping build a GDevelop game from inside a modified GDevelop editor.

User request:
${userRequest}

Current simplified GDevelop project JSON:
${gameProjectJson || '(No project is open yet.)'}

Project-specific extensions summary:
${projectSpecificExtensionsSummaryJson || '(No project-specific extensions.)'}

Respond with a concise implementation plan and concrete GDevelop editor actions.`;
};

const makeUserMessage = (text: string): AiRequestUserMessage => ({
  type: 'message',
  status: 'completed',
  role: 'user',
  content: [
    {
      type: 'user_request',
      status: 'completed',
      text,
    },
  ],
});

const makeAssistantMessage = (text: string): AiRequestAssistantMessage => ({
  type: 'message',
  status: 'completed',
  role: 'assistant',
  content: [
    {
      type: 'output_text',
      status: 'completed',
      text,
      annotations: [],
    },
  ],
});

export const runLocalCodexAiRequest = async ({
  userId,
  userRequest,
  gameProjectJson,
  projectSpecificExtensionsSummaryJson,
  mode,
  aiConfiguration,
  gameId,
  aiRequestId,
  previousAiRequest,
}: {|
  userId: string,
  userRequest: string,
  gameProjectJson: string | null,
  projectSpecificExtensionsSummaryJson: string | null,
  mode: 'chat' | 'agent' | 'orchestrator',
  aiConfiguration: AiConfiguration,
  gameId?: string | null,
  aiRequestId?: string,
  previousAiRequest?: AiRequest | null,
|}): Promise<AiRequest> => {
  if (!ipcRenderer) {
    throw new Error('Local Codex is only available in the desktop app.');
  }

  const now = new Date().toISOString();
  const codexOutput = await ipcRenderer.invoke('codex-exec', {
    prompt: buildCodexPrompt({
      userRequest,
      gameProjectJson,
      projectSpecificExtensionsSummaryJson,
    }),
    model: aiConfiguration.model || 'gpt-5.5',
    reasoningEffort: aiConfiguration.reasoningEffort || 'medium',
  });
  const id =
    (previousAiRequest && previousAiRequest.id) ||
    aiRequestId ||
    `local-codex-${Date.now().toString(36)}`;
  const previousOutput = previousAiRequest ? previousAiRequest.output || [] : [];

  return {
    id,
    createdAt: (previousAiRequest && previousAiRequest.createdAt) || now,
    updatedAt: now,
    userId,
    gameId,
    status: 'ready',
    mode,
    aiConfiguration,
    error: null,
    output: [
      ...previousOutput,
      makeUserMessage(userRequest),
      makeAssistantMessage(codexOutput),
    ],
    lastUserMessagePriceInCredits: 0,
    totalPriceInCredits: 0,
  };
};

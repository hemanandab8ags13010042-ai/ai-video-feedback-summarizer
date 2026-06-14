const { GoogleGenAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');

const geminiKey = process.env.GEMINI_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

let geminiClient = null;
let openaiClient = null;

if (geminiKey) {
  // Use the standard client initialization
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  geminiClient = new GoogleGenerativeAI(geminiKey);
  console.log('✅ Gemini API client initialized.');
} else if (openaiKey) {
  openaiClient = new OpenAI({ apiKey: openaiKey });
  console.log('✅ OpenAI API client initialized.');
} else {
  console.log('ℹ️ No AI API keys found. Using Mock AI processing.');
}

/**
 * Helper to generate AI analysis output
 */
async function analyzeFeedback(textData, fileBuffer = null, fileMimeType = null, teamMembers = []) {
  const teamListStr = teamMembers.map(t => `${t.name} (Role: ${t.role}, ID: ${t.id})`).join('\n');
  
  const systemPrompt = `
You are an expert AI Video production manager and assistant for a film/video studio.
Analyze the provided client feedback (which may include text feedback or voice note/document uploads) and convert it into structured JSON.

You must identify:
1. Short project summary.
2. Sentiment (positive, neutral, negative).
3. Risk detected (any issues with delivery or client frustration).
4. Priority (high, medium, low).
5. Estimated efforts in hours.
6. A detailed final delivery checklist.
7. Editing Tasks (e.g. cut, color correction, pacing, audio layout).
8. VFX Tasks (e.g. object removal, green screen, digital compositing, CGI).
9. Smart assignment suggestions. Based on the team members list, suggest which member (by name and ID) should handle which task.

Your response must be a valid JSON object matching the schema below. Do not include markdown code block formatting like \`\`\`json. Return only the raw JSON.
JSON Schema:
{
  "summary": "Short paragraph summarizing feedback...",
  "sentiment": "positive | neutral | negative",
  "priority": "high | medium | low",
  "estimated_hours": 12.5,
  "risk_detected": "Detailed risk status or null if low risk",
  "action_items": [
    "General Action item 1",
    "General Action item 2"
  ],
  "editing_tasks": [
    {
      "title": "Task Title",
      "description": "Task Description",
      "priority": "high | medium | low",
      "hours": 3,
      "suggested_assignee_id": 123,
      "suggested_assignee_name": "Editor Name"
    }
  ],
  "vfx_tasks": [
    {
      "title": "Task Title",
      "description": "Task Description",
      "priority": "high | medium | low",
      "hours": 5,
      "suggested_assignee_id": 456,
      "suggested_assignee_name": "VFX Artist Name"
    }
  ],
  "checklist": [
    "Checklist Item 1",
    "Checklist Item 2"
  ]
}

Available Team Members to assign:
${teamListStr || 'None (make generic suggestions)'}
`;

  // 1. Gemini Implementation
  if (geminiClient) {
    try {
      const modelName = 'gemini-1.5-flash';
      const model = geminiClient.getGenerativeModel({ model: modelName });
      
      const contents = [];
      if (fileBuffer && fileMimeType) {
        contents.push({
          inlineData: {
            data: fileBuffer.toString('base64'),
            mimeType: fileMimeType
          }
        });
      }
      contents.push({ text: `${systemPrompt}\n\nClient input text/transcript:\n${textData || 'Feedback is in the attached file.'}` });

      const response = await model.generateContent(contents);
      const resText = response.response.text();
      return parseAIJson(resText);
    } catch (err) {
      console.error('Gemini Analysis error, falling back to mock:', err);
    }
  }

  // 2. OpenAI Implementation
  if (openaiClient) {
    try {
      let promptText = `${systemPrompt}\n\nClient input text/transcript:\n${textData || ''}`;
      if (fileBuffer) {
        promptText += `\n[Attached file content exists in buffer - analyzing metadata: size=${fileBuffer.length} bytes, type=${fileMimeType}]`;
      }
      
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: promptText }],
        response_format: { type: 'json_object' }
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (err) {
      console.error('OpenAI Analysis error, falling back to mock:', err);
    }
  }

  // 3. Fallback Mock Implementation
  return generateMockAnalysis(textData || '', fileMimeType, teamMembers);
}

/**
 * AI Chatbot Assistant for Project Management
 */
async function chatbotChat(chatHistory, userMessage, projectContext = '') {
  const systemPrompt = `You are a helpful AI Production Assistant for the AI Video Feedback Summarizer. 
  You help production managers, editors, and VFX artists coordinate their work.
  Project Context: ${projectContext}
  Reply concisely in markdown.`;

  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      // Filter history to ensure it starts with a 'user' message as required by the Gemini API
      const firstUserIndex = chatHistory.findIndex(msg => msg.role === 'user');
      const validHistory = firstUserIndex !== -1 ? chatHistory.slice(firstUserIndex) : [];

      const chat = model.startChat({
        history: validHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })),
        systemInstruction: systemPrompt
      });
      const result = await chat.sendMessage(userMessage);
      return result.response.text();
    } catch (err) {
      console.error('Gemini chatbot error:', err);
      return `⚠️ **Gemini API Error:** ${err.message || 'Unknown error occurred.'}\n\nPlease check your \`GEMINI_API_KEY\` configuration. Ensure you copied it correctly from Google AI Studio.`;
    }
  }

  if (openaiClient) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
        { role: 'user', content: userMessage }
      ];
      const result = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages
      });
      return result.choices[0].message.content;
    } catch (err) {
      console.error('OpenAI chatbot error:', err);
    }
  }

  return `🤖 [Mock AI] I've received your message: "${userMessage}". Here is a helpful response! To get actual AI replies, please configure GEMINI_API_KEY in your .env file.`;
}

/**
 * Predict risk and suggestions locally or via AI
 */
function generateMockAnalysis(text, mimeType, teamMembers) {
  const lowerText = text.toLowerCase();
  
  // Basic classification indicators
  let sentiment = 'neutral';
  let priority = 'medium';
  let hours = 8;
  let risk = null;

  if (lowerText.includes('urgent') || lowerText.includes('asap') || lowerText.includes('immediately') || lowerText.includes('broken')) {
    priority = 'high';
    hours = 12;
  }
  if (lowerText.includes('hate') || lowerText.includes('bad') || lowerText.includes('wrong') || lowerText.includes('terrible') || lowerText.includes('delay')) {
    sentiment = 'negative';
    risk = 'Client is expressing dissatisfaction, which may delay approval. Immediate attention recommended.';
  } else if (lowerText.includes('great') || lowerText.includes('love') || lowerText.includes('awesome') || lowerText.includes('thanks')) {
    sentiment = 'positive';
  }

  // Find users
  const editor = teamMembers.find(t => t.role === 'editor') || { id: 3, name: 'Editor User' };
  const vfx = teamMembers.find(t => t.role === 'vfx_artist') || { id: 4, name: 'VFX Artist User' };

  // Setup mock lists
  const editingTasks = [];
  const vfxTasks = [];
  const actionItems = [];
  const checklist = ['Ensure color profiles are correct', 'Verify final render output path'];

  // Match keyword based tasks
  if (lowerText.includes('color') || lowerText.includes('grade') || lowerText.includes('look')) {
    editingTasks.push({
      title: 'Fix Color Grading',
      description: 'Apply the requested LUT and fix shadow saturation.',
      priority: 'high',
      hours: 3,
      suggested_assignee_id: editor.id,
      suggested_assignee_name: editor.name
    });
    actionItems.push('Recalibrate timeline color levels');
  }

  if (lowerText.includes('cut') || lowerText.includes('trim') || lowerText.includes('pace') || lowerText.includes('scene')) {
    editingTasks.push({
      title: 'Adjust Cut Pacing',
      description: 'Trim the intro sequence and speed up the middle montage transition.',
      priority: 'medium',
      hours: 2,
      suggested_assignee_id: editor.id,
      suggested_assignee_name: editor.name
    });
    actionItems.push('Trim intro scene timeline');
  }

  if (lowerText.includes('green') || lowerText.includes('screen') || lowerText.includes('vfx') || lowerText.includes('wire') || lowerText.includes('rig')) {
    vfxTasks.push({
      title: 'Green Screen Rig Cleanup',
      description: 'Key out green screen background and clean up edge halos.',
      priority: 'high',
      hours: 6,
      suggested_assignee_id: vfx.id,
      suggested_assignee_name: vfx.name
    });
    actionItems.push('Perform green screen keying on VFX sequence');
  }

  if (lowerText.includes('object') || lowerText.includes('remove') || lowerText.includes('boom') || lowerText.includes('logo')) {
    vfxTasks.push({
      title: 'Remove Unwanted Objects',
      description: 'Paint out the boom mic / background logos from the focal scene.',
      priority: 'medium',
      hours: 4,
      suggested_assignee_id: vfx.id,
      suggested_assignee_name: vfx.name
    });
    actionItems.push('Paint out background distraction objects');
  }

  // Fill in default values if nothing was matched
  if (editingTasks.length === 0 && vfxTasks.length === 0) {
    editingTasks.push({
      title: 'General Revision Request',
      description: text || 'Analyze general feedback requests and adjust video settings.',
      priority: 'medium',
      hours: 4,
      suggested_assignee_id: editor.id,
      suggested_assignee_name: editor.name
    });
    actionItems.push('Review client feedback details');
  }

  checklist.push('Upload high-res review file');
  checklist.push('Obtain client sign-off');

  return {
    summary: text ? `The client has submitted feedback requesting revisions. Sentiment is analyzed as ${sentiment}.` : 'No text feedback was provided; analyzing media file details.',
    sentiment,
    priority,
    estimated_hours: hours,
    risk_detected: risk,
    action_items: actionItems.length > 0 ? actionItems : ['Review feedback details', 'Assign task card'],
    editing_tasks: editingTasks,
    vfx_tasks: vfxTasks,
    checklist
  };
}

function parseAIJson(text) {
  try {
    // Strip code block markings if any
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '');
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse JSON from AI response:', text);
    // Simple regex fallback or return generic wrapper
    return {
      summary: 'Error parsing AI response. Feedback logged.',
      sentiment: 'neutral',
      priority: 'medium',
      estimated_hours: 5,
      risk_detected: 'Parsing error occurred.',
      action_items: ['Manual review required'],
      editing_tasks: [],
      vfx_tasks: [],
      checklist: ['Check system logs']
    };
  }
}

module.exports = {
  analyzeFeedback,
  chatbotChat
};

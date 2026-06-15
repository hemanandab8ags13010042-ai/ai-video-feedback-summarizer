const { GoogleGenAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');
const Groq = require('groq-sdk');

const geminiKey = process.env.GEMINI_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const groqKey = process.env.GROQ_API_KEY;

let geminiClient = null;
let fileManager = null;
let openaiClient = null;
let groqClient = null;

if (geminiKey) {
  // Use the standard client initialization
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const { GoogleAIFileManager } = require('@google/generative-ai/files');
  geminiClient = new GoogleGenerativeAI(geminiKey);
  fileManager = new GoogleAIFileManager(geminiKey);
  console.log('✅ Gemini API client and FileManager initialized.');
}
if (openaiKey) {
  openaiClient = new OpenAI({ apiKey: openaiKey });
  console.log('✅ OpenAI API client initialized.');
}
if (groqKey) {
  groqClient = new Groq({ apiKey: groqKey });
  console.log('✅ Groq API client initialized.');
}
if (!geminiKey && !openaiKey && !groqKey) {
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
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    for (const modelName of models) {
      try {
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
        console.warn(`Gemini (${modelName}) feedback analysis failed: ${err.message}. Trying next fallback...`);
      }
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
      console.error('OpenAI Analysis error, trying fallback to Groq if configured:', err);
    }
  }

  // 3. Groq Implementation
  if (groqClient) {
    try {
      let promptText = `${systemPrompt}\n\nClient input text/transcript:\n${textData || ''}`;
      if (fileBuffer) {
        promptText += `\n[Attached file content exists in buffer - analyzing metadata: size=${fileBuffer.length} bytes, type=${fileMimeType}]`;
      }
      
      const response = await groqClient.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: promptText }],
        response_format: { type: 'json_object' }
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (err) {
      console.error('Groq Analysis error, falling back to mock:', err);
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

  // 1. Gemini Chatbot Implementation
  if (geminiClient) {
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    for (const modelName of models) {
      try {
        const model = geminiClient.getGenerativeModel({ model: modelName });
        // Filter history to ensure it starts with a 'user' message as required by the Gemini API
        const firstUserIndex = chatHistory.findIndex(msg => msg.role === 'user');
        const validHistory = firstUserIndex !== -1 ? chatHistory.slice(firstUserIndex) : [];

        const chat = model.startChat({
          history: validHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          })),
          systemInstruction: { parts: [{ text: systemPrompt }] }
        });
        const result = await chat.sendMessage(userMessage);
        return result.response.text();
      } catch (err) {
        console.warn(`Gemini chatbot (${modelName}) failed: ${err.message}. Trying next fallback...`);
      }
    }
  }

  // 2. OpenAI Chatbot Implementation
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
      console.error('OpenAI chatbot error, trying fallback to Groq if configured:', err);
    }
  }

  // 3. Groq Chatbot Implementation
  if (groqClient) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory,
        { role: 'user', content: userMessage }
      ];
      const result = await groqClient.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages
      });
      return result.choices[0].message.content;
    } catch (err) {
      console.error('Groq chatbot error, falling back to mock:', err);
    }
  }

  // 4. Fallback Mock Implementation
  return generateMockChatResponse(userMessage);
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

function generateMockChatResponse(message) {
  const msg = message.toLowerCase();
  if (msg.includes('task') || msg.includes('todo') || msg.includes('kanban')) {
    return "Sure! Based on the current project feedback, we have pending tasks for **Editing** (trimming scenes, applying color grades) and **VFX** (wire compositing, keying). You can check their status in the Kanban Board.";
  }
  if (msg.includes('status') || msg.includes('progress') || msg.includes('pipeline')) {
    return "The current project pipeline is active. Most tasks are in the **New** or **In Progress** column. Clients can submit additional revisions via the feedback panel.";
  }
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return "Hello! I am your DigiQuest Studio assistant. How can I help you coordinate your video revisions today?";
  }
  return "I've received your message. I am here to help you coordinate tasks, track revisions, and review client comments. Let me know what you need!";
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

/**
 * Transcribe an audio buffer using Groq, OpenAI, or Gemini in order
 */
async function transcribeAudio(fileBuffer, mimeType, originalName) {
  // 1. Try Groq (Whisper large v3)
  if (groqClient) {
    try {
      const { toFile } = require('groq-sdk');
      const fileObject = await toFile(fileBuffer, originalName || 'audio.wav');
      const transcription = await groqClient.audio.transcriptions.create({
        file: fileObject,
        model: 'whisper-large-v3',
      });
      if (transcription && transcription.text) {
        console.log('✅ Transcription successful via Groq:', transcription.text);
        return transcription.text.trim();
      }
    } catch (err) {
      console.error('Groq transcription error, trying fallback:', err.message);
    }
  }

  // 2. Try OpenAI (Whisper 1)
  if (openaiClient) {
    try {
      const fileObject = await OpenAI.toFile(fileBuffer, originalName || 'audio.wav');
      const transcription = await openaiClient.audio.transcriptions.create({
        file: fileObject,
        model: 'whisper-1',
      });
      if (transcription && transcription.text) {
        console.log('✅ Transcription successful via OpenAI:', transcription.text);
        return transcription.text.trim();
      }
    } catch (err) {
      console.error('OpenAI transcription error, trying fallback:', err.message);
    }
  }

  // 3. Try Gemini
  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const response = await model.generateContent([
        {
          inlineData: {
            data: fileBuffer.toString('base64'),
            mimeType: mimeType
          }
        },
        { text: "Transcribe the audio message. Return only the transcript text." }
      ]);
      const resText = response.response.text();
      if (resText) {
        console.log('✅ Transcription successful via Gemini:', resText);
        return resText.trim();
      }
    } catch (err) {
      console.error('Gemini transcription error:', err.message);
    }
  }

  return null;
}

/**
 * Analyze video comments using Gemini, OpenAI, or Groq
 */
async function analyzeVideoCommentsAI(videoTitle, commentsSummaryStr) {
  const systemPrompt = `
You are an expert AI Video Editor and VFX director.
Analyze the following timestamped client feedback comments for the video "${videoTitle}" and compile a structured summary and task lists.

You must return a valid JSON object matching the schema:
{
  "summary": "Short paragraph summarizing the feedback theme...",
  "action_items": ["Action 1", "Action 2"],
  "editing_tasks": [
    { "title": "Trim intro timeline", "description": "At 00:15: Cut out scene transition.", "priority": "high", "hours": 2 }
  ],
  "vfx_tasks": [
    { "title": "Paint out wire reflection", "description": "At 01:20: Remove marker.", "priority": "medium", "hours": 4 }
  ],
  "audio_tasks": [
    { "title": "Equalize dialog volume", "description": "At 02:40: Boost levels.", "priority": "low", "hours": 1.5 }
  ],
  "subtitle_tasks": [
    { "title": "Fix typographic error", "description": "At 03:00: Correct spelling of name.", "priority": "medium", "hours": 0.5 }
  ],
  "priority_breakdown": { "high": 3, "medium": 5, "low": 2 },
  "estimated_hours": 8.0,
  "suggestions": ["Ensure warps match scene shadows", "Recalibrate volume levels"]
}

Return only raw JSON. Do not include markdown code fence formatting.
`;

  // 1. Try Gemini
  if (geminiClient) {
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    for (const modelName of models) {
      try {
        const model = geminiClient.getGenerativeModel({ model: modelName });
        const response = await model.generateContent(`${systemPrompt}\n\nFeedback Comments:\n${commentsSummaryStr}`);
        const resText = response.response.text();
        return parseAIJson(resText);
      } catch (err) {
        console.warn(`Gemini video comments analysis (${modelName}) failed: ${err.message}. Trying next fallback...`);
      }
    }
  }

  // 2. Try OpenAI
  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Feedback Comments:\n${commentsSummaryStr}` }
        ],
        response_format: { type: 'json_object' }
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (err) {
      console.error('OpenAI video analysis failed, trying fallback:', err.message);
    }
  }

  // 3. Try Groq
  if (groqClient) {
    try {
      const response = await groqClient.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Feedback Comments:\n${commentsSummaryStr}` }
        ],
        response_format: { type: 'json_object' }
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (err) {
      console.error('Groq video analysis failed:', err.message);
    }
  }

  return null;
}

const path = require('path');
const fs = require('fs');

function generateMockSubtitles() {
  return [
    { start_time: 0.50, end_time: 4.20, text: "Welcome back to DigiQuest Studio. In this cut, we reviewed the color grade." },
    { start_time: 5.00, end_time: 8.50, text: "We noticed some chromatic aberrations on the left edge and added a green screen key check." },
    { start_time: 9.20, end_time: 13.00, text: "Let's make sure the VFX composite elements blend nicely with the background plate." },
    { start_time: 14.10, end_time: 18.20, text: "Also, please check the timeline comments to see what the client requested for the intro music." },
    { start_time: 19.50, end_time: 23.00, text: "Once you make those adjustments, publish the new cut for client approval." }
  ];
}

async function generateSubtitlesAI(videoFilePath) {
  try {
    if (!videoFilePath || !fs.existsSync(videoFilePath)) {
      console.warn(`File not found for subtitle generation: ${videoFilePath}`);
      return generateMockSubtitles();
    }
    const originalName = path.basename(videoFilePath);
    
    // 1. Try Gemini via GoogleAIFileManager (handles large files up to 2GB natively)
    if (fileManager && geminiClient) {
      try {
        console.log(`Uploading video file ${originalName} to Google AI FileManager for transcribing...`);
        const uploadResult = await fileManager.uploadFile(
          videoFilePath,
          {
            mimeType: videoFilePath.endsWith('.mp4') ? 'video/mp4' : 'audio/mp3',
            displayName: originalName,
          }
        );

        // Wait for file state to become ACTIVE
        let file = await fileManager.getFile(uploadResult.file.name);
        let waitAttempts = 0;
        while (file.state === "PROCESSING" && waitAttempts < 40) {
          console.log(`Waiting for video processing... state: ${file.state}`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          file = await fileManager.getFile(uploadResult.file.name);
          waitAttempts++;
        }

        if (file.state === "ACTIVE") {
          const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
          let response = null;
          let segments = null;
          
          for (const modelName of modelsToTry) {
            try {
              console.log(`Asking Gemini (${modelName}) to transcribe and generate subtitles...`);
              const model = geminiClient.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: "application/json" }
              });

              response = await model.generateContent([
                {
                  fileData: {
                    fileUri: uploadResult.file.uri,
                    mimeType: uploadResult.file.mimeType
                  }
                },
                {
                  text: `You are an expert subtitle generator. Listen to the audio of the video and transcribe all speech/dialog/narration word-for-word chronologically.
Return a JSON array of objects, where each object has:
- "start_time": float in seconds representing when the speech segment starts (e.g., 1.25)
- "end_time": float in seconds representing when the speech segment ends (e.g., 4.50)
- "text": the precise transcribed text for that segment.

Requirements:
1. Transcribe all spoken words. Split them into natural-sounding, short subtitle segments.
2. Align the start and end times precisely with the actual audio sound.
3. The end_time of a segment MUST be greater than its start_time (typically by at least 1.5 to 4 seconds depending on length).
4. The times must be realistic (e.g. speaking "Intoxicating the world soon" takes about 3 seconds, so if it starts at 1.5, it should end around 4.5).
5. Ensure the segments are in chronological order and cover all dialogue in the video.
Return ONLY a valid JSON array. Do not wrap in markdown.`
                }
              ]);

              const resText = response.response.text();
              segments = JSON.parse(resText);
              if (Array.isArray(segments) && segments.length > 0) {
                console.log(`✅ Subtitles generated via Gemini File API (${modelName}): ${segments.length}`);
                break;
              }
            } catch (modelErr) {
              console.warn(`Gemini subtitle generation error with model ${modelName}: ${modelErr.message}`);
            }
          }

          // Clean up the file from Gemini storage in the background/finally
          try {
            await fileManager.deleteFile(uploadResult.file.name);
            console.log(`Cleaned up uploaded file: ${uploadResult.file.name}`);
          } catch (delErr) {
            console.warn(`Failed to clean up uploaded file: ${delErr.message}`);
          }

          if (Array.isArray(segments) && segments.length > 0) {
            return segments.map(seg => ({
              start_time: parseFloat(seg.start_time),
              end_time: parseFloat(seg.end_time),
              text: seg.text.trim()
            }));
          }
        } else {
          console.warn(`Gemini file upload state is ${file.state}, trying next provider.`);
          try {
            await fileManager.deleteFile(uploadResult.file.name);
          } catch (_) {}
        }
      } catch (err) {
        console.error('Gemini File API subtitle generation failed, trying fallback:', err.message);
      }
    }

    // Load file buffer for REST/form-data fallback APIs (Groq / OpenAI)
    const fileBuffer = fs.readFileSync(videoFilePath);

    // 2. Try Groq (Whisper large v3) - limited to 25MB
    if (groqClient && fileBuffer.length < 25 * 1024 * 1024) {
      try {
        const { toFile } = require('groq-sdk');
        const fileObject = await toFile(fileBuffer, originalName);
        const response = await groqClient.audio.transcriptions.create({
          file: fileObject,
          model: 'whisper-large-v3',
          response_format: 'verbose_json'
        });
        if (response && response.segments && response.segments.length > 0) {
          console.log(`✅ Subtitles generated via Groq segments: ${response.segments.length}`);
          return response.segments.map(seg => ({
            start_time: parseFloat(seg.start),
            end_time: parseFloat(seg.end),
            text: seg.text.trim()
          }));
        }
      } catch (err) {
        console.error('Groq subtitle generation error, trying fallback:', err.message);
      }
    }

    // 3. Try OpenAI (Whisper-1) - limited to 25MB
    if (openaiClient && fileBuffer.length < 25 * 1024 * 1024) {
      try {
        const fileObject = await OpenAI.toFile(fileBuffer, originalName);
        const response = await openaiClient.audio.transcriptions.create({
          file: fileObject,
          model: 'whisper-1',
          response_format: 'verbose_json'
        });
        if (response && response.segments && response.segments.length > 0) {
          console.log(`✅ Subtitles generated via OpenAI segments: ${response.segments.length}`);
          return response.segments.map(seg => ({
            start_time: parseFloat(seg.start),
            end_time: parseFloat(seg.end),
            text: seg.text.trim()
          }));
        }
      } catch (err) {
        console.error('OpenAI subtitle generation error, trying fallback:', err.message);
      }
    }
  } catch (err) {
    console.error('Video file reading error:', err.message);
  }

  // Fallback Mock Subtitles
  console.log('ℹ️ Generating mock subtitle segments.');
  return generateMockSubtitles();
}

module.exports = {
  analyzeFeedback,
  chatbotChat,
  transcribeAudio,
  analyzeVideoCommentsAI,
  generateSubtitlesAI
};


const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const chatDisplay = document.getElementById('chat-display');
const startChatContainer = document.getElementById('start-chat-container');
const startChatButton = document.getElementById('start-chat-button');

// Splash screen elements
const splashScreen = document.getElementById('splash-screen');
const mainInterface = document.getElementById('main-interface');
const splashText = document.getElementById('splash-text');
const loader = document.querySelector('.loader');

// AI Face elements
const aiFaceContainer = document.getElementById('ai-face-container');
const aiFaceImage = document.getElementById('ai-face-image');
const statusTextElement = document.getElementById('status-text');

// Set the AI face image source to the new URL provided by the user
aiFaceImage.src = 'https://i.ibb.co/wt1KjSF/1000097633-removebg-preview.png';
aiFaceImage.onerror = () => {
    console.error("Failed to load AI face image from provided URL. Using generic placeholder.");
    aiFaceImage.src = 'https://placehold.co/250x250/374151/E2E8F0?text=AI+Friend+Fallback';
};


let lastQuestionAsked = '';
let chatHistory = []; // Stores objects like {role: 'user', text: 'hello'} or {role: 'ai', text: 'hi there'}
let selectedMaleVoice = null;
let voicesLoaded = false; // Flag to check if voices are loaded

// Speech Recognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isListening = false; // Tracks if recognition is actively running
let finalTranscriptAccumulator = '';
let silenceTimeout;

// micState now simpler: 'off' or 'listening'
let micState = 'off'; // 'off', 'listening'

// Speech Synthesis (TTS) setup
let currentUtterance = null;
let splashTransitionTimeout = null;
let transitionInitiated = false;

// Function to select a male voice for Hindi (hi-IN)
function selectMaleVoice() {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) {
        console.log("selectMaleVoice: No voices available yet. Waiting for 'voiceschanged' event.");
        return; // Exit if no voices are loaded yet
    }
    voicesLoaded = true; // Set flag once voices are available
    console.log("selectMaleVoice: Available voices:", voices.map(v => ({ name: v.name, lang: v.lang, default: v.default, localService: v.localService })));

    // Try to find a male voice for hi-IN
    selectedMaleVoice = voices.find(voice =>
        voice.lang === 'hi-IN' && (voice.name.toLowerCase().includes('male') || voice.name.toLowerCase().includes('पुरुष'))
    );

    // Fallback to any hi-IN voice if no specific male voice is found
    if (!selectedMaleVoice) {
        selectedMaleVoice = voices.find(voice => voice.lang === 'hi-IN');
        if (selectedMaleVoice) {
            console.warn("selectMaleVoice: No specific male voice found for hi-IN, falling back to any hi-IN voice:", selectedMaleVoice.name);
        }
    }

    // Fallback to any available male voice if no hi-IN voice is found
    if (!selectedMaleVoice) {
        selectedMaleVoice = voices.find(voice => voice.default && (voice.name.toLowerCase().includes('male') || voice.name.toLowerCase().includes('पुरुष')));
        if (selectedMaleVoice) {
            console.warn("selectMaleVoice: No hi-IN voice found, falling back to default male voice:", selectedMaleVoice.name);
        }
    }

    // Final fallback to default voice if no male voice is explicitly found
    if (!selectedMaleVoice) {
        selectedMaleVoice = voices.find(voice => voice.default);
        if (selectedMaleVoice) {
            console.warn("selectMaleVoice: No suitable male voice found for Hindi. Falling back to default system voice:", selectedMaleVoice.name);
        } else {
            console.error("selectMaleVoice: No voices available at all!");
        }
    }

    if (selectedMaleVoice) {
        console.log("selectMaleVoice: Selected AI Voice:", selectedMaleVoice.name, selectedMaleVoice.lang);
    }
}

// Listen for voiceschanged event to ensure voices are loaded
speechSynthesis.onvoiceschanged = selectMaleVoice;
// Call immediately in case voices are already loaded (for initial load)
selectMaleVoice();


// System instruction for the AI's persona and rules
const systemInstruction = {
    role: "user",
    parts: [{
        text: "आप एक BPSC छात्र के लिए एक AI मित्र हैं। आपका नाम अंशल कुमार है। आपको छात्रों के प्रश्नों का उत्तर देना है। यदि छात्र 'मुझसे प्रश्न पूछो' कहे, तो आपको BPSC से संबंधित सामान्य ज्ञान के प्रश्न पूछने हैं। यदि छात्र जवाब दे, तो आपको तुरंत बताना है कि जवाब सही है या गलत, और गलत होने पर सही जवाब भी बताना है। कृपया अपने जवाबों में किसी भी प्रकार के बोल्डिंग (जैसे **शब्द**) का उपयोग न करें। यदि आप प्रश्न पूछते हैं, तो प्रश्न को स्पष्ट रूप से समाप्त करें और अगले प्रश्न के लिए तैयार रहें।"
    }]
};

// Function to handle splash screen transition to main interface
function transitionToMainInterface() {
    if (transitionInitiated) {
        return;
    }
    transitionInitiated = true;

    if (splashTransitionTimeout) {
        clearTimeout(splashTransitionTimeout);
        splashTransitionTimeout = null;
    }

    splashScreen.classList.add('fade-out');
    setTimeout(() => {
        splashScreen.style.display = 'none';
        mainInterface.classList.add('visible');
        
        // Show the start chat button overlay
        startChatContainer.classList.add('visible');
        statusTextElement.textContent = "चैट शुरू करने के लिए 'चैट शुरू करें' पर क्लिक करें।";

        // Input and buttons remain disabled until chat starts
        userInput.disabled = true;
        sendButton.disabled = true;
        micButton.disabled = true;

    }, 1000); // Allow 1 second for splash screen fade-out
}

// Function to start continuous listening (no wake word)
function startContinuousListening() {
    if (SpeechRecognition && recognition) {
        micState = 'listening';
        recognition.start();
        userInput.placeholder = "अपना संदेश यहाँ बोलें या टाइप करें...";
        updateAiState('listening'); // AI shows listening state
        finalTranscriptAccumulator = ''; // Clear transcript for new query
        console.log("startContinuousListening: Mic is now listening continuously.");
    } else {
        userInput.placeholder = "अपना संदेश यहाँ लिखें...";
        // No speak here, as it's handled by the initial greeting or error
        console.warn("startContinuousListening: Speech Recognition not supported.");
    }
}


// Function to update AI's visual state (now uses glow effects on image container)
function updateAiState(state) {
    aiFaceContainer.classList.remove('listening', 'thinking', 'speaking');
    statusTextElement.textContent = '';

    switch (state) {
        case 'idle':
            // Default state, no special classes
            break;
        case 'listening':
            aiFaceContainer.classList.add('listening');
            statusTextElement.textContent = 'सुन रहा हूँ...';
            break;
        case 'thinking':
            aiFaceContainer.classList.add('thinking');
            statusTextElement.textContent = 'सोच रहा हूँ...';
            break;
        case 'speaking':
            aiFaceContainer.classList.add('speaking');
            statusTextElement.textContent = 'बोल रहा हूँ...';
            break;
    }
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.interimResults = true;
    recognition.continuous = true; // Keep listening continuously

    const SILENCE_TIMEOUT_MS = 5000; // Increased silence timeout to 5 seconds

    function startSilenceTimeout() {
        clearTimeout(silenceTimeout);
        silenceTimeout = setTimeout(() => {
            if (isListening) { // Only stop if recognition is active
                console.log("Silence detected, stopping recognition.");
                recognition.stop();
            }
        }, SILENCE_TIMEOUT_MS);
    }

    recognition.onstart = () => {
        isListening = true;
        micButton.classList.add('recording');
        sendButton.disabled = true;
        updateAiState('listening');
        console.log("recognition.onstart: Recognition started. MicState:", micState);
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let currentFinalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                currentFinalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        const fullCurrentTranscript = finalTranscriptAccumulator + currentFinalTranscript + interimTranscript;
        userInput.value = fullCurrentTranscript; // Always show current speech in input
        console.log("recognition.onresult: Current Transcript:", fullCurrentTranscript, "MicState:", micState);

        // Reset silence timeout on any speech detected
        if (fullCurrentTranscript.trim().length > 0) {
            startSilenceTimeout();
        }

        // In continuous listening mode, accumulate final results for the query
        if (currentFinalTranscript) {
            finalTranscriptAccumulator += currentFinalTranscript;
            console.log("recognition.onresult: Final Transcript Accumulated:", finalTranscriptAccumulator);
        }
    };

    recognition.onerror = (event) => {
        console.error('recognition.onerror: Speech recognition error:', event.error);
        let errorMessage = "क्षमा करें, आवाज़ पहचानने में कोई समस्या हुई।";
        if (event.error === 'not-allowed') {
            errorMessage = "माइक्रोफ़ोन का उपयोग करने की अनुमति नहीं दी गई। कृपया ब्राउज़र सेटिंग्स में अनुमति दें।";
        } else if (event.error === 'no-speech') {
            errorMessage = "कोई आवाज़ नहीं सुनी गई।";
        }
        speak(errorMessage); // AI speaks error

        isListening = false;
        micButton.classList.remove('recording');
        sendButton.disabled = false;
        clearTimeout(silenceTimeout);
        updateAiState('idle'); // Reset AI state
        
        // After error, try to restart continuous listening
        startContinuousListening(); 
    };

    recognition.onend = () => {
        console.log("recognition.onend: Recognition ended. Current micState:", micState, "isListening:", isListening);
        isListening = false;
        micButton.classList.remove('recording');
        sendButton.disabled = false;
        clearTimeout(silenceTimeout);
        
        // If recognition ended and we were listening for a query
        if (micState === 'listening') {
            if (finalTranscriptAccumulator.trim() !== '') {
                console.log("recognition.onend: Processing query:", finalTranscriptAccumulator);
                userInput.value = finalTranscriptAccumulator; // Ensure final transcript is in input
                sendMessage(); // Send the accumulated query
            } else {
                console.log("recognition.onend: No query detected, restarting continuous listening.");
                userInput.value = ''; // Clear input
                updateAiState('idle');
                startContinuousListening(); // Always restart continuous listening
            }
        }
    };

    micButton.addEventListener('click', () => {
        if (isListening) {
            console.log("Mic button clicked: Stopping recognition manually.");
            recognition.stop();
            micState = 'off'; // Manual stop
            updateAiState('idle');
            userInput.placeholder = "अपना संदेश यहाँ लिखें या माइक्रोफ़ोन पर बोलें...";
            sendButton.disabled = false;
        } else {
            console.log("Mic button clicked: Starting continuous recognition.");
            startContinuousListening();
        }
    });
    userInput.disabled = true;
    sendButton.disabled = true;
    micButton.disabled = true; // Initially disabled until chat starts
} else {
    micButton.style.display = 'none';
    userInput.placeholder = "अपना संदेश यहाँ लिखें...";
    userInput.disabled = false;
    sendButton.disabled = false;
    console.warn("Speech Recognition API not supported in this browser. Please use a compatible browser like Chrome.");
}

// Function to display text in the chat box
function displayChatMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', sender === 'ai' ? 'ai' : 'user');
    messageDiv.textContent = text;
    chatDisplay.appendChild(messageDiv);
    // Scroll to the bottom
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}


// Function to speak text
function speak(text) {
    console.log("speak: Speak function called with text:", text);

    // Display AI's speech in the chat box
    displayChatMessage(text, 'ai');

    if (currentUtterance && speechSynthesis.speaking) {
        console.log("speak: Cancelling previous utterance.");
        speechSynthesis.cancel();
    }

    // Always re-select voice right before speaking to ensure it's up-to-date
    selectMaleVoice(); 
    
    if (!selectedMaleVoice) {
        console.error("speak: No voice selected even after re-attempt. Cannot speak.");
        updateAiState('idle');
        // If no voice, we still need to transition to the next state for mic
        startContinuousListening(); // Always restart continuous listening
        return; // Exit if no voice is available
    }
    
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'hi-IN'; 
    currentUtterance.voice = selectedMaleVoice; // Set the selected male voice
    
    console.log("speak: Utterance properties: text='", text, "', lang='hi-IN', voice='", selectedMaleVoice.name, "'");

    currentUtterance.onstart = () => {
        console.log("speak: Speech started.");
        updateAiState('speaking'); // AI shows speaking state
    };
    currentUtterance.onend = () => {
        console.log("speak: Speech ended. Current micState:", micState);
        updateAiState('idle'); // Back to idle after speaking
        startContinuousListening(); // Always restart continuous listening after AI speaks
    };
    currentUtterance.onerror = (event) => {
        console.error('speak: Speech synthesis error during speaking:', event.error, event);
        updateAiState('idle'); // Back to idle on error
        startContinuousListening(); // Even on error, try to restart continuous listening
    };
    speechSynthesis.speak(currentUtterance);
    console.log("speak: speechSynthesis.speak() called.");
}

// Function to send message to AI
async function sendMessage() {
    const userText = userInput.value.trim();
    if (userText === '') {
        console.log("sendMessage: Empty user text, restarting continuous listening.");
        updateAiState('idle');
        startContinuousListening();
        return;
    }

    // Display user's message in the chat box
    displayChatMessage(userText, 'user');

    userInput.value = ''; // Clear input field

    // Stop recognition if it's currently active (it might be if user typed and pressed send)
    if (isListening) {
        recognition.stop(); 
        console.log("sendMessage: Recognition stopped (manual or due to query submission).");
    }
    micState = 'off'; // Temporarily off while thinking/speaking
    
    updateAiState('thinking'); // AI shows thinking state

    let aiResponseText = "क्षमा करें, मुझे आपके अनुरोध को समझने में समस्या हुई।";

    // Check for creator query - Hardcoded response
    const lowerCaseUserText = userText.toLowerCase();
    if (lowerCaseUserText.includes('किसने बनाया') ||
        lowerCaseUserText.includes('कौन बनाया') ||
        lowerCaseUserText.includes('तुम्हें किसने बनाया') ||
        lowerCaseUserText.includes('तुम्हारा निर्माता कौन है') ||
        lowerCaseUserText.includes('who made you') ||
        lowerCaseUserText.includes('who created you')) {
        aiResponseText = "मुझे अंशल कुमार द्वारा बनाया गया है।";
        console.log("sendMessage: AI Creator Response (hardcoded):", aiResponseText);
        speak(aiResponseText);
        chatHistory.push({ role: "model", text: aiResponseText }); // Store in chat history
        return; // Do not send to Gemini API
    }


    let currentConversationParts = [];

    const isLikelyAnswer = lastQuestionAsked && userText.length < 50 &&
                           !userText.toLowerCase().includes('प्रश्न पूछो') &&
                           !userText.toLowerCase().includes('सवाल पूछo') &&
                           !userText.toLowerCase().includes('मुझसे प्रश्न पूछo'); // Corrected typo

    if (isLikelyAnswer) {
        currentConversationParts.push({ text: `पिछला प्रश्न: "${lastQuestionAsked}"। छात्र का जवाब: "${userText}"। कृपया इस जवाब का मूल्यांकन करें और फिर एक नया प्रश्न पूछें या आगे की बातचीत जारी रखें।` });
    } else {
        currentConversationParts.push({ text: userText });
    }

    chatHistory.push({ role: "user", text: userText }); // Store user's message in chat history

    const payload = {
        contents: [systemInstruction, ...chatHistory.map(msg => ({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] }))]
    };

    try {
        // IMPORTANT: If running this code outside of a Canvas environment (e.g., CodePen, local HTML file),
        // you will need to replace the empty string below with your actual Gemini API Key.
        // You can get one from Google AI Studio: https://aistudio.google.com/app/apikey
        const apiKey = "AIzaSyB8QTDyvcCgjAykRJVwornqL9bg1AxI6vY"; // API Key added here
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
        }

        const result = await response.json();
        
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            aiResponseText = result.candidates[0].content.parts[0].text;
            aiResponseText = aiResponseText.replace(/\*\*/g, '');

            if (aiResponseText.includes('?') &&
                !aiResponseText.includes('सही जवाब!') &&
                !aiResponseText.includes('गलत है')) {
                lastQuestionAsked = aiResponseText;
            } else {
                lastQuestionAsked = '';
            }

        } else {
            // Handle cases where response structure is unexpected but no HTTP error
            console.warn("sendMessage: Unexpected API response structure:", result);
            aiResponseText = "क्षमा करें, AI से प्रतिक्रिया प्राप्त करने में समस्या हुई।";
        }
        console.log("sendMessage: AI Response (Text to speak):", aiResponseText);
        speak(aiResponseText); // This will also display in chat via displayChatMessage
        chatHistory.push({ role: "model", text: aiResponseText }); // Store AI's message

    } catch (error) {
        console.error("Error fetching from Gemini API:", error);
        const errorMessage = `क्षमा करें, AI से कनेक्ट करने में कोई समस्या आ गई है: ${error.message}। कृपया कुछ देर बाद पुनः प्रयास करें।`;
        speak(errorMessage); // This will also display in chat via displayChatMessage
        chatHistory.push({ role: "model", text: errorMessage }); // Store error message
    } finally {
        // Mic state transition handled by speak().onend or onerror
    }
}

// Event listeners for text input
sendButton.addEventListener('click', () => {
    // If user types and clicks send, stop current recognition and send message
    if (isListening) {
        recognition.stop();
        micState = 'off'; // Temporarily set off
    }
    sendMessage();
});

userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !sendButton.disabled) {
        // If user types and presses enter, stop current recognition and send message
        if (isListening) {
            recognition.stop();
            micState = 'off'; // Temporarily set off
        }
        sendMessage();
    }
});

// Event listener for the new "Start Chat" button
startChatButton.addEventListener('click', () => {
    startChatContainer.classList.remove('visible'); // Hide the overlay
    userInput.disabled = false; // Enable input
    sendButton.disabled = false; // Enable send button
    micButton.disabled = false; // Enable mic button

    const initialGreeting = "नमस्ते! मैं अंशल कुमार हूँ, आपका AI मित्र। मैं BPSC परीक्षा की तैयारी में आपकी मदद कर सकता हूँ।";
    speak(initialGreeting); // Speak the initial greeting
    // startContinuousListening will be called onend of this speech
});


// Initial welcome message and splash screen logic on load
window.onload = function() {
    const welcomeMessage = "अंशल की AI दुनिया में आपका स्वागत है!"; 

    splashScreen.style.display = 'flex';
    
    // Wait for loader animation to complete (2.2s delay + 0.5s duration = 2.7s).
    // Adding a small buffer, so 3 seconds total before starting welcome speech.
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(welcomeMessage);
        utterance.lang = 'hi-IN';
        selectMaleVoice(); // Ensure voice is selected for welcome message

        if (selectedMaleVoice) {
            utterance.voice = selectedMaleVoice;
            console.log("onload: Welcome utterance voice set to:", selectedMaleVoice.name);
        } else {
            console.warn("onload: No specific male voice selected for welcome message, using default.");
        }

        utterance.onend = () => {
            console.log("onload: Welcome speech ended.");
            transitionToMainInterface(); // Transition after welcome speech ends
        };
        utterance.onerror = (event) => {
            console.error('onload: Welcome speech error:', event.error);
            transitionToMainInterface(); // Transition even on speech error
        };
        speechSynthesis.speak(utterance);
        console.log("onload: Attempting to speak welcome message.");
    }, 3000); // Wait 3 seconds for splash text and loader animations to be visible
};

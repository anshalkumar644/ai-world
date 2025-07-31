// script.js
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const chatDisplay = document.getElementById('chat-display'); // Added chatDisplay element

// Splash screen elements
const splashScreen = document.getElementById('splash-screen');
const mainInterface = document.getElementById('main-interface');
const splashText = document.getElementById('splash-text');
const loader = document.querySelector('.loader');
const startButton = document.getElementById('start-button'); // New Start Button element

// AI Face elements
const aiFaceContainer = document.getElementById('ai-face-container');
const aiFaceImage = document.getElementById('ai-face-image');
const statusTextElement = document.getElementById('status-text');

// Menu bar elements
const dropbtn = document.querySelector('.dropbtn'); // Get the dropdown button
const dropdownContent = document.querySelector('.dropdown-content'); // Get the dropdown content
const dropdownParent = document.querySelector('.dropdown'); // Get the parent .dropdown div
const homeLink = document.getElementById('home-link');
const aboutLink = document.getElementById('about-link');
const contactLink = document.getElementById('contact-link');
const helpLink = document.getElementById('help-link');


// Set the AI face image source to the new URL provided by the user
aiFaceImage.src = 'https://i.ibb.co/wt1KjSF/1000097633-removebg-preview.png';
aiFaceImage.onerror = () => {
    console.error("Failed to load AI face image from provided URL. Using generic placeholder.");
    aiFaceImage.src = 'https://placehold.co/250x250/374151/E2E8F0?text=AI+Friend+Fallback';
};


let lastQuestionAsked = '';
let chatHistory = [];
let selectedMaleVoice = null;
let voicesLoaded = false; // Flag to check if voices are loaded

// Speech Recognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isListening = false;
let finalTranscriptAccumulator = '';
let silenceTimeout;

// Speech Synthesis (TTS) setup
let currentUtterance = null;
let splashTransitionTimeout = null;
let transitionInitiated = false;

// Function to select a male voice for Hindi (hi-IN)
function selectMaleVoice() {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) {
        console.log("No voices available yet. Waiting for 'voiceschanged' event.");
        return; // Exit if no voices are loaded yet
    }
    voicesLoaded = true; // Set flag once voices are available
    console.log("Available voices:", voices.map(v => ({ name: v.name, lang: v.lang, default: v.default })));

    // Try to find a male voice for hi-IN
    selectedMaleVoice = voices.find(voice =>
        voice.lang === 'hi-IN' && (voice.name.toLowerCase().includes('male') || voice.name.toLowerCase().includes('?????'))
    );

    // Fallback to any hi-IN voice if no specific male voice is found
    if (!selectedMaleVoice) {
        selectedMaleVoice = voices.find(voice => voice.lang === 'hi-IN');
    }

    // Fallback to any available male voice if no hi-IN voice is found
    if (!selectedMaleVoice) {
        selectedMaleVoice = voices.find(voice => voice.default && (voice.name.toLowerCase().includes('male') || voice.name.toLowerCase().includes('?????')));
    }

    // Final fallback to default voice if no male voice is explicitly found
    if (!selectedMaleVoice) {
        selectedMaleVoice = voices.find(voice => voice.default);
    }

    if (selectedMaleVoice) {
        console.log("Selected AI Voice:", selectedMaleVoice.name, selectedMaleVoice.lang);
    } else {
        console.warn("No suitable male voice found for Hindi. Using default system voice.");
    }

    // Enable start button once voices are loaded (or after a short delay)
    startButton.disabled = false;
}

// Listen for voiceschanged event to ensure voices are loaded
speechSynthesis.onvoiceschanged = selectMaleVoice;
// Call immediately in case voices are already loaded
selectMaleVoice();


// System instruction for the AI's persona and rules
const systemInstruction = {
    role: "user",
    parts: [{
        text: "?? ?? BPSC ????? ?? ??? ?? AI ????? ???? ???? ??? ???? ????? ??? ???? ??????? ?? ???????? ?? ????? ???? ??? ??? ????? '????? ?????? ????' ???, ?? ???? BPSC ?? ??????? ??????? ????? ?? ?????? ????? ???? ??? ????? ???? ??, ?? ???? ????? ????? ?? ?? ???? ??? ?? ?? ???, ?? ??? ???? ?? ??? ???? ?? ????? ??? ????? ???? ?????? ??? ???? ?? ?????? ?? ???????? (???? **????**) ?? ????? ? ????? ??? ?? ?????? ????? ???, ?? ?????? ?? ?????? ??? ?? ?????? ???? ?? ???? ?????? ?? ??? ????? ?????"
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
        userInput.disabled = false; // Ensure input is enabled when main interface becomes visible
        sendButton.disabled = false; // Ensure send button is enabled
        // Auto-start mic only if SpeechRecognition is supported
        if (SpeechRecognition && recognition) {
            recognition.start();
        } else {
            speak("????? ????, ???? ???????? ????? ?????????? ?? ?????? ???? ???? ??? ?? ???? ???? ?????? ?? ???? ????");
        }
        userInput.focus();
    }, 1000);
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
            statusTextElement.textContent = '??? ??? ???...';
            break;
        case 'thinking':
            aiFaceContainer.classList.add('thinking');
            statusTextElement.textContent = '??? ??? ???...';
            break;
        case 'speaking':
            aiFaceContainer.classList.add('speaking');
            statusTextElement.textContent = '??? ??? ???...';
            break;
    }
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.interimResults = true;
    recognition.continuous = true;

    const SILENCE_TIMEOUT_MS = 3000;

    function startSilenceTimeout() {
        clearTimeout(silenceTimeout);
        silenceTimeout = setTimeout(() => {
            if (isListening) {
                recognition.stop();
            }
        }, SILENCE_TIMEOUT_MS);
    }

    recognition.onstart = () => {
        isListening = true;
        micButton.classList.add('recording');
        userInput.placeholder = "?????...";
        sendButton.disabled = true;
        userInput.disabled = false; // Ensure input is enabled when recognition starts
        finalTranscriptAccumulator = '';
        updateAiState('listening'); // AI shows listening state
        startSilenceTimeout();
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

        userInput.value = finalTranscriptAccumulator + interimTranscript;

        if (currentFinalTranscript) {
            finalTranscriptAccumulator += currentFinalTranscript;
            userInput.value = finalTranscriptAccumulator;
            startSilenceTimeout();
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        let errorMessage = "????? ????, ????? ??????? ??? ??? ?????? ????";
        if (event.error === 'not-allowed') {
            errorMessage = "??????????? ?? ????? ???? ?? ?????? ???? ?? ??? ????? ???????? ???????? ??? ?????? ????";
        } else if (event.error === 'no-speech') {
            errorMessage = "??? ????? ???? ???? ??? ????? ??? ?? ?????? ?????";
        }
        if (mainInterface.classList.contains('visible')) {
            speak(errorMessage);
        }

        isListening = false;
        micButton.classList.remove('recording');
        userInput.placeholder = "???? ????? ???? ????? ?? ??????????? ?? ?????...";
        sendButton.disabled = false;
        userInput.disabled = false; // Ensure input is enabled on error
        clearTimeout(silenceTimeout);
        updateAiState('idle'); // Reset AI state
    };

    recognition.onend = () => {
        isListening = false;
        micButton.classList.remove('recording');
        userInput.placeholder = "???? ????? ???? ????? ?? ??????????? ?? ?????...";
        sendButton.disabled = false;
        userInput.disabled = false; // Ensure input is enabled when recognition ends
        clearTimeout(silenceTimeout);

        if (finalTranscriptAccumulator.trim() !== '') {
            userInput.value = finalTranscriptAccumulator;
            sendMessage();
        } else {
            userInput.value = '';
            updateAiState('idle'); // Back to idle if nothing was said
        }
    };

    micButton.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });
    userInput.disabled = true; // Initial state: disabled
    sendButton.disabled = true; // Initial state: disabled

} else {
    micButton.style.display = 'none';
    userInput.placeholder = "???? ????? ???? ?????...";
    userInput.disabled = false; // Enabled if SR not supported
    sendButton.disabled = false; // Enabled if SR not supported
}

// Function to display text in the chat box
function displayChatMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', sender === 'ai' ? 'ai' : 'user');
    messageDiv.textContent = text;
    chatDisplay.appendChild(messageDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}


// Function to speak text
function speak(text) {
    if (currentUtterance && speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'hi-IN'; // Still set language for better matching
    if (selectedMaleVoice) {
        currentUtterance.voice = selectedMaleVoice; // Set the selected male voice
    }
    currentUtterance.onstart = () => {
        updateAiState('speaking'); // AI shows speaking state
    };
    currentUtterance.onend = () => {
        updateAiState('idle'); // Back to idle after speaking
        // After AI finishes speaking, restart recognition if supported
        if (SpeechRecognition && recognition) {
            recognition.start();
        }
    };
    currentUtterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        updateAiState('idle'); // Back to idle on error
        // Even on error, try to restart recognition
        if (SpeechRecognition && recognition) {
            recognition.start();
        }
    };
    speechSynthesis.speak(currentUtterance);
}

// Function to send message to AI
async function sendMessage() {
    const userText = userInput.value.trim();
    if (userText === '') return;

    displayChatMessage(userText, 'user'); // Display user's message in chat
    userInput.value = '';

    // Stop recognition when user sends a message (either by typing or after voice input is processed)
    if (isListening) {
        recognition.stop(); // This will trigger recognition.onend, which then calls sendMessage
    }
    
    updateAiState('thinking'); // AI shows thinking state

    let currentConversationParts = [];

    const isLikelyAnswer = lastQuestionAsked && userText.length < 50 &&
                           !userText.toLowerCase().includes('?????? ????') &&
                           !userText.toLowerCase().includes('???? ???o') &&
                           !userText.toLowerCase().includes('????? ?????? ????');

    if (isLikelyAnswer) {
        currentConversationParts.push({ text: `????? ??????: "${lastQuestionAsked}"? ????? ?? ????: "${userText}"? ????? ?? ???? ?? ????????? ???? ?? ??? ?? ??? ?????? ????? ?? ??? ?? ?????? ???? ?????` });
    } else {
        currentConversationParts.push({ text: userText });
    }

    chatHistory.push({ role: "user", parts: currentConversationParts });

    const payload = {
        contents: [systemInstruction, ...chatHistory]
    };

    try {
        const apiKey = "AIzaSyC1N0DW220j1CR7sdBVocTTvCTKaFo_g7o"; // ???? API ????? ???? ????? ?? ??
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        let aiResponseText = "????? ????, ???? ???? ?????? ?? ????? ??? ?????? ????";

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            aiResponseText = result.candidates[0].content.parts[0].text;
            aiResponseText = aiResponseText.replace(/\*\*/g, '');

            if (aiResponseText.includes('?') &&
                !aiResponseText.includes('??? ????!') &&
                !aiResponseText.includes('??? ??')) {
                lastQuestionAsked = aiResponseText;
            } else {
                lastQuestionAsked = '';
            }

        }

        displayChatMessage(aiResponseText, 'ai'); // Display AI's message in chat
        speak(aiResponseText);
        chatHistory.push({ role: "model", parts: [{ text: aiResponseText }] });

    } catch (error) {
        console.error("Error fetching from Gemini API:", error);
        const errorMessage = "????? ????, AI ?? ?????? ???? ??? ??? ?????? ? ?? ??? ????? ??? ??? ??? ???? ?????? ?????";
        displayChatMessage(errorMessage, 'ai'); // Display error in chat
        speak(errorMessage);
        chatHistory.push({ role: "model", parts: [{ text: errorMessage }] });
    } finally {
        // AI state will be set to 'idle' by speak().onend or onerror
        // Mic will be restarted by speak().onend or onerror
    }
}

// Event listeners for text input
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !sendButton.disabled) {
        sendMessage();
    }
});

// Dropdown toggle logic
dropbtn.addEventListener('click', function(event) {
    event.stopPropagation(); // Prevent the click from bubbling up to the window
    dropdownParent.classList.toggle('active'); // Toggle 'active' class on the parent dropdown
});

// Close the dropdown if the user clicks outside of it
window.addEventListener('click', function(event) {
    // Check if the clicked element is not the dropdown button itself
    // AND if the clicked element is not inside the dropdown content
    if (!event.target.matches('.dropbtn') && !event.target.closest('.dropdown-content')) {
        if (dropdownParent.classList.contains('active')) {
            dropdownParent.classList.remove('active');
        }
    }
});

// Dropdown menu item click handlers
homeLink.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent default link behavior
    dropdownParent.classList.remove('active'); // Close dropdown
    displayChatMessage("?? ??? ??? ?? ????", 'ai');
    speak("?? ??? ??? ?? ????");
});

aboutLink.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent default link behavior
    dropdownParent.classList.remove('active'); // Close dropdown
    const aboutText = "??????! ???? ??? ???? ????? ??? ???? ???? ????? ?????? ????? ??? ??? ??? ?? ??????? ??????? AI ??? ?? ??? ???? ????? ??? ?????? ?? ???? ???? ??? ?? ???? ???????? ???? ???, ?? ?? ???? ?? ??????? ??? ????? ?? ??? ?? ???? ???? ?? ???? ??? ???? ?????? ??? ???? ????";
    displayChatMessage(aboutText, 'ai');
    speak(aboutText);
});

contactLink.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent default link behavior
    dropdownParent.classList.remove('active'); // Close dropdown
    const email = 'kumaranshak481@gmail.com';
    const subject = 'AI World App ?? ??????';
    const body = '?????? ???? ?????,\n\n??? ???? AI World App ?? ???? ??? ???? ?????? ???? ????? ????\n\n???????,';
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank'); // Open email client in a new tab
    displayChatMessage(`?? ???? ??? ???? ???: ${email}`, 'ai');
});

helpLink.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent default link behavior
    dropdownParent.classList.remove('active'); // Close dropdown
    const helpText = `
        ??????:
        1. ??????????? ??? ???? ?? ??? ???
           - ????????? ???? ?? ???? ???????? ?? ??????????? ?????? ?? ?????? ???
           - ???? ?????? ???????? ??? ??????????? ?? ???? ?????
           - ?? ???? ??????? ??? ??????
        2. AI ???? ???? ?? ??? ???
           - ????????? ???? ?? ???? ??? ?? ????? ??????? ??????? ???
           - '???? ????' ??? ?? ????? ???? AI ?? ?????? ?????
           - ??? ?????? ??? ???? ??, ?? ??? ?? ???????? ?????
        3. ????? ???? ? ??? ???
           - ????????? ???? ?? ???? ?????? ?? ??????? ???? ???
           - ???? ???????? ?? ????? ???????? ?? ???? ?????
    `;
    displayChatMessage(helpText, 'ai');
    speak("?????? ?????? ??? ??? ???");
});


// Initial welcome message and splash screen logic on load
window.onload = function() {
    const welcomeMessage = "???? ?? AI ?????? ??? ???? ?????? ??!";

    splashScreen.style.display = 'flex';
    loader.style.animation = 'spin 1s linear infinite, fadeInLoader 0.5s forwards 2.2s';

    // Handle start button click
    startButton.addEventListener('click', () => {
        // Speak welcome message only after user interaction
        const utterance = new SpeechSynthesisUtterance(welcomeMessage);
        utterance.lang = 'hi-IN';
        if (selectedMaleVoice) {
            utterance.voice = selectedMaleVoice;
        }

        utterance.onend = () => {
            console.log("Welcome speech ended.");
            transitionToMainInterface(); // Transition after speech ends
        };
        utterance.onerror = (event) => {
            console.error('Welcome speech error:', event.error);
            transitionToMainInterface(); // Transition even on speech error
        };

        speechSynthesis.speak(utterance);
        startButton.disabled = true; // Disable button after click
    });

    // Fallback for start button if voices don't load quickly
    setTimeout(() => {
        if (!voicesLoaded) {
            console.warn("Voices not loaded in time, enabling start button as fallback.");
            startButton.disabled = false;
        }
    }, 4000); // Give some time for voices to load, then enable button
};

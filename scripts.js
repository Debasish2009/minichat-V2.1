// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCOjehIImu1mE0xXH1f4eSRxCJNGKTJnMg",
    authDomain: "loginsystem-35c58.firebaseapp.com",
    databaseURL: "https://loginsystem-35c58-default-rtdb.firebaseio.com",
    projectId: "loginsystem-35c58",
    storageBucket: "loginsystem-35c58.appspot.com",
    messagingSenderId: "874316934984",
    appId: "1:874316934984:web:bd41723ee314f52f50cd7d",
    measurementId: "G-4BJR3G1JB6"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let username = "";
let userIP = "";
let userLocation = { lat: null, lon: null };
let deviceDetails = {};
let roomCode = "";

window.onload = () => {
    // Fetch the user's IP address
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            userIP = data.ip;
        })
        .catch(error => console.error('Error fetching IP address:', error));

    // Fetch the user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            userLocation.lat = position.coords.latitude;
            userLocation.lon = position.coords.longitude;
        }, error => {
            console.error('Error fetching location:', error);
        });
    } else {
        console.error('Geolocation is not supported by this browser.');
    }

    // Fetch device details using UAParser
    const parser = new UAParser();
    const result = parser.getResult();
    deviceDetails = {
        device: result.device.model || "Unknown Device",
        os: result.os.name || "Unknown OS",
        osVersion: result.os.version || "Unknown Version",
        browser: result.browser.name || "Unknown Browser",
        browserVersion: result.browser.version || "Unknown Version"
    };

    // Request notification permission
    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
};

const loginScreen = document.getElementById("login-screen");
const usernamePromptScreen = document.getElementById("username-prompt");
const guestUsernameInput = document.getElementById("guest-username");
const submitUsernameButton = document.getElementById("submit-username-button");
const roomCreationScreen = document.getElementById("room-creation");
const roomCodeInput = document.getElementById("room-code-input");
const joinRoomButton = document.getElementById("join-room-button");
const createRoomButton = document.getElementById("create-room-button");
const chatScreen = document.getElementById("chat-screen");
const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const fileInput = document.getElementById("file-input");
const roomCodeHeading = document.getElementById("room-code-heading");
const appLogo = document.querySelector('.app-logo');
const typingIndicator = document.getElementById("typing-indicator");

document.getElementById("google-login-button").addEventListener("click", () => {
    auth.signInWithPopup(provider).then(result => {
        const user = result.user;
        if (user) {
            username = user.displayName;
            saveUserDetails(user).then(() => {
                showScreen('room-creation');
            });
        }
    }).catch(error => console.error('Error during Google sign-in:', error));
});

document.getElementById("continue-guest-button").addEventListener("click", () => {
    showScreen('username-prompt');
});

submitUsernameButton.addEventListener("click", () => {
    username = guestUsernameInput.value;
    if (username) {
        showScreen('room-creation');
    }
});

joinRoomButton.addEventListener("click", () => {
    roomCode = roomCodeInput.value;
    if (roomCode) {
        db.ref(`rooms/${roomCode}`).once('value').then(snapshot => {
            if (snapshot.exists()) {
                saveUserDetails(); // Save user details
                showScreen('chat-screen');
                roomCodeHeading.textContent = `Room Code: ${roomCode}`;
                loadMessages();
                listenToTyping(); // Listen for typing events
            } else {
                alert("Invalid room code. Please try again.");
            }
        });
    } else {
        alert("Please enter a room code.");
    }
});

createRoomButton.addEventListener("click", () => {
    roomCode = generateRoomCode();
    saveUserDetails(); // Save user details
    showScreen('chat-screen');
    roomCodeHeading.textContent = `Room Code: ${roomCode}`;
    loadMessages();
    listenToTyping(); // Listen for typing events
});

sendButton.addEventListener("click", () => {
    const messageText = messageInput.value;
    if (messageText) {
        sendMessage(messageText);
        messageInput.value = '';
        db.ref(`rooms/${roomCode}/typing`).remove(); // Clear typing indicator
    }
});

fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
        uploadFile(file);
    }
});

messageInput.addEventListener("input", () => {
    if (messageInput.value) {
        db.ref(`rooms/${roomCode}/typing`).set({
            username: username
        });
    } else {
        db.ref(`rooms/${roomCode}/typing`).remove();
    }
});

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');

    // Hide the app logo on room-creation and chat-screen
    if (screenId === 'room-creation' || screenId === 'chat-screen') {
        appLogo.style.display = 'none';
    } else {
        appLogo.style.display = 'block';
    }
}

function loadMessages() {
    db.ref(`rooms/${roomCode}/messages`).on('child_added', snapshot => {
        const message = snapshot.val();
        if (message) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message-box');
            messageDiv.innerHTML = `
                <p><strong>${message.username}:</strong> ${message.text}</p>
                <p class="message-timestamp">${message.timestamp}</p>
            `;
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;

            // Show notification for new messages
            if (Notification.permission === "granted") {
                new Notification(`${message.username}: ${message.text}`, {
                    body: message.text,
                    icon: 'https://cdn-icons-png.flaticon.com/512/5962/5962463.png'
                });
            }
        }
    });
}

function listenToTyping() {
    db.ref(`rooms/${roomCode}/typing`).on('value', snapshot => {
        const typingData = snapshot.val();
        if (typingData) {
            typingIndicator.textContent = `${typingData.username} is typing...`;
            typingIndicator.style.display = 'block';
        } else {
            typingIndicator.style.display = 'none';
        }
    });
}

function sendMessage(text) {
    const message = {
        text,
        timestamp: new Date().toLocaleString(),
        username: username, // Add username to the message
    };
    db.ref(`rooms/${roomCode}/messages`).push(message);
}

function uploadFile(file) {
    const storageRef = storage.ref(`rooms/${roomCode}/files/${file.name}`);
    storageRef.put(file).then(snapshot => {
        console.log('File uploaded successfully:', snapshot);
        storageRef.getDownloadURL().then(url => {
            const message = {
                text: `File uploaded: <a href="${url}" target="_blank">${file.name}</a>`,
                timestamp: new Date().toLocaleString(),
                username: username,
            };
            db.ref(`rooms/${roomCode}/messages`).push(message);
        }).catch(error => console.error('Error getting download URL:', error));
    }).catch(error => console.error('Error uploading file:', error));
}

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8);
}

function saveUserDetails(user) {
    const userDetails = {
        ip: userIP,
        location: userLocation,
        device: deviceDetails.device,
        os: deviceDetails.os,
        osVersion: deviceDetails.osVersion,
        browser: deviceDetails.browser,
        browserVersion: deviceDetails.browserVersion
    };

    if (user) {
        return db.ref(`users/${user.uid}`).set(userDetails).catch(error => console.error('Error saving user details:', error));
    } else {
        return db.ref(`users/${username}`).set(userDetails).catch(error => console.error('Error saving guest user details:', error));
    }
}

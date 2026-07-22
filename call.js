let localStream, remoteStream, peerConnection;
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// 1. Call Start Karna
async function startCall(type) {
    const overlay = document.getElementById('call-overlay');
    const statusText = document.getElementById('call-status-text');
    overlay.style.display = 'flex';
    statusText.innerText = "Calling...";

    const useVideo = (type === 'video');

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: useVideo, audio: true });
        document.getElementById('localVideo').srcObject = localStream;

        peerConnection = new RTCPeerConnection(iceServers);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            console.log("Remote track received");
            document.getElementById('remoteVideo').srcObject = event.streams[0];
            statusText.innerText = "Connected";
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', event.candidate);
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('call-user', { offer, type });

    } catch (err) {
        console.error("Media error:", err);
        alert("Camera/Mic permission error!");
        endCall();
    }
}

// 2. Incoming Call Listen Karna
socket.on('incoming-call', (data) => {
    document.getElementById('call-overlay').style.display = 'flex';
    document.getElementById('call-status-text').innerText = `Incoming ${data.type.toUpperCase()} Call...`;
    document.getElementById('accept-btn').style.display = 'flex';
    window.incomingOffer = data.offer;
    window.callType = data.type;
});

// 3. Call Accept Karna
async function acceptCall() {
    document.getElementById('accept-btn').style.display = 'none';
    document.getElementById('call-status-text').innerText = "Connecting...";

    const useVideo = (window.callType === 'video');

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: useVideo, audio: true });
        document.getElementById('localVideo').srcObject = localStream;

        peerConnection = new RTCPeerConnection(iceServers);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            console.log("Remote track received on accept");
            document.getElementById('remoteVideo').srcObject = event.streams[0];
            document.getElementById('call-status-text').innerText = "Connected";
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', event.candidate);
            }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(window.incomingOffer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('answer-call', answer);
        document.getElementById('call-status-text').innerText = "Connected";

    } catch (err) {
        console.error("Accept error:", err);
        endCall();
    }
}

// 4. Answer Receive Karna (Caller side)
socket.on('call-answered', async (answer) => {
    try {
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            document.getElementById('call-status-text').innerText = "Connected";
        }
    } catch (e) {
        console.error("Answer set error:", e);
    }
});

// 5. ICE Candidates Handle Karna
socket.on('ice-candidate', async (candidate) => {
    try {
        if (peerConnection && candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (e) {
        console.error("ICE error:", e);
    }
});

// 6. Call Cut / End Karna
socket.on('call-ended', () => {
    cleanupCall();
});

function endCall() {
    socket.emit('end-call');
    cleanupCall();
}

function cleanupCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    document.getElementById('remoteVideo').srcObject = null;
    document.getElementById('localVideo').srcObject = null;
    document.getElementById('call-overlay').style.display = 'none';
    document.getElementById('accept-btn').style.display = 'none';
}

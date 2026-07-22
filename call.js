let localStream, remoteStream, peerConnection;
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

async function startCall(type) {
    const overlay = document.getElementById('call-overlay');
    const statusText = document.getElementById('call-status-text');
    overlay.style.display = 'flex';
    statusText.innerText = "Connecting Call...";

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        await localVideo.play().catch(e => console.log("Local play error:", e));

        peerConnection = new RTCPeerConnection(iceServers);

        // Add local tracks to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            console.log("Remote stream received");
            const remoteVideo = document.getElementById('remoteVideo');
            if (event.streams && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
            } else {
                remoteStream = remoteStream || new MediaStream();
                remoteStream.addTrack(event.track);
                remoteVideo.srcObject = remoteStream;
            }
            remoteVideo.play().catch(e => console.log("Remote play error:", e));
            statusText.innerText = "Connected";
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', event.candidate);
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('call-user', offer);

    } catch (err) {
        console.error("Media access error:", err);
        alert("Camera/Mic access denied or unavailable.");
        endCall();
    }
}

// Incoming Call Listener
socket.on('incoming-call', async (offer) => {
    document.getElementById('call-overlay').style.display = 'flex';
    document.getElementById('call-status-text').innerText = "Incoming Call...";
    document.getElementById('accept-btn').style.display = 'block';
    window.incomingOffer = offer;
});

async function acceptCall() {
    document.getElementById('accept-btn').style.display = 'none';
    document.getElementById('call-status-text').innerText = "Connecting...";
    socket.emit('answer-call');

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const localVideo = document.getElementById('localVideo');
        localVideo.srcObject = localStream;
        await localVideo.play().catch(e => console.log("Local play error:", e));

        peerConnection = new RTCPeerConnection(iceServers);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (event) => {
            console.log("Remote stream received on accept");
            const remoteVideo = document.getElementById('remoteVideo');
            if (event.streams && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
            } else {
                remoteStream = remoteStream || new MediaStream();
                remoteStream.addTrack(event.track);
                remoteVideo.srcObject = remoteStream;
            }
            remoteVideo.play().catch(e => console.log("Remote play error:", e));
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
        socket.emit('answer-call-ans', answer);

    } catch (err) {
        console.error("Error answering call:", err);
        endCall();
    }
}

socket.on('call-answered', async (answer) => {
    if (peerConnection && answer) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            document.getElementById('call-status-text').innerText = "Connected";
        } catch (e) {
            console.error("Error setting remote description:", e);
        }
    }
});

socket.on('ice-candidate', async (candidate) => {
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            console.error('Error adding received ice candidate', e);
        }
    }
});

socket.on('call-ended', () => {
    cleanupCall();
});

function endCall() {
    socket.emit('end-call');
    cleanupCall();
}

function cleanupCall() {
    if (localStream) {
        localStream.getTracks().history ? '' : localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    const remoteVideo = document.getElementById('remoteVideo');
    const localVideo = document.getElementById('localVideo');
    if (remoteVideo) remoteVideo.srcObject = null;
    if (localVideo) localVideo.srcObject = null;

    document.getElementById('call-overlay').style.display = 'none';
    document.getElementById('accept-btn').style.display = 'none';
}


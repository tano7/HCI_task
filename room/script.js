const Peer = window.Peer;

(async function main() {
  const localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  const roomMode = document.getElementById('js-room-mode');
  const localText = document.getElementById('js-local-text');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');

  // 会議スタートボタン
  const startMeeting = document.getElementById('meeting-start');
  const BreakAlart = document.getElementById('break-alart');
  const meetingTime = document.getElementById('meeting-time');
  const breakTime = document.getElementById('break-time');

  BreakAlart.style.display = "none";

  let time_tmp;
  let break_time_tmp;

  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  const getRoomModeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'mesh');

  roomMode.textContent = getRoomModeByHash();
  window.addEventListener(
    'hashchange',
    () => (roomMode.textContent = getRoomModeByHash())
  );

  const localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: true, //音声ミュート中
      video: true,
    })
    .catch(console.error);

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  // eslint-disable-next-line require-atomic-updates
  const peer = (window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));

  // Register join handler
  joinTrigger.addEventListener('click', () => {
    // Note that you need to ensure the peer has connected to signaling server
    // before using methods of peer instance.
    if (!peer.open) {
      return;
    }

    const room = peer.joinRoom(roomId.value, {
      mode: getRoomModeByHash(),
      stream: localStream,
    });

    room.once('open', () => {
      messages.textContent += '=== You joined ===\n';
    });
    room.on('peerJoin', peerId => {
      // messages.textContent += `=== ${peerId} joined ===\n`;
      messages.textContent += `=== Your colleague joined ===\n`;
    });

    // Render remote stream for new peer join in the room
    room.on('stream', async stream => {
      const newVideo = document.createElement('video');
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      // mark peerId to find it later at peerLeave event
      newVideo.setAttribute('data-peer-id', stream.peerId);
      remoteVideos.append(newVideo);
      await newVideo.play().catch(console.error);
    });

    room.on('data', ({ data, src }) => {
      // Show a message sent to the room and who sent
      if(data == 'startMeeting') {
        meetingTime.style.display = "none";
        breakTime.style.display = "none";
        startMeeting.style.display = "none";
        document.getElementById('MST').style.display = "none";
        document.getElementById('BST').style.display = "none";
        messages.textContent += 'Start Meeting.\n';
      }else if(data == 'preBreak') {
        meetingTime.style.display = "none";
        breakTime.style.display = "none";
        startMeeting.style.display = "none";
        document.getElementById('MST').style.display = "none";
        document.getElementById('BST').style.display = "none";
        messages.textContent += 'After 5min, Go Break.\n';
      }else if(data == 'preBreak-in5min') {
        messages.textContent += 'in 5min, Go Break.\n';
      }else if(data == 'Break') {
        localStream.getVideoTracks().forEach((track) => (track.enabled = false));
        localStream.getAudioTracks().forEach((track) => (track.enabled = false));
        messages.textContent += 'Break.\n';
      }else if(data == 'Restart') {
        localStream.getVideoTracks().forEach((track) => (track.enabled = true));
        localStream.getAudioTracks().forEach((track) => (track.enabled = true));
        messages.textContent += 'Restart Meeting.\n';
      }else {
        // messages.textContent += `${src}: ${data}\n`;
        messages.textContent += `${data}\n`;
      }
    });

    // for closing room members
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id="${peerId}"]`
      );
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      messages.textContent += `=== ${peerId} left ===\n`;
    });

    // for closing myself
    room.once('close', () => {
      sendTrigger.removeEventListener('click', onClickSend);
      messages.textContent += '== You left ===\n';
      Array.from(remoteVideos.children).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
    });

    sendTrigger.addEventListener('click', onClickSend);
    leaveTrigger.addEventListener('click', () => room.close(), { once: true });

    startMeeting.addEventListener('click', onMeeting);

    function onClickSend() {
      // Send message to all of the peers in the room via websocket
      room.send(localText.value);

      // messages.textContent += `${peer.id}: ${localText.value}\n`;
      messages.textContent += `${localText.value}\n`;
      localText.value = '';
    }

    // 会議タイマースタート関数
    function onMeeting() {
      time_tmp = meetingTime.value * 60 * 1000;
      break_time_tmp = breakTime.value * 60 * 1000;
      meetingTime.style.display = "none";
      breakTime.style.display = "none";
      startMeeting.style.display = "none";
      document.getElementById('MST').style.display = "none";
      document.getElementById('BST').style.display = "none";
      messages.textContent += 'Start Meeting.\n';
      if(time_tmp > 300000) {
        room.send('startMeeting');
        setTimeout(preBreak, time_tmp - 300000);
      }else {
        room.send('preBreak-in5min');
        messages.textContent += 'in 5min, Go Break.\n';
        setTimeout(Break, time_tmp);
      }
    }

    //休憩前関数
    function preBreak() {
      room.send('preBreak');
      messages.textContent += 'After 5min, Go Break.\n';
      setTimeout(Break, 300000);
    }

    function Break() {
      room.send('Break');
      messages.textContent += 'Break.\n';
      localStream.getVideoTracks().forEach((track) => (track.enabled = false));
      localStream.getAudioTracks().forEach((track) => (track.enabled = false));
      BreakAlart.style.display = "block";

      setTimeout(Restart, break_time_tmp);
    }

    function Restart() {
      room.send('Restart');
      messages.textContent += 'Restart Meeting.\n';

      localStream.getVideoTracks().forEach((track) => (track.enabled = true));
      localStream.getAudioTracks().forEach((track) => (track.enabled = true));
      BreakAlart.style.display = "none";

      setTimeout(preBreak, time_tmp - 30000);
    }

  });

  peer.on('error', console.error);
})();

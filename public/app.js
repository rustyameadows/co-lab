const $ = (sel) => document.querySelector(sel);
const createBtn = $('#createBtn');
const createResult = $('#createResult');
const joinForm = $('#joinForm');
const joinError = $('#joinError');
const roleBadge = $('#roleBadge');
const roomSection = $('#room-section');
const joinSection = $('#join-section');
const hostVideo = $('#hostVideo');
const leaveBtn = $('#leaveBtn');
const sessionIdInput = $('#sessionId');
const nameInput = $('#displayName');
const codeInput = $('#accessCode');

// Pull sessionId from URL if present
const urlParams = new URLSearchParams(location.search);
const urlSession = urlParams.get('sessionId');
if (urlSession) sessionIdInput.value = urlSession;

let lkRoom = null;

createBtn?.addEventListener('click', async () => {
  createResult.textContent = 'Creating...';
  const res = await fetch('/api/sessions.create', { method: 'POST' });
  if (!res.ok) {
    createResult.textContent = 'Error creating session';
    return;
  }
  const data = await res.json();
  sessionIdInput.value = data.sessionId;
  createResult.textContent = `Session: ${data.sessionId}\nInvite URL: ${data.inviteUrl}\nCodes:\n  Host: ${data.codes.host}\n  Collaborator: ${data.codes.collaborator}\n  Viewer: ${data.codes.viewer}`;
});

joinForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  joinError.textContent = '';
  const sessionId = sessionIdInput.value.trim();
  const name = nameInput.value.trim();
  const code = codeInput.value.trim();
  if (!sessionId || !name || !code) {
    joinError.textContent = 'Please fill all fields';
    return;
  }
  const res = await fetch('/api/sessions.join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, name, code }),
  });
  if (!res.ok) {
    joinError.textContent = 'Join failed';
    return;
  }
  const { role, room, token, url } = await res.json();
  roleBadge.textContent = `Role: ${role}`;
  await connectLiveKit({ url, token, role });
});

async function connectLiveKit({ url, token, role }) {
  const { Room, RoomEvent, createLocalTracks, Track } = window.LiveKit;
  lkRoom = new Room();

  lkRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    // Attach the host's video track
    if (track.kind === Track.Kind.Video) {
      track.attach(hostVideo);
    }
  });

  lkRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
    if (track.kind === Track.Kind.Video) {
      track.detach(hostVideo);
    }
  });

  await lkRoom.connect(url, token);
  joinSection.hidden = true;
  roomSection.hidden = false;

  if (role === 'host') {
    const tracks = await createLocalTracks({ audio: true, video: true });
    for (const t of tracks) {
      await lkRoom.localParticipant.publishTrack(t);
    }
  }
}

leaveBtn?.addEventListener('click', async () => {
  try { await lkRoom?.disconnect(); } catch {}
  joinSection.hidden = false;
  roomSection.hidden = true;
});


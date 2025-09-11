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
const unmuteBtn = $('#unmuteBtn');
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
  // LiveKit UMD global: `LivekitClient` (preferred) or `LiveKit`.
  const LK = window.LivekitClient || window.LiveKit;
  if (!LK) {
    joinError.textContent = 'LiveKit failed to load. Check CDN URL/network.';
    return;
  }

  try {
    const opts = { autoSubscribe: true };
    if (typeof LK.connect === 'function') {
      // Preferred helper if exposed by UMD build
      lkRoom = await LK.connect(url, token, opts);
    } else if (LK.Room && typeof LK.Room === 'function') {
      // Fallback: instance API
      lkRoom = new LK.Room(opts);
      await lkRoom.connect(url, token);
    } else {
      joinError.textContent = 'LiveKit global missing connect/Room on UMD build.';
      return;
    }
    // expose for debugging
    window.lkRoom = lkRoom;
    window.LK = LK;
    console.log('[LK] connected', {
      connectionState: lkRoom.connectionState || lkRoom.state,
      participantsSize: lkRoom.participants ? lkRoom.participants.size : (lkRoom.remoteParticipants ? lkRoom.remoteParticipants.size : 'n/a'),
    });
  } catch (err) {
    console.error('LiveKit connect error', err);
    joinError.textContent = 'Failed to connect to LiveKit.';
    return;
  }

  const roomOn = (ev, handler) => {
    try {
      if (LK.RoomEvent && LK.RoomEvent[ev]) lkRoom.on(LK.RoomEvent[ev], handler);
    } catch {}
    try { lkRoom.on(ev, handler); } catch {}
    try { lkRoom.on(ev.charAt(0).toLowerCase() + ev.slice(1), handler); } catch {}
  };

  roomOn('TrackSubscribed', (track, publication, participant) => {
    console.log('[LK] TrackSubscribed', { kind: track && track.kind, participant: participant && participant.identity });
    const isVideo = track.kind === 'video' || (LK.Track && LK.Track.Kind && track.kind === LK.Track.Kind.Video);
    if (isVideo) {
      track.attach(hostVideo);
      // Start muted to avoid autoplay blocks; offer Unmute button.
      hostVideo.muted = true;
      safePlay(hostVideo);
      if (unmuteBtn) unmuteBtn.hidden = false;
    }
  });

  // Subscribe to newly published tracks from any participant
  roomOn('TrackPublished', (publication, participant) => {
    console.log('[LK] TrackPublished', { kind: publication && (publication.kind || (publication.track && publication.track.kind)), participant: participant && participant.identity });
    const kind = publication.kind || (publication.track && publication.track.kind);
    const isVideo = kind === 'video' || (LK.Track && LK.Track.Kind && kind === LK.Track.Kind.Video);
    if (isVideo) {
      try { publication.setSubscribed && publication.setSubscribed(true); } catch {}
    }
  });

  // When a participant connects, ensure we subscribe to their already published video
  roomOn('ParticipantConnected', (participant) => {
    console.log('[LK] ParticipantConnected', { id: participant && participant.identity });
    try {
      participant.tracks.forEach((pub) => {
        const kind = pub.kind || (pub.track && pub.track.kind);
        const isVideo = kind === 'video' || (LK.Track && LK.Track.Kind && kind === LK.Track.Kind.Video);
        if (isVideo) {
          try { pub.setSubscribed && pub.setSubscribed(true); } catch {}
        }
      });
    } catch {}
  });

  roomOn('TrackUnsubscribed', (track) => {
    console.log('[LK] TrackUnsubscribed', { kind: track && track.kind });
    const isVideo = track && (track.kind === 'video' || (LK.Track && LK.Track.Kind && track.kind === LK.Track.Kind.Video));
    if (isVideo) {
      try { track.detach(hostVideo); } catch {}
    }
  });

  joinSection.hidden = true;
  roomSection.hidden = false;

  if (role === 'host') {
    try {
      const tracks = await LK.createLocalTracks({ audio: true, video: true });
      // Show local preview for host
      const localVideo = tracks.find((t) => t.kind === 'video' || (LK.Track && LK.Track.Kind && t.kind === LK.Track.Kind.Video));
      if (localVideo) {
        localVideo.attach(hostVideo);
        hostVideo.muted = true; // avoid echo on local preview
        safePlay(hostVideo);
      }
      for (const t of tracks) {
        const pub = await lkRoom.localParticipant.publishTrack(t);
        console.log('[LK] published local track', { kind: t && t.kind, pubKind: pub && pub.kind });
      }
    } catch (err) {
      console.error('Local track error', err);
      joinError.textContent = 'Failed to access mic/camera.';
    }
  }

  // Ensure we subscribe/attach to any already-published video tracks
  try {
    const parts = (lkRoom.participants && lkRoom.participants.values && Array.from(lkRoom.participants.values()))
      || (lkRoom.remoteParticipants && lkRoom.remoteParticipants.values && Array.from(lkRoom.remoteParticipants.values()))
      || (Array.isArray(lkRoom.participants) ? lkRoom.participants : []);

    parts.forEach((participant) => {
      const pubs = participant?.getTrackPublications?.()
        || (participant?.tracks && participant.tracks.values && Array.from(participant.tracks.values()))
        || (Array.isArray(participant?.tracks) ? participant.tracks : [])
        || (participant?.trackPublications && participant.trackPublications.values && Array.from(participant.trackPublications.values()))
        || (Array.isArray(participant?.trackPublications) ? participant.trackPublications : []);

      pubs.forEach((pub) => {
        const kind = pub?.kind || (pub?.track && pub.track.kind);
        const isVideo = kind === 'video' || (LK.Track && LK.Track.Kind && kind === LK.Track.Kind.Video);
        if (isVideo) {
          try { pub.setSubscribed && pub.setSubscribed(true); } catch {}
          console.log('[LK] ensure subscribe video pub', { sid: pub.sid, subscribed: pub.isSubscribed });
          if (pub.track) {
            pub.track.attach(hostVideo);
            hostVideo.muted = true;
            safePlay(hostVideo);
            if (unmuteBtn) unmuteBtn.hidden = false;
          }
        }
      });
    });
  } catch (e) {
    console.debug('post-connect attach check skipped', e);
  }
}

function safePlay(el) {
  const p = el && typeof el.play === 'function' ? el.play() : null;
  if (p && typeof p.catch === 'function') {
    p.catch((e) => console.debug('autoplay prevented', e));
  }
}

leaveBtn?.addEventListener('click', async () => {
  try { await lkRoom?.disconnect(); } catch {}
  joinSection.hidden = false;
  roomSection.hidden = true;
});

unmuteBtn?.addEventListener('click', () => {
  try {
    hostVideo.muted = false;
    safePlay(hostVideo);
    unmuteBtn.hidden = true;
  } catch {}
});

// Debug helpers in console
window.__lk = {
  stats() {
    const room = window.lkRoom;
    if (!room) return 'no room';
    const parts = (room.participants && room.participants.values && Array.from(room.participants.values()))
      || (room.remoteParticipants && room.remoteParticipants.values && Array.from(room.remoteParticipants.values()))
      || (Array.isArray(room.participants) ? room.participants : []);
    const arr = parts.map((p) => {
      const pubs = p?.getTrackPublications?.()
        || (p?.tracks && p.tracks.values && Array.from(p.tracks.values()))
        || (Array.isArray(p?.tracks) ? p.tracks : [])
        || (p?.trackPublications && p.trackPublications.values && Array.from(p.trackPublications.values()))
        || (Array.isArray(p?.trackPublications) ? p.trackPublications : []);
      return {
        id: p.identity,
        tracks: pubs.map((pub) => ({ kind: pub.kind || (pub.track && pub.track.kind), subscribed: pub.isSubscribed, hasTrack: !!pub.track })),
      };
    });
    return { state: room.connectionState || room.state, remotes: arr };
  },
};

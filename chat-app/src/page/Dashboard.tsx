import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Settings, 
  Phone, 
  Camera, 
  Send,
  LogOut,
  UserPlus,
  Plus,
  Users,
  Menu,
  X,
  PhoneCall,
  PhoneOff,
  Mic,
  Square,
  Download,
  Play,
  Pause
} from 'lucide-react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  where,
  getDocs,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../db/firebase.db.connection.js';

interface MessageItem {
  id: string;
  type: 'text' | 'image' | 'audio';
  content: string;
  senderId: string;
  senderName: string;
  createdAt: any;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  phoneNumber: string; 
  profilePhotoUrl: string | null;
}

interface Contact {
  id: string; // Contact's phone number
  firstName: string;
  lastName: string;
}

interface Conversation {
  id: string;
  participantPhone: string;
  participantName: string;
}

// STUN Servers configuration for WebRTC
const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
};

export default function Dashboard(): React.JSX.Element {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  // Navigation & Responsiveness States
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'contacts'>('chats');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Contacts & Conversation States
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  
  // Modals / Adding Contact Input States
  const [isAddingContact, setIsAddingContact] = useState<boolean>(false);
  const [newContactPhone, setNewContactPhone] = useState<string>('');
  const [addContactError, setAddContactError] = useState<string>('');

  // Real-time Chat States
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);

  // --- Voice Note Recording States ---
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // --- WebRTC Calling States ---
  const [callState, setCallState] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callPartnerName, setCallPartnerName] = useState<string>('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 1. Authenticate & fetch user metadata
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthUser(user);
        
        try {
          const userDocSnap = await getDoc(doc(db, 'contacts', user.uid));
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setUserProfile({
              firstName: data.first_name || data.firstName || 'Anonymous',
              lastName: data.last_name || data.lastName || '',
              phoneNumber: data.phone_number || data.phoneNumber || '',
              profilePhotoUrl: data.profile_photo_url || data.profilePhotoUrl || null
            });
          } else {
            console.warn(`No contact document found for UID: ${user.uid} in 'contacts' collection.`);
          }
        } catch (err) {
          console.error("Error fetching user profile metadata:", err);
        }
      } else {
        setAuthUser(null);
        window.location.href = "/login";
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch User's Personal Contacts list from Firestore
  useEffect(() => {
    if (!authUser) return;

    const contactsSubcolRef = collection(db, 'contacts', authUser.uid, 'my_saved_contacts');
    
    const unsubscribe = onSnapshot(contactsSubcolRef, (snapshot) => {
      const loadedContacts: Contact[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        loadedContacts.push({
          id: doc.id, // The phone number used as the doc ID
          firstName: data.firstName || '',
          lastName: data.lastName || '',
        });
      });
      setContacts(loadedContacts);
    }, (error) => {
      console.error("Error listening to contacts list snapshot:", error);
    });

    return () => unsubscribe();
  }, [authUser]);

  // 3. Listen to Active Private Conversations
  useEffect(() => {
    if (!authUser || !userProfile?.phoneNumber) return;

    const convRef = collection(db, 'conversations');
    const q = query(convRef, where('participants', 'array-contains', userProfile.phoneNumber));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedConversations: Conversation[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const otherPhone = data.participants.find((p: string) => p !== userProfile.phoneNumber) || '';
        const otherName = data.participantNames?.[otherPhone] || 'Unknown User';

        loadedConversations.push({
          id: doc.id,
          participantPhone: otherPhone,
          participantName: otherName,
        });
      });
      setConversations(loadedConversations);
    }, (error) => {
      console.error("Error listening to conversations query snap:", error);
    });

    return () => unsubscribe();
  }, [authUser, userProfile]);

  // 4. Real-time message streaming from active conversation subcollection
  useEffect(() => {
    if (!authUser || !activeConversation) {
      setMessages([]);
      return;
    }

    const messagesColRef = collection(db, 'conversations', activeConversation.id, 'messages');
    const q = query(messagesColRef, orderBy('sent_datetime', 'asc'));

    const handleSnapshotUpdate = (snapshot: any) => {
      const loadedMessages: MessageItem[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        loadedMessages.push({
          id: doc.id,
          type: data.type || 'text',
          content: data.message_text || '',
          senderId: data.sender_id || '', 
          senderName: data.sender_name || 'Anonymous',
          createdAt: data.sent_datetime || null,
        });
      });
      setMessages(loadedMessages);
    };

    const unsubscribe = onSnapshot(q, handleSnapshotUpdate, (error) => {
      console.warn("Ordered query failed. Falling back to unsorted client-side message stream: ", error);
      
      const fallbackUnsubscribe = onSnapshot(messagesColRef, (snapshot) => {
        const loadedMessages: MessageItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loadedMessages.push({
            id: doc.id,
            type: data.type || 'text',
            content: data.message_text || '',
            senderId: data.sender_id || '', 
            senderName: data.sender_name || 'Anonymous',
            createdAt: data.sent_datetime || null,
          });
        });
        
        loadedMessages.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeA - timeB;
        });
        setMessages(loadedMessages);
      }, (fallbackErr) => {
        console.error("Complete subcollection load failed: ", fallbackErr);
      });

      return () => fallbackUnsubscribe();
    });

    return () => unsubscribe();
  }, [authUser, activeConversation]);

  // Auto-scrolls chat window
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // --- 4.5 Listen for Incoming Calls (WebRTC Signalling Listener) ---
  useEffect(() => {
    if (!userProfile?.phoneNumber) return;

    const callsColRef = collection(db, 'calls');
    // Listen to changes for incoming calls targeting our phone number with status 'dialing'
    const q = query(
      callsColRef, 
      where('calleePhone', '==', userProfile.phoneNumber), 
      where('status', '==', 'dialing')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const callData = change.doc.data();
          if (callState === 'idle') {
            setCurrentCallId(change.doc.id);
            setCallPartnerName(callData.callerName || 'Unknown Caller');
            setCallState('incoming');
          }
        }
      });
    });

    return () => unsubscribe();
  }, [userProfile, callState]);

  // Monitor an active call's status changes (Declined/Ended)
  useEffect(() => {
    if (!currentCallId) return;

    const callDocRef = doc(db, 'calls', currentCallId);
    const unsubscribe = onSnapshot(callDocRef, (snapshot) => {
      if (!snapshot.exists()) {
        handleCleanUpCall();
        return;
      }
      const data = snapshot.data();
      if (data.status === 'ended' || data.status === 'declined') {
        handleCleanUpCall();
      } else if (data.status === 'active' && callState === 'calling') {
        setCallState('connected');
      }
    });

    return () => unsubscribe();
  }, [currentCallId, callState]);

  // Assign media streams to HTML video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);


  // --- Fixed WebRTC Core Signaling Logic ---

  const handleCleanUpCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    setCallState('idle');
    setCurrentCallId(null);
  };

  const setupPeerConnection = async (stream: MediaStream, callId: string) => {
    const pc = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.current = pc;

    // Add local media tracks to WebRTC
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Listen for remote streams and attach to state
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Save locally generated ICE candidates to Firestore
    const iceCandidatesCol = collection(db, 'calls', callId, 'iceCandidates');
    pc.onicecandidate = async (event) => {
      if (event.candidate && userProfile) {
        try {
          await addDoc(iceCandidatesCol, {
            candidate: event.candidate.toJSON(),
            sender: userProfile.phoneNumber
          });
        } catch (err) {
          console.error("Error writing ICE candidate to Firestore:", err);
        }
      }
    };

    // Listen for incoming remote ICE Candidates and queue them safely
    onSnapshot(iceCandidatesCol, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // ONLY add candidates sent by the OTHER person
          if (data.sender !== userProfile?.phoneNumber) {
            const candidate = new RTCIceCandidate(data.candidate);
            
            // WebRTC Protection: If remote description isn't set yet, wait or retry
            if (pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(candidate);
              } catch (err) {
                console.error("Failed to add remote ICE Candidate:", err);
              }
            } else {
              // Fallback: Check every 300ms until remoteDescription is ready
              const interval = setInterval(async () => {
                if (pc.remoteDescription && pc.remoteDescription.type) {
                  clearInterval(interval);
                  try {
                    await pc.addIceCandidate(candidate);
                  } catch (err) {
                    console.error("Delayed addition of ICE candidate failed:", err);
                  }
                }
              }, 300);
            }
          }
        }
      });
    });

    return pc;
  };

  // Initiate an Outgoing Audio/Video Call
  const handleInitiateCall = async () => {
    if (!activeConversation || !userProfile) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      setCallState('calling');
      setCallPartnerName(activeConversation.participantName);

      // Register the call session in Firestore
      const callDocRef = await addDoc(collection(db, 'calls'), {
        callerPhone: userProfile.phoneNumber,
        callerName: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
        calleePhone: activeConversation.participantPhone,
        status: 'dialing',
        createdAt: serverTimestamp()
      });

      setCurrentCallId(callDocRef.id);

      const pc = await setupPeerConnection(stream, callDocRef.id);

      // Create WebRTC offer SDP
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      await updateDoc(callDocRef, {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });

      // Watch for Callee's Answer SDP
      const unsubscribe = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (data && data.answer && !pc.currentRemoteDescription) {
          const rtcSessionDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(rtcSessionDescription);
          setCallState('connected');
          unsubscribe();
        }
      });

    } catch (err) {
      console.error("Failed to initiate media stream / setup call:", err);
      handleCleanUpCall();
    }
  };

  // Answer an Incoming Call
  const handleAnswerCall = async () => {
    if (!currentCallId || !userProfile) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);

      const callDocRef = doc(db, 'calls', currentCallId);
      const callSnapshot = await getDoc(callDocRef);
      const callData = callSnapshot.data();

      if (!callData || !callData.offer) return;

      const pc = await setupPeerConnection(stream, currentCallId);

      // Set Remote Description (the Caller's offer)
      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));

      // Generate Answer SDP
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send Answer SDP back to Firestore and change call status to active
      await updateDoc(callDocRef, {
        answer: {
          type: answer.type,
          sdp: answer.sdp
        },
        status: 'active'
      });

      setCallState('connected');
    } catch (err) {
      console.error("Failed to answer call:", err);
      handleCleanUpCall();
    }
  };

  // Decline or Terminate Call Session
  const handleEndCall = async () => {
    if (!currentCallId) return;

    try {
      const callDocRef = doc(db, 'calls', currentCallId);
      await updateDoc(callDocRef, { status: 'ended' });
      await deleteDoc(callDocRef);
    } catch (err) {
      console.error("Error shutting down call channel:", err);
    } finally {
      handleCleanUpCall();
    }
  };

  const handleDeclineCall = async () => {
    if (!currentCallId) return;

    try {
      const callDocRef = doc(db, 'calls', currentCallId);
      await updateDoc(callDocRef, { status: 'declined' });
    } catch (err) {
      console.error("Error declining call session:", err);
    } finally {
      handleCleanUpCall();
    }
  };


  // --- Voice Recording Core Logic ---

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert audio Blob to Base64 to transmit directly inside Firestore
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (base64Audio && activeConversation && userProfile) {
            setSending(true);
            try {
              const messagesSubcolRef = collection(db, 'conversations', activeConversation.id, 'messages');
              await addDoc(messagesSubcolRef, {
                type: 'audio',
                sender_id: userProfile.phoneNumber, 
                sender_name: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
                message_text: base64Audio,
                sent_datetime: serverTimestamp(),
                status: "sent"
              });
            } catch (err) {
              console.error("Failed to upload audio message:", err);
            } finally {
              setSending(false);
            }
          }
        };

        // Stop all tracks to release the mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access denied or error:", err);
      alert("Could not access your microphone. Please verify site permissions.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };


  // --- Image Downloading Engine ---

  const handleDownloadImage = (base64Content: string, fileName: string = 'shared-image.jpg') => {
    const link = document.createElement('a');
    link.href = base64Content;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  // 5. Add a Contact by Phone Number (With formatting normalization & schema fallbacks)
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let cleanPhone = newContactPhone.trim().replace(/[\s\-\(\)]/g, '');
    if (!cleanPhone || !authUser || !userProfile) return;

    setAddContactError('');

    if (cleanPhone.startsWith('0')) {
      cleanPhone = '+27' + cleanPhone.substring(1);
    }

    const normalizedMyPhone = userProfile.phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone === normalizedMyPhone) {
      setAddContactError("You cannot add your own phone number.");
      return;
    }

    try {
      const contactsRef = collection(db, 'contacts');
      let querySnapshot;

      try {
        const q = query(contactsRef, where('phone_number', '==', cleanPhone));
        querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          const fallbackQ = query(contactsRef, where('phoneNumber', '==', cleanPhone));
          querySnapshot = await getDocs(fallbackQ);
        }
      } catch (firestoreErr: any) {
        console.error("Firestore queries blocked by security rules:", firestoreErr);
        if (firestoreErr.code === 'permission-denied') {
          setAddContactError("Database access restriction: Query permissions denied.");
        } else {
          setAddContactError("Error fetching directory database records.");
        }
        return;
      }

      if (!querySnapshot || querySnapshot.empty) {
        setAddContactError("No user registered with this phone number. Include country code (e.g. +27).");
        return;
      }

      const contactUserDoc = querySnapshot.docs[0];
      const contactUserData = contactUserDoc.data();

      const myContactsSubcol = doc(db, 'contacts', authUser.uid, 'my_saved_contacts', cleanPhone);
      await setDoc(myContactsSubcol, {
        firstName: contactUserData.first_name || contactUserData.firstName || 'Anonymous',
        lastName: contactUserData.last_name || contactUserData.lastName || '',
        addedAt: serverTimestamp()
      });

      setNewContactPhone('');
      setIsAddingContact(false);
      setSidebarTab('contacts'); 
    } catch (err) {
      console.error("Critical Failure in Add Contact Handler: ", err);
      setAddContactError("An unexpected error occurred while adding contact.");
    }
  };

  // 6. Start or Open Private Conversation with a Contact
  const handleStartChat = async (contact: Contact) => {
    if (!userProfile?.phoneNumber) {
      console.error("Your profile is still parsing. Cannot initiate chat.");
      return;
    }

    const participants = [userProfile.phoneNumber, contact.id].sort();
    const conversationId = participants.join('_');

    const conversationDocRef = doc(db, 'conversations', conversationId);
    
    try {
      const docSnap = await getDoc(conversationDocRef);

      if (!docSnap.exists()) {
        await setDoc(conversationDocRef, {
          participants: participants,
          participantNames: {
            [userProfile.phoneNumber]: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
            [contact.id]: `${contact.firstName} ${contact.lastName}`.trim()
          },
          createdAt: serverTimestamp()
        });
      }

      setActiveConversation({
        id: conversationId,
        participantPhone: contact.id,
        participantName: `${contact.firstName} ${contact.lastName}`.trim()
      });
      
      setIsMobileSidebarOpen(false);
    } catch (err) {
      console.error("Error creating conversation window: ", err);
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setIsMobileSidebarOpen(false);
  };

  // 7. Subcollection-based Message dispatch (Text)
  const handleSendMessage = async () => {
    const trimmedVal = inputValue.trim();
    if (!trimmedVal || !authUser || !userProfile || !activeConversation || sending) return;

    setSending(true);
    try {
      const messagesSubcolRef = collection(db, 'conversations', activeConversation.id, 'messages');
      await addDoc(messagesSubcolRef, {
        type: 'text',
        sender_id: userProfile.phoneNumber, 
        sender_name: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
        message_text: trimmedVal,
        sent_datetime: serverTimestamp(),
        status: "sent"
      });
      setInputValue('');
    } catch (err) {
      console.error("Failed to send text message: ", err);
    } finally {
      setSending(false);
    }
  };

  // 8. Subcollection-based Message dispatch (Image Base64)
  const handlePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !authUser || !userProfile || !activeConversation || sending) return;

    setSending(true);
    const messagesSubcolRef = collection(db, 'conversations', activeConversation.id, 'messages');

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;

        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Data = event.target?.result as string;
          if (base64Data) {
            await addDoc(messagesSubcolRef, {
              type: 'image',
              sender_id: userProfile.phoneNumber,
              sender_name: `${userProfile.firstName} ${userProfile.lastName}`.trim(),
              message_text: base64Data,
              sent_datetime: serverTimestamp(),
              status: "sent"
            });
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error("Failed to transmit image data: ", err);
    } finally {
      setSending(false);
      e.target.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem('loggedInUserContact');
      window.location.href = "/login";
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  const getInitials = () => {
    if (!userProfile) return 'MC';
    const firstI = userProfile.firstName ? userProfile.firstName[0].toUpperCase() : '';
    const lastI = userProfile.lastName ? userProfile.lastName[0].toUpperCase() : '';
    return firstI || lastI ? `${firstI}${lastI}` : 'MC';
  };

  if (authLoading) {
    return (
      <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-50 gap-4">
        <div className="w-12 h-12 border-4 border-[#0056b3] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-600 font-bold text-sm">Loading dashboard session...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden font-lexend bg-slate-50 text-slate-800 relative">
      
      {/* Call Overlay UI */}
      {callState !== 'idle' && (
        <div className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center text-white animate-fade-in">
          <div className="text-center flex flex-col items-center gap-6 max-w-md px-4">
            <div className="w-24 h-24 rounded-full bg-[#0056b3] border-4 border-[#ffd12b] flex items-center justify-center font-bold text-3xl animate-pulse">
              {callPartnerName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{callPartnerName}</h2>
              <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest font-semibold">
                {callState === 'calling' && 'Calling...'}
                {callState === 'incoming' && 'Incoming Call'}
                {callState === 'connected' && 'Call Connected'}
              </p>
            </div>

            {/* Video Feed Box */}
            <div className={`w-full max-w-sm aspect-video bg-black/50 rounded-2xl overflow-hidden relative border border-slate-700 shadow-2xl transition-all ${
              callState === 'connected' ? 'block' : 'hidden'
            }`}>
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute bottom-3 right-3 w-1/4 aspect-video bg-black rounded-lg border border-slate-600 object-cover"
              />
            </div>

            {/* Call Actions */}
            <div className="flex gap-6 mt-8">
              {callState === 'incoming' && (
                <>
                  <button 
                    onClick={handleAnswerCall}
                    className="p-4 bg-emerald-500 rounded-full hover:bg-emerald-600 hover:scale-105 transition-all text-white"
                    title="Answer Call"
                  >
                    <PhoneCall className="w-8 h-8" />
                  </button>
                  <button 
                    onClick={handleDeclineCall}
                    className="p-4 bg-red-500 rounded-full hover:bg-red-600 hover:scale-105 transition-all text-white"
                    title="Decline Call"
                  >
                    <PhoneOff className="w-8 h-8" />
                  </button>
                </>
              )}
              {(callState === 'calling' || callState === 'connected') && (
                <button 
                  onClick={handleEndCall}
                  className="p-4 bg-red-500 rounded-full hover:bg-red-600 hover:scale-105 transition-all text-white"
                  title="End Call"
                >
                  <PhoneOff className="w-8 h-8" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="bg-[#002b5a] flex flex-col py-8 items-center justify-between z-30 shadow-2xl h-full w-20 shrink-0">
        <div className="flex flex-col gap-8">
          <div className="w-12 h-12 rounded-2xl bg-[#0056b3] text-white border-2 border-[#ffd12b] shadow-lg flex items-center justify-center font-bold text-sm select-none">
            {getInitials()}
          </div>
          <nav className="flex flex-col gap-6 items-center">
            <button 
              onClick={() => { setSidebarTab('chats'); setIsMobileSidebarOpen(true); }}
              className={`p-3 rounded-xl transition-all ${
                sidebarTab === 'chats' ? 'text-white bg-white/10 shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
              title="Active Chats"
            >
              <MessageSquare className="w-6 h-6" />
            </button>
            
            <button 
              onClick={() => { setSidebarTab('contacts'); setIsMobileSidebarOpen(true); }}
              className={`p-3 rounded-xl transition-all ${
                sidebarTab === 'contacts' ? 'text-white bg-white/10 shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
              title="Contacts Directory"
            >
              <Users className="w-6 h-6" />
            </button>

            <button 
              onClick={() => { setIsAddingContact(!isAddingContact); setIsMobileSidebarOpen(true); }}
              className="hover:text-[#ffd12b] p-3 transition-colors text-white"
              title="Add New Contact"
            >
              <UserPlus className="w-6 h-6" />
            </button>
          </nav>
        </div>
        
        <div className="flex flex-col gap-4">
          <a 
            href="/edit"
            className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-[#ffd12b] hover:text-[#002b5a] transition-all text-white group"
          >
            <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          </a>
          <button 
            onClick={handleLogout}
            className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all text-red-400"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </aside>

      {/* Conversations and Contacts Sidebar Panel */}
      <section className={`bg-white border-r border-slate-200 flex flex-col h-full w-80 shrink-0 z-20 transition-all duration-300 absolute lg:static lg:flex ${
        isMobileSidebarOpen ? 'left-20' : '-left-96'
      }`}>
        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-[#0056b3] mb-1">MoreChats</h2>
            <p className="font-bold text-sm text-[#002b5a]">
              {sidebarTab === 'chats' ? 'Active Chats' : 'My Contacts'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsAddingContact(!isAddingContact)}
              className="p-2 bg-[#0056b3]/5 text-[#0056b3] rounded-lg hover:bg-[#0056b3]/10"
              title="Add New Contact"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Add Contact Form */}
        {isAddingContact && (
          <form onSubmit={handleAddContact} className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-2 animate-fade-in">
            <span className="text-[10px] font-bold uppercase text-slate-500">Find Contact by Phone</span>
            <input 
              type="text"
              placeholder="+27..."
              value={newContactPhone}
              onChange={(e) => setNewContactPhone(e.target.value)}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none focus:border-[#0056b3]"
              required
            />
            {addContactError && <p className="text-[10px] text-red-500 font-semibold">{addContactError}</p>}
            <div className="flex gap-2 self-end">
              <button 
                type="button" 
                onClick={() => { setIsAddingContact(false); setAddContactError(''); }}
                className="text-[10px] font-bold text-slate-500 px-2 py-1"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="text-[10px] font-bold bg-[#0056b3] text-white px-3 py-1 rounded"
              >
                Add
              </button>
            </div>
          </form>
        )}

        {/* Dynamic Navigation lists */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sidebarTab === 'contacts' ? (
            contacts.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-8">
                No contacts added yet.
              </div>
            ) : (
              contacts.map((contact) => {
                const isActive = activeConversation?.participantPhone === contact.id;
                return (
                  <div 
                    key={contact.id}
                    onClick={() => handleStartChat(contact)}
                    className={`p-4 rounded-2xl border-l-4 transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[#0056b3]/5 border-[#0056b3] shadow-sm' 
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#002b5a]">{contact.firstName} {contact.lastName}</h4>
                        <p className="text-xs text-slate-400">{contact.id}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            conversations.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-8">
                No active conversations.
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConversation?.id === conv.id;
                return (
                  <div 
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`p-4 rounded-2xl border-l-4 transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-[#0056b3]/5 border-[#0056b3] shadow-sm' 
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#0056b3]/10 text-[#0056b3] flex items-center justify-center font-bold text-sm">
                        {conv.participantName.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-[#002b5a] truncate">{conv.participantName}</h4>
                        <p className="text-xs text-slate-400 truncate">{conv.participantPhone}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </section>

      {/* Main Chat Interface Window */}
      <main className="flex-1 flex flex-col h-full bg-white relative">
        {activeConversation ? (
          <>
            {/* Active Header Panel */}
            <header className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm shrink-0">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="p-2 text-slate-400 hover:text-slate-600 lg:hidden"
                >
                  <Menu className="w-6 h-6" />
                </button>
                <div className="w-12 h-12 rounded-full bg-[#ffd12b]/20 text-[#002b5a] flex items-center justify-center font-bold text-base">
                  {activeConversation.participantName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#002b5a]">{activeConversation.participantName}</h3>
                  <p className="text-xs text-[#0056b3] font-semibold">Active Session</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleInitiateCall}
                  className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                  title="Start Audio/Video Call"
                >
                  <Phone className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Chat Messages Log Area */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50"
            >
              {messages.map((msg) => {
                const isMe = msg.senderId === userProfile?.phoneNumber;
                return (
                  <div 
                    key={msg.id}
                    className={`flex flex-col max-w-[70%] ${
                      isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 mb-1 px-2">{msg.senderName}</span>
                    <div className={`p-4 rounded-2xl shadow-sm text-sm ${
                      isMe 
                        ? 'bg-[#002b5a] text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                    }`}>
                      {msg.type === 'image' ? (
                        <div className="relative group">
                          <img 
                            src={msg.content} 
                            alt="shared base64 payload" 
                            className="max-w-xs rounded-lg max-h-60 object-contain cursor-zoom-in"
                          />
                          {/* Image download helper overlay button */}
                          <button
                            onClick={() => handleDownloadImage(msg.content, `image-${msg.id}.jpg`)}
                            className="absolute bottom-2 right-2 p-2 bg-black/70 hover:bg-black text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-bold"
                            title="Download Image"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        </div>
                      ) : msg.type === 'audio' ? (
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <audio src={msg.content} controls className="w-full h-8 custom-audio-mini" />
                        </div>
                      ) : (
                        <p className="leading-relaxed break-all whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Form Input Channel */}
            <footer className="p-6 border-t border-slate-100 bg-white shrink-0 flex flex-col gap-3">
              {isRecording && (
                <div className="flex items-center justify-between bg-red-50 text-red-600 px-4 py-2 rounded-xl border border-red-100 animate-pulse">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                    <span className="text-xs font-semibold">Recording Audio: {formatDuration(recordingDuration)}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={stopVoiceRecording}
                    className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    title="Stop & Send"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-4">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-slate-50 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  title="Send Photo"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handlePhotos}
                  accept="image/*"
                  className="hidden" 
                  multiple
                />

                {/* Voice Note Mic Button */}
                {!isRecording && (
                  <button 
                    type="button"
                    onClick={startVoiceRecording}
                    className="p-3 bg-slate-50 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    title="Record Voice Note"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}

                <input 
                  type="text" 
                  placeholder="Type your message..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-slate-50 border-0 outline-none rounded-xl px-5 py-3 text-sm focus:ring-2 focus:ring-[#0056b3]/20"
                  disabled={sending || isRecording}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={sending || !inputValue.trim() || isRecording}
                  className="p-3 bg-[#0056b3] text-white rounded-xl hover:bg-[#004085] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-center p-8 bg-slate-50/20">
            <div className="w-20 h-20 rounded-3xl bg-[#0056b3]/5 flex items-center justify-center text-[#0056b3] mb-4">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h3 className="font-bold text-lg text-[#002b5a] mb-1">No Active Chat Selected</h3>
            <p className="text-slate-400 text-sm max-w-sm">
              Choose a discussion thread from the list or add a registered phone contact to begin real-time messaging.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
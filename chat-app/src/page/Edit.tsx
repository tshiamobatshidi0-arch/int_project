import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { db, auth } from '../db/firebase.db.connection.js';

interface UserContact {
  uid: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  profile_photo_url: string | null;
  is_online: boolean;
  status_message?: 'Active' | 'Away' | 'Do Not Disturb';
}

export default function EditAccount(): React.JSX.Element {
  // 1. Auth & Profile Loading States
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  
  // 2. Controlled Input Form States (Added phoneNumber state)
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<'Active' | 'Away' | 'Do Not Disturb'>('Active');
  
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Helper to load user profile details from Firestore
  const loadUserDetails = async (userUid: string) => {
    try {
      const userDocRef = doc(db, 'contacts', userUid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const data = userDocSnap.data() as UserContact;
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setEmail(data.email || '');
        setPhoneNumber(data.phone_number || '');
        setStatusMessage(data.status_message || 'Active');
      }
    } catch (err) {
      console.error("Error loading user details: ", err);
    }
  };

  // 3. Track Auth State on Mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthUser(user);
        await loadUserDetails(user.uid);
      } else {
        setAuthUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 4. Save Changes to Firestore (including phone_number)
  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!authUser) return;

    setSaving(true);
    setFeedback(null);

    try {
      const userDocRef = doc(db, 'contacts', authUser.uid);
      await updateDoc(userDocRef, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone_number: phoneNumber.trim(), // Added field for Firestore update
        status_message: statusMessage
      });

      // Update the browser's sessionStorage backup too, matching the Login module
      const updatedSessionProfile = {
        docId: authUser.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        statusMessage: statusMessage,
        profilePhotoUrl: null // Maintain fallback structural key
      };
      sessionStorage.setItem('loggedInUserContact', JSON.stringify(updatedSessionProfile));

      setFeedback({ type: 'success', message: 'Profile updated successfully!' });
    } catch (error: any) {
      console.error("Error saving profile changes: ", error);
      setFeedback({ type: 'error', message: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Re-fetch original profile details to undo edits
  const handleDiscard = async (): Promise<void> => {
    if (!authUser) return;
    setFeedback(null);
    await loadUserDetails(authUser.uid);
  };

  // Safe generation of initials for the avatar placeholder
  const getInitials = () => {
    const firstInitial = firstName ? firstName[0].toUpperCase() : '';
    const lastInitial = lastName ? lastName[0].toUpperCase() : '';
    return firstInitial || lastInitial ? `${firstInitial}${lastInitial}` : 'MC';
  };

  if (authLoading) {
    return (
      <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-50 gap-4">
        <div className="w-12 h-12 border-4 border-[#0056b3] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-600 font-bold text-sm">Retrieving profile settings...</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="w-screen h-screen flex flex-col justify-center items-center bg-slate-50 p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h3>
        <p className="text-slate-500 mb-4">Please log in to manage your profile settings.</p>
        <a href="login_page.html" className="px-6 py-2 bg-[#0056b3] text-white font-bold rounded-lg hover:bg-[#002b5a] transition-colors shadow-md">
          Go to Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-screen font-lexend bg-slate-50">
      
      {/* Navigation Sidebar */}
      <nav className="bg-gradient-to-br from-[#0056b3] to-[#002b5a] p-10 text-white flex flex-col justify-between">
        <div>
          <div className="bg-white p-3 rounded-2xl mb-12 shadow-lg max-w-[180px] mx-auto md:mx-0">
            <img 
              src="../Assets/images/logo.jpg" 
              alt="Logo" 
              className="w-full rounded-lg"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="text-2xl font-black text-[#0056b3] text-center block select-none">MoreChats</span>
          </div>
          <ul className="space-y-4">
            <li className="bg-white/10 p-4 rounded-xl font-bold cursor-pointer transition-all">
              Profile Info
            </li>
            <li 
              onClick={() => { window.location.href = 'dashboard.html'; }}
              className="p-4 rounded-xl font-medium opacity-60 hover:opacity-100 hover:bg-white/5 cursor-pointer transition-all duration-200"
            >
              Back to Chats
            </li>
          </ul>
        </div>
      </nav>

      {/* Main Form Space */}
      <main className="p-12 max-w-4xl">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold text-slate-800">Edit Your Account</h1>
          <p className="text-slate-500 font-medium">Manage your MoreChats member identity.</p>
        </header>

        {feedback && (
          <div className={`mb-6 p-4 rounded-2xl text-sm font-semibold border transition-all duration-200 ${
            feedback.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.message}
          </div>
        )}

        <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-200">
          <form onSubmit={handleSave} className="space-y-8">
            
            {/* Avatar Section */}
            <div className="flex items-center gap-6 mb-10">
              <div className="w-20 h-20 bg-[#0056b3] text-white rounded-full flex items-center justify-center text-2xl font-extrabold border-4 border-[#ffd12b] shadow-lg select-none">
                {getInitials()}
              </div>
              <button 
                type="button"
                onClick={() => alert("Upload asset hook coming soon")}
                className="px-6 py-2 border-2 border-slate-200 rounded-full font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Change Photo
              </button>
            </div>

            {/* Core Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2">
                <label className="font-bold text-slate-400 text-sm uppercase tracking-wide">First Name</label>
                <input 
                  type="text" 
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={saving}
                  className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-[#0056b3] outline-none transition-all font-semibold text-slate-800 bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-400 text-sm uppercase tracking-wide">Last Name</label>
                <input 
                  type="text" 
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={saving}
                  className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-[#0056b3] outline-none transition-all font-semibold text-slate-800 bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-400 text-sm uppercase tracking-wide">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={saving}
                  className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-[#0056b3] outline-none transition-all font-semibold text-slate-800 bg-white"
                />
              </div>

              {/* NEW Phone Number Field */}
              <div className="space-y-2">
                <label className="font-bold text-slate-400 text-sm uppercase tracking-wide">Phone Number</label>
                <input 
                  type="tel" 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  disabled={saving}
                  className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-[#0056b3] outline-none transition-all font-semibold text-slate-800 bg-white"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="font-bold text-slate-400 text-sm uppercase tracking-wide">Member Status</label>
                <div className="relative">
                  <select
                    value={statusMessage}
                    onChange={(e) => setStatusMessage(e.target.value as any)}
                    disabled={saving}
                    className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-[#0056b3] outline-none appearance-none bg-slate-50 font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Away">Away</option>
                    <option value="Do Not Disturb">Do Not Disturb</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    ▼
                  </div>
                </div>
              </div>

            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <button 
                type="submit"
                disabled={saving}
                className="px-10 py-4 bg-[#0056b3] text-white rounded-full font-bold shadow-xl hover:bg-[#002b5a] transition-all duration-150 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              
              <button 
                type="button"
                onClick={handleDiscard}
                disabled={saving}
                className="px-10 py-4 bg-slate-100 text-slate-600 rounded-full font-bold hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Discard
              </button>
            </div>

          </form>
        </div>
      </main>

    </div>
  );
}
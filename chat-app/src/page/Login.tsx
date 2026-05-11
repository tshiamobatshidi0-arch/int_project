import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../db/firebase.db.connection.js';

export default function Login(): React.JSX.Element {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>(''); // Added password state
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!email.trim() || !phoneNumber.trim() || !password) {
      setErrorMsg("Please fill out all fields.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Query Firestore for the contact with the matching phone number
      const contactsColRef = collection(db, "contacts");
      const phoneQuery = query(
        contactsColRef, 
        where("phone_number", "==", phoneNumber.trim())
      );
      
      const querySnapshot = await getDocs(phoneQuery);
      
      if (querySnapshot.empty) {
        throw new Error("No account found with this phone number.");
      }

      // Extract the matching document reference ID and fields
      const contactDoc = querySnapshot.docs[0];
      const contactData = contactDoc.data();
      
      // Safety check: Ensure email matches the phone's registered account
      if (contactData.email.toLowerCase() !== email.trim().toLowerCase()) {
        throw new Error("Phone number and email credentials do not match.");
      }

      // 2. Perform authentication login using the user-entered password state
      await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // 3. Collect & store profile data in sessionStorage so the Edit Account page can access it
      const sessionProfile = {
        docId: contactDoc.id, // The Firestore document auto-ID used for updating
        firstName: contactData.first_name || '',
        lastName: contactData.last_name || '',
        email: contactData.email || '',
        phoneNumber: contactData.phone_number || '',
        statusMessage: contactData.status_message || 'Active',
        profilePhotoUrl: contactData.profile_photo_url || null
      };
      
      sessionStorage.setItem('loggedInUserContact', JSON.stringify(sessionProfile));

      // 4. Redirecting to your dashboard/profile page
      window.location.href = "dashboard"; 
      
    } catch (error: any) {
      console.error("Login verification failed: ", error);
      // Clean up Firebase error messages to be user-friendly
      let displayError = error.message;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        displayError = "Incorrect password or account credentials.";
      } else if (error.code === 'auth/invalid-email') {
        displayError = "Please enter a valid email address.";
      }
      setErrorMsg(displayError || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="font-lexend bg-white overflow-hidden w-screen h-screen">
      <div className="grid grid-cols-1 md:grid-cols-[45%_55%] h-screen">
        
        {/* Left branding panel */}
        <div className="bg-gradient-to-br from-[#0056b3] to-[#002b5a] flex flex-col items-center justify-center text-white p-10 text-center">
          <div className="animate-[float_6s_ease-in-out_infinite] w-32 h-32 bg-white rounded-[30px] shadow-2xl flex items-center justify-center mb-8 border-4 border-white/20 transition-transform duration-300">
            <img 
              src="../Assets/images/logo.jpg" 
              alt="MoreChats Logo" 
              className="w-20 rounded-lg" 
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="text-3xl select-none absolute">💬</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Welcome Back</h1>
        </div>

        {/* Right login form panel */}
        <div className="flex items-center justify-center p-10 overflow-y-auto">
          <div className="w-full max-w-md my-auto">
            <h2 className="text-3xl font-extrabold mb-2 text-slate-800">Log In</h2>
            <p className="text-slate-400 mb-8 font-medium">Enter your credentials to access your dashboard.</p>

            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm font-semibold transition-all">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              
              {/* Phone Field */}
              <div className="space-y-1">
                <label htmlFor="phone" className="font-bold text-xs uppercase text-slate-400 tracking-widest">
                  Phone Number:
                </label>
                <input 
                  type="tel" 
                  id="phone"
                  placeholder="+27 12 345 6789"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-[#0056b3] focus:bg-white outline-none transition-all font-medium text-slate-800"
                />
              </div>

              {/* Email Field */}
              <div className="space-y-1">
                <label htmlFor="email" className="font-bold text-xs uppercase text-slate-400 tracking-widest">
                  Email:
                </label>
                <input 
                  type="email" 
                  id="email"
                  placeholder="client@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-[#0056b3] focus:bg-white outline-none transition-all font-medium text-slate-800"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <label htmlFor="password" className="font-bold text-xs uppercase text-slate-400 tracking-widest">
                  Password:
                </label>
                <input 
                  type="password" 
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-[#0056b3] focus:bg-white outline-none transition-all font-medium text-slate-800"
                />
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 mt-2 bg-[#0056b3] text-white rounded-full font-bold shadow-xl hover:bg-[#002b5a] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Verifying Credentials...
                  </>
                ) : (
                  "Continue"
                )}
              </button>

              <div className="text-center pt-2">
                <a href="sign_in_page.html" className="text-[#0056b3] font-bold text-sm hover:underline transition-all">
                  No account? Create one
                </a>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
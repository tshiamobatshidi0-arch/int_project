import React, { useState } from 'react';
import { 
  createBrowserRouter, 
  createRoutesFromElements, 
  Route, 
  RouterProvider 
} from 'react-router';
import { 
  createUserWithEmailAndPassword,
  updateProfile,
  type UserCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './db/firebase.db.connection.js';
import './index.css';
import { Resend } from 'resend';
import Dashboard from './page/Dashboard.js';
import Login from './page/Login.js';
import Edit from './page/Edit.js';


const  RESEND_API_KEY = "re_iPbsPP4L_AAEHsYDfLwMwqumFds6YyTPo" //env file content
const resend = new Resend(RESEND_API_KEY);
// 1. Updated state shape to support Email/Password
interface RegisterFormData {
  fullName: string;
  email: string;
  password: string;
}

function Register(): React.JSX.Element {
  const [formData, setFormData] = useState<RegisterFormData>({
    fullName: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState<boolean>(false);

  // Handle local state updates for input fields
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  // 2. Main Submit Handler for Registering Users
  const handleRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const { email, password, fullName } = formData;

    setLoading(true);

    try {
      // Create user authentication record
      const userCredential: UserCredential = await createUserWithEmailAndPassword(
        auth, 
        email.trim(), 
        password
      );

  resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Hello World',
    html: `
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a;">

    <table border="0" cellpadding="0" cellspacing="0" width="100%"
        style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">

        <tr>
            <td style="padding: 40px 20px; text-align: center; background: linear-gradient(135deg, #0056b3 0%, #002b5a 100%);">
                <div style="display: inline-block; width: 140px; height: 50px; background: #ffffff; border-radius: 12px; overflow: hidden; border: 2px solid #ffffff;">
                    <img src="https://your-domain.com/assets/logo_clipped.png" alt="MoreChats"
                        style="height: 130%; width: auto; display: block; margin: -5px auto 0 auto;">
                </div>
                <h1 style="color: #ffffff; margin-top: 20px; font-size: 28px; letter-spacing: -0.5px;">
                    Welcome to MoreChats, Member!
                </h1>
            </td>
        </tr>

        <tr>
            <td style="padding: 40px 30px;">
                <h2 style="color: #0056b3; font-size: 20px; margin-bottom: 10px; font-weight: 800;">
                    What is MoreChats?
                </h2>
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: #334155;">
                    Think of <strong>MoreChats</strong> as your upgraded daily communication hub. Much like WhatsApp, we
                    provide seamless, real-time messaging and high-quality calling — but with a focused twist for our
                    community.
                </p>
                <ul style="padding-left: 20px; color: #475569; line-height: 1.8; margin-bottom: 30px;">
                    <li><strong>Instant Connectivity:</strong> Chat with friends and colleagues globally with zero lag.</li>
                    <li><strong>Secure &amp; Private:</strong> Your conversations are protected, keeping your data where it belongs.</li>
                    <li><strong>Smart Integration:</strong> Built-in tools like ALIS AI and MatchPoint help you work and grow while you stay connected.</li>
                </ul>

                <div style="text-align: center;">
                    <a href="https://your-domain.com/dashboard"
                        style="display: inline-block; padding: 16px 36px; background-color: #ffd12b; color: #0f172a; text-decoration: none; font-weight: 700; border-radius: 30px; font-size: 15px; text-transform: uppercase; letter-spacing: 1px;">
                        Start Chatting Now
                    </a>
                </div>
            </td>
        </tr>

        <tr>
            <td style="padding: 20px 30px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0;">
                <table width="100%">
                    <tr>
                        <td width="50%" style="text-align: center; padding: 10px;">
                            <div style="font-size: 20px;">⚡</div>
                            <span style="font-size: 11px; font-weight: 700; color: #0056b3; text-transform: uppercase;">Real-Time Messaging</span>
                        </td>
                        <td width="50%" style="text-align: center; padding: 10px;">
                            <div style="font-size: 20px;">🌐</div>
                            <span style="font-size: 11px; font-weight: 700; color: #0056b3; text-transform: uppercase;">Global Reach</span>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

        <tr>
            <td style="padding: 30px; text-align: center; color: #94a3b8; font-size: 12px;">
                <p style="margin: 0;">&copy; 2026 MoreChats Inc. | Conversation Never Sleeps</p>
                <p style="margin: 5px 0 0 0;">The familiar way to chat, powered by smarter technology.</p>
            </td>
        </tr>

    </table>
</body>`})
      const user = userCredential.user;

      if (user) {
        // Update user display profile on Firebase Auth
        await updateProfile(user, {
          displayName: fullName.trim()
        });

        // Sync fresh profile settings to Firestore database
        await syncUserToFirestore(user.uid, user.email || '', fullName.trim());

        alert("Account created successfully!");
        // Redirect logic to dashboard goes here
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      alert("Registration failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Sync user details to Firestore (Indexed by unique Auth UID instead of phone number)
  const syncUserToFirestore = async (uid: string, email: string, displayName: string): Promise<void> => {
    try {
      const userRef = doc(db, "contacts", uid);
      const userSnap = await getDoc(userRef);

      const [firstName = "New", lastName = "User"] = displayName.split(" ");

      if (!userSnap.exists()) {
        // Save initial profile details for a new registration
        await setDoc(userRef, {
          uid: uid,
          email: email,
          first_name: firstName,
          last_name: lastName,
          profile_photo_url: null,
          is_online: true,
          last_seen: serverTimestamp()
        });
        console.log("New user profile registered in Firestore!");
      } else {
        // If they already existed, update online state metadata
        await setDoc(userRef, {
          is_online: true,
          last_seen: serverTimestamp()
        }, { merge: true });
        console.log("Returning user logged in, status updated to online.");
      }
    } catch (error) {
      console.error("Firestore sync failed:", error);
    }
  };

  return (
    <div 
      className="w-screen h-screen flex justify-center items-center font-sans"
      style={{ background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)" }}
    >
      <div 
        className="w-[480px] bg-white rounded-[30px] p-[50px] flex flex-col border border-blue-900/5"
        style={{ boxShadow: "0 30px 60px rgba(0, 86, 179, 0.1)" }}
      >
        <form onSubmit={handleRegisterSubmit}>
          <h2 className="text-2xl font-black text-slate-800 mb-6 text-center">Create Account</h2>
          
          <div className="mb-4">
            <label htmlFor="fullName" className="block mb-1 text-sm font-semibold text-slate-700">
              Full Name
            </label>
            <input 
              type="text" 
              id="fullName" 
              placeholder="John Doe" 
              required
              disabled={loading}
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-4 py-[14px] mb-[15px] rounded-[15px] border-2 border-slate-100 box-border outline-none focus:border-blue-300 disabled:opacity-50 transition-colors"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="block mb-1 text-sm font-semibold text-slate-700">
              Email Address
            </label>
            <input 
              type="email" 
              id="email" 
              placeholder="example@domain.com" 
              required
              disabled={loading}
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-[14px] mb-[15px] rounded-[15px] border-2 border-slate-100 box-border outline-none focus:border-blue-300 disabled:opacity-50 transition-colors"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block mb-1 text-sm font-semibold text-slate-700">
              Password
            </label>
            <input 
              type="password" 
              id="password" 
              placeholder="••••••••" 
              required
              minLength={6}
              disabled={loading}
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-[14px] mb-[15px] rounded-[15px] border-2 border-slate-100 box-border outline-none focus:border-blue-300 disabled:opacity-50 transition-colors"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-[14px] bg-[#ffd12b] hover:bg-[#e6bc27] disabled:bg-slate-300 text-slate-900 border-none rounded-full font-extrabold cursor-pointer mt-[10px] transition-all duration-200"
          >
            {loading ? "Registering..." : "Sign Up"}
          </button>

          <a 
            href="login_page.html"
            className="block text-center text-[0.9rem] mt-[15px] text-[#0056b3] hover:underline"
          >
            Already have an account? Log in
          </a>
        </form>
      </div>
    </div>
  );
}

function App(): React.JSX.Element {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" >
        <Route index element={<h1>Welcome to the chat app</h1>} />
        <Route path='login' element={<Login />} />
        <Route path='register' element={<Register />} />
        <Route path='edit' element={<Edit/>} />
        <Route path='dashboard' element={<Dashboard />} />
      </Route>
    )
  );

  return <RouterProvider router={router} />;
}



 

export default App;
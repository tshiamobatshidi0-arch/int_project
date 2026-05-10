import app from "./firebase.db.connection"

import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  collection, 
  setDoc, 
  addDoc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp 
} from "firebase/firestore";


const db = getFirestore(app);

export async function createContact(phoneNumber,email, firstName, lastName, photoUrl) {
  try {
    // We use the phone number directly as the document ID
    const contactRef = doc(db, "contacts", phoneNumber);
    
    await setDoc(contactRef, {
      phone_number: phoneNumber,
      email: email,
      first_name: firstName,
      last_name: lastName,
      profile_photo_url: photoUrl,
      is_online: true,
      last_seen: serverTimestamp() // Generates the server-side timestamp
    });
    
    console.log("Contact successfully created!");
  } catch (error) {
    console.error("Error adding contact: ", error);
  }
}

async function createConversation(conversationName, isGroup, memberPhoneNumbers, creatorPhone) {
  try {
    const conversationsCol = collection(db, "conversations");
    
    const newChat = {
      conversation_name: isGroup ? conversationName : null,
      is_group: isGroup,
      created_at: serverTimestamp(),
      members: memberPhoneNumbers, // Array of phone numbers/IDs
      member_roles: {
        [creatorPhone]: "admin" // Sets the creator as the admin
      }
    };
    
    const docRef = await addDoc(conversationsCol, newChat);
    console.log("Conversation created with ID: ", docRef.id);
    return docRef.id; // Returns the generated conversation ID
  } catch (error) {
    console.error("Error creating conversation: ", error);
  }
}


async function addMemberToGroup(conversationId, newMemberPhone) {
  try {
    const convRef = doc(db, "conversations", conversationId);
    
    await updateDoc(convRef, {
      // arrayUnion adds the element only if it doesn't already exist
      "members": arrayUnion(newMemberPhone),
      // This path notation updates a specific nested field in the map
      [`member_roles.${newMemberPhone}`]: "member" 
    });
    
    console.log("Member added successfully!");
  } catch (error) {
    console.error("Error adding member: ", error);
  }
}


async function sendMessage(conversationId, senderPhone, messageText) {
  try {
    // Reference to the subcollection path: /conversations/CONV_ID/messages
    const messagesSubcolRef = collection(db, "conversations", conversationId, "messages");
    
    await addDoc(messagesSubcolRef, {
      sender_id: senderPhone,
      message_text: messageText,
      sent_datetime: serverTimestamp(),
      status: "sent"
    });
    
    console.log("Message sent!");
  } catch (error) {
    console.error("Error sending message: ", error);
  }
}
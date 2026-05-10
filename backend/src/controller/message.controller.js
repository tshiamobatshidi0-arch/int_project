export const createMessage=(req,res)=>{
    //I will need a sender id (logged in user) and a recieve id(I will get it from query params )
    //I will need the message text/image url (third party will be need) and the message must have a timestamp and a message id
}

 export const getMessages =(req,res)=>{
    //I will extract the the contact'id from the params ,I will also take the logged in user's id
    //In the chat user can be both a reciver and a sender
    //for frontend
    //the logged in user's message must be on the right using the ids from the message and the contact on the left 
}

export const deleteMessage=(req,res)=>{
    //you can delete for both users or just you if you are the sender
    //delete any message that has you as a sender(senderId)1
    //When deleting for yourself you delete using you senderId
    //When deleting for everyone you delete the messageID 
}

export const updateMessage =(req,res)=>{
   /**
    * A logged in user can only update their latest message(OrderBy(Time))
    * 
    */
}
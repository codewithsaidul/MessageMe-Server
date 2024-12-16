const app = require("./app");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

require("dotenv").config();

process.on("uncaughtException", (err) => {
  console.log(err);
  process.exit(1);
});

const http = require("http");
const User = require("./modules/user");
const path = require("path");
const FriendRequest = require("./modules/friendRequest");
const OneToOneMessage = require("./modules/OneToOneMessage");
const AudioCall = require("./modules/audioCall");
const VideoCall = require("./modules/videoCall");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const DB = process.env.DBURI.replace("<db_password>", process.env.DBPASSWORD);
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // useCreateIndex: true,
    // useFindAndModify: false,
    // useUnifiedToplogy: true,
  })
  .then((con) => {
    console.log("DB Connection successful");
  });

console.log(DB);

const port = process.env.PORT || 5000;

server.listen(port, () => {
  console.log(`App is Running on ${port}`);
});

io.on("connection", async (socket) => {
  console.log(JSON.stringify(socket.handshake.query));
  // console.log(socket)

  const user_id = socket.handshake.query["user_id"];

  const socket_id = socket.id;

  console.log(`User Connected ${socket_id}`);

  if (Boolean(user_id)) {
    await User.findByIdAndUpdate(user_id, { socket_id, status: "Online" });
  }

  // We can write our socket event listner here

  // Friend Request Server
  // Send Friend Request
  socket.on("friend_request", async (data) => {
    try {
      const to = await User.findById(data.to).select(
        "socket_id firstName lastName"
      );
      const from = await User.findById(data.from).select(
        "socket_id firstName lastName"
      );

      console.log(from)

      // Check if a friend request already exists
      const existingRequest = await FriendRequest.findOne({
        sender: data.from,
        recipient: data.to,
        
      });

      console.log(existingRequest)

      if (existingRequest) {
        io.to(from?.socket_id).emit("error", {
          message: "Friend request already sent.",
        });
        return;
      }

      // Create a friend request
      await FriendRequest.create({
        sender: data.from,
        recipient: data.to,
      });

      // Emit event request received to recipient
      io.to(to?.socket_id).emit("new_friend_request", {
        message: "New friend request received",
      });
      io.to(from?.socket_id).emit("request_sent", {
        message: "Request sent successfully!",
      });
    } catch (error) {
      console.error("Error sending friend request:", error);
      io.to(data.from).emit("error", {
        message: "Failed to send friend request.",
      });
    }
  });

  // Accept Friend Request
  socket.on("accept_request", async (data) => {
    console.log(typeof data.request_id)
    try {
      const request_doc = await FriendRequest.findById(data.request_id);
      console.log(request_doc);
      if (!request_doc) {
        console.error(`No friend request found with ID: ${data.request_id}`);
        throw new Error("Friend request not found");
      }


      const sender = await User.findById(request_doc.sender);
      const receiver = await User.findById(request_doc.recipient);

      sender.friends.push(request_doc.recipient);
      receiver.friends.push(request_doc.sender);

      await sender.save({ new: true, validateModifiedOnly: true });
      await receiver.save({ new: true, validateModifiedOnly: true });

      await FriendRequest.findByIdAndDelete(data.request_id);

      io.to(sender.socket_id).emit("request-accepted", {
        message: "Friend request accepted",
      });
      io.to(receiver.socket_id).emit("request-accepted", {
        message: "Friend request accepted",
      });
    } catch (error) {
      console.error("Error accepting friend request:", error);
      io.to(data.from).emit("error", {
        message: "Failed to accept friend request.",
      });
    }
  });

  // Get Direct Conversation

  socket.on("get_direct_conversations", async ({ user_id }, callback) => {
    const existing_conversations = await OneToOneMessage.find({
      participants: { $all: [user_id] },
    }).populate("participants", "firstName lastName avatar _id email status");

    // db.books.find({ authors: { $elemMatch: { name: "John Smith" } } })

    console.log(existing_conversations);

    callback(existing_conversations);
  });

  // Start a New Conversation
  socket.on("start_conversation", async (data) => {
    // data: {to: from:}

    const { to, from } = data;

    // check if there is any existing conversation

    const existing_conversations = await OneToOneMessage.find({
      participants: { $size: 2, $all: [to, from] },
    }).populate("participants", "firstName lastName _id email status");

    console.log(existing_conversations[0], "Existing Conversation");

    // if no => create a new OneToOneMessage doc & emit event "start_chat" & send conversation details as payload
    if (existing_conversations.length === 0) {
      let new_chat = await OneToOneMessage.create({
        participants: [to, from],
      });

      new_chat = await OneToOneMessage.findById(new_chat._id).populate(
        "participants",
        "firstName lastName _id email status"
      );

      console.log(new_chat);

      socket.emit("start_chat", new_chat);
    }
    // if yes => just emit event "start_chat" & send conversation details as payload
    else {
      socket.emit("start_chat", existing_conversations[0]);
    }
  });

  socket.on("get_messages", async (data, callback) => {
    const { messages } = await OneToOneMessage.findById(
      data.conversation_id
    ).select("messages");
    callback(messages);
  });

  // Handle Text/Link messages
  socket.on("text_message", async (data) => {
    console.log(data);

    // data => {to, from, message, conversation_id, type}

    const { to, from, message, conversation_id, type } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    const new_message = {
      to,
      from,
      type,
      text: message,
      create_at: Date.now(),
    };

    // create a new conversaiton if it does'nt exist yet or add a new messages to the message list
    const chat = await OneToOneMessage.findById(conversation_id);
    chat.messages.push(new_message);

    // save to db
    await chat.save({});

    // emit incoming_message -> to user
    io.to(to_user.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    });

    // emit outgoing_message -> to user
    io.to(from_user.socket_id).emit("new_message", {
      conversation_id,
      message: new_message,
    });
  });

  socket.on("file_message", async (data) => {
    console.log(data, "Received Message");

    // data => {to, from, file, text}

    // get the file extension
    const fileExtension = path.extname(data.file.name);

    //  generate a unique file name
    const fileName = `${Date.now()}_${Math.random() * 10000}${fileExtension}`;

    // file upload to aws s3

    // create a new conversaiton if it does'nt exist yet or add a new messages to the message list

    // save to db

    // emit incoming_message -> to user

    // emit outgoing_message -> to user
  });

  // -------------- HANDLE AUDIO CALL SOCKET EVENTS ----------------- //

  // handle start_audio_call event
  socket.on("start_audio_call", async (data) => {
    const { from, to, roomID } = data;

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    console.log("to_user", to_user);

    // send notification to receiver of call
    io.to(to_user?.socket_id).emit("audio_call_notification", {
      from: from_user,
      roomID,
      streamID: from,
      userID: to,
      userName: to,
    });
  });

  // handle audio_call_not_picked
  socket.on("audio_call_not_picked", async (data) => {
    console.log(data);
    // find and update call record
    const { to, from } = data;

    const to_user = await User.findById(to);

    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Missed", status: "Ended", endedAt: Date.now() }
    );

    // TODO => emit call_missed to receiver of call
    io.to(to_user?.socket_id).emit("audio_call_missed", {
      from,
      to,
    });
  });

  // handle audio_call_accepted
  socket.on("audio_call_accepted", async (data) => {
    const { to, from } = data;

    const from_user = await User.findById(from);

    // find and update call record
    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Accepted" }
    );

    // TODO => emit call_accepted to sender of call
    io.to(from_user?.socket_id).emit("audio_call_accepted", {
      from,
      to,
    });
  });

  // handle audio_call_denied
  socket.on("audio_call_denied", async (data) => {
    // find and update call record
    const { to, from } = data;

    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Denied", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit call_denied to sender of call

    io.to(from_user?.socket_id).emit("audio_call_denied", {
      from,
      to,
    });
  });

  // handle user_is_busy_audio_call
  socket.on("user_is_busy_audio_call", async (data) => {
    const { to, from } = data;
    // find and update call record
    await AudioCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Busy", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit on_another_audio_call to sender of call
    io.to(from_user?.socket_id).emit("on_another_audio_call", {
      from,
      to,
    });
  });



   // --------------------- HANDLE VIDEO CALL SOCKET EVENTS ---------------------- //

  // handle start_video_call event
  socket.on("start_video_call", async (data) => {
    const { from, to, roomID } = data;

    console.log(data);

    const to_user = await User.findById(to);
    const from_user = await User.findById(from);

    console.log("to_user", to_user);

    // send notification to receiver of call
    io.to(to_user?.socket_id).emit("video_call_notification", {
      from: from_user,
      roomID,
      streamID: from,
      userID: to,
      userName: to,
    });
  });

  // handle video_call_not_picked
  socket.on("video_call_not_picked", async (data) => {
    console.log(data);
    // find and update call record
    const { to, from } = data;

    const to_user = await User.findById(to);

    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Missed", status: "Ended", endedAt: Date.now() }
    );

    // TODO => emit call_missed to receiver of call
    io.to(to_user?.socket_id).emit("video_call_missed", {
      from,
      to,
    });
  });

  // handle video_call_accepted
  socket.on("video_call_accepted", async (data) => {
    const { to, from } = data;

    const from_user = await User.findById(from);

    // find and update call record
    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Accepted" }
    );

    // TODO => emit call_accepted to sender of call
    io.to(from_user?.socket_id).emit("video_call_accepted", {
      from,
      to,
    });
  });

  // handle video_call_denied
  socket.on("video_call_denied", async (data) => {
    // find and update call record
    const { to, from } = data;

    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Denied", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit call_denied to sender of call

    io.to(from_user?.socket_id).emit("video_call_denied", {
      from,
      to,
    });
  });

  // handle user_is_busy_video_call
  socket.on("user_is_busy_video_call", async (data) => {
    const { to, from } = data;
    // find and update call record
    await VideoCall.findOneAndUpdate(
      {
        participants: { $size: 2, $all: [to, from] },
      },
      { verdict: "Busy", status: "Ended", endedAt: Date.now() }
    );

    const from_user = await User.findById(from);
    // TODO => emit on_another_video_call to sender of call
    io.to(from_user?.socket_id).emit("on_another_video_call", {
      from,
      to,
    });
  });




  // -------------- HANDLE SOCKET DISCONNECTION ----------------- //

  socket.on("end", async (data) => {
    // Find user by ID and set status as offline

    if (data.user_id) {
      await User.findByIdAndUpdate(data.user_id, { status: "Offline" });
    }

    //TODO => broadcast to all conversation rooms of this user that this user is offline (disconnected)

    console.log("closing connection");
    socket.disconnect(0);
  });
});

process.on("unhandledRejection", (err) => {
  console.log(err);
  server.close(() => {
    process.exit(1);
  });
});

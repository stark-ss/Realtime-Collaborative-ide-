const express=require("express");
const{createServer}=require("http");
const{Server}=require("socket.io");
const cors=require("cors");
const { error } = require("console");
const { stderr, stdin } = require("process");
const { version } = require("os");
const { Script } = require("vm");
require('dotenv').config();

const app=express();
app.use(cors());

const httpServer=createServer(app);

const io=new Server(httpServer,{
    cors:{
        origin:"http://localhost:5173",
        methods:["GET","POST"]
    }
});

io.on("connection",(socket)=>{
    socket.on("join_room",(roomID)=>{
        Array.from(socket.rooms).forEach((r)=>{
           if(r!==socket.id) socket.leave(r);
        });
        socket.join(roomID);
        socket.currentRoom=roomID;
        const clients=io.sockets.adapter.rooms.get(roomID);
        if(clients && clients.size>1){
            const existingClient=Array.from(clients).find((id)=>id!==socket.id);
            if(existingClient){
                io.to(existingClient).emit("request_current_code",{
                    targetSocketId:socket.id
                });
                io.to(existingClient).emit("request_current_files",{
                    targetSocketId:socket.id
                });
            }
        }
        io.to(roomID).emit("room_user_count",{count:clients?clients.size:0});
        socket.to(roomID).emit("notification",{
            message:`User ${socket.id.substring(0,5)} entered the room`,
            timestamp:new Date().toLocaleTimeString()
        });
    });

    socket.on("code_execution_status",({roomID,executing})=>{
        socket.to(roomID).emit("code_execution_status",{executing});
    });
    socket.on("code_execution_result",({roomID,output,error})=>{
        socket.to(roomID).emit("code_execution_result",{output,error});
    });

    socket.on("create_file",({roomID,file})=>{
        socket.to(roomID).emit("receive_new_file",file);
    });

    socket.on("sync_files_response",({targetSocketId,files})=>{
        io.to(targetSocketId).emit("receive_all_files",{files});
    });

    socket.on("leave_room",(roomId)=>{
        socket.leave(roomId);
        socket.to(roomId).emit("notification",{
            message:`User ${socket.id.substring(0,5)} left the room`,
            timestamp:new Date().toLocaleTimeString()
        });
        socket.currentRoom=null;
        const clients=io.sockets.adapter.rooms.get(roomId);
        io.to(roomId).emit("room_user_count",{count:clients?clients.size:0});
    });
    socket.on("type_code",({roomID,text,fileId})=>{
        socket.to(roomID).emit("receive_code",{
            senderID:socket.id.substring(0,5),
            fileId:fileId,
            text:text,
            roomID:roomID,
            timestamp:new Date().toLocaleTimeString()
        });
    });
    socket.on("sync_code_response",({targetSocketId,text,language})=>{
        io.to(targetSocketId).emit("receive_code",{text,language});
    });
    socket.on("change_language",({roomID,language})=>{
        socket.to(roomID).emit("receive_language",{language});
    });

    socket.on("delete_file",({roomID,fileId})=>{
        socket.to(roomID).emit("receive_delete_file",{fileId});
    });

    socket.on("disconnect",()=>{
        if(socket.currentRoom){
            const roomID=socket.currentRoom;
        socket.to(socket.currentRoom).emit("notification",{
            message:`User ${socket.id.substring(0,5)} left the room`,
            timestamp:new Date().toLocaleTimeString()
        });
        const clients=io.sockets.adapter.rooms.get(roomID);
        io.to(roomID).emit("room_user_count",{count:clients?Math.max(0,clients.size-1):0});
    }
    });
    
    const JDOODLE_LANGS={
        javascript:{lang:'nodejs',version:'4'},
        python:{lang:"python3",version:"4"},
        cpp: {lang:"cpp17",version:"1"},
        gcc: {lang:"cpp17",version:"1"}
    };
    
    socket.on("request_piston_execute",async ({payload},callback)=>{
        try{
           const {lang,version}=JDOODLE_LANGS[payload.language] || JDOODLE_LANGS.javascript;
           const source_code=payload.files[0].content;

           const input_data=payload.stdin || "";

           const response=await fetch('https://api.jdoodle.com/v1/execute',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              clientId:process.env.JDOODLE_CLIENT_ID,
              clientSecret:process.env.JDOODLE_CLIENT_SECRET,
              script:source_code,
              stdin:input_data,
              language:lang,
              versionIndex:version
            })
           });

           const data=await response.json();
           
           if(data.statusCode===401 || data.error){
            callback({success:false,error:data.error || 'Invalid API credentials or quota exceeded'});
            return;
           }

           callback({
            success:true,
            data:{
                run:{output:data.output || 'code executed with no output',
                    stderr:null}
            }
           });
        }catch(err){
            console.error(" Fetch Error on Backend:", err);
            callback({success:false,error:err.message}); }
    });
});
const PORT=process.env.PORT || 4000;
httpServer.listen(PORT,()=>{
    console.log(`server running at ${PORT}`);
});
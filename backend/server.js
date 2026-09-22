const express=require("express");
const{createServer}=require("http");
const{Server}=require("socket.io");
const cors=require("cors");
const bcrypt=require('bcrypt');
require('dotenv').config();

const{Pool}=require('pg');

const pool=new Pool(
    process.env.DATABASE_URL?{
     connectionString: process.env.DATABASE_URL,
      ssl:{rejectUnauthorized:false },
    }:{
    user:process.env.DB_USER,
    host:process.env.DB_HOST,
    database:process.env.DB_NAME,
    password:process.env.DB_PASSWORD,
    port:process.env.DB_PORT,
});

const app=express();
app.use(cors());
app.use(express.json());

app.post(`/api/join-room`,async(req,res)=>{
    const{email,name,roomName,pass}=req.body;
    if(!email||!name||!roomName||!pass){
        return res.status(400).json({success:false,message:'all fields are required'}); 
    }    

    try{
        await pool.query(`insert into users(email,name) values ($1,$2) on conflict (email) do update set name=excluded.name`,[email,name]);

        const result=await pool.query(`select * from rooms where room_name=$1`,[roomName]);

        if (result.rows.length>0){
            const currentRoom=result.rows[0];
            const match=await bcrypt.compare(pass,currentRoom.password);
            if(!match){
                return res.status(401).json({success:false,message:'Incorrect room password'});
            }

        } else{
            const hashPass=await bcrypt.hash(pass,5);
            await pool.query(`insert into rooms (room_name,password) values($1,$2)`,[roomName,hashPass]);
        }
        return res.json({success:true,message:'Authenticated successfully'});
    }catch(e){
        console.error('Database error',e);
        return res.status(500).json({success:false,message:'server error during authentication'});
    }
});

app.get(`/api/check-room/:roomName`,async(req,res)=>{
    try{
        const{roomName}=req.params;
        const result=await pool.query(`select 1 from rooms where room_name=$1`,[roomName]);
        return res.json({exists:result.rows.length>0});
    }catch(e){
       return res.status(500).json({exists:false});
    }
});

const httpServer=createServer(app);

const io=new Server(httpServer,{
    cors:{
        origin:"*",
        methods:["GET","POST"]
    }
});

io.on("connection",(socket)=>{
    socket.on("join_room",({roomID,userName})=>{
        Array.from(socket.rooms).forEach((r)=>{
           if(r!==socket.id) socket.leave(r);
        });
        socket.join(roomID);
        socket.currentRoom=roomID;
        socket.userName=userName || 'Anonymous';

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
            message:` ${socket.userName} entered the room`,
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

    socket.on("leave_room",async (roomId)=>{
        socket.leave(roomId);
        socket.to(roomId).emit("notification",{
            message:`${socket.userName} left the room`,
            timestamp:new Date().toLocaleTimeString()
        });
        socket.currentRoom=null;
        const clients=io.sockets.adapter.rooms.get(roomId);
        const count=clients?clients.size:0;
        io.to(roomId).emit("room_user_count",{count});

        if(count===0){
            try{
                await pool.query(`delete from rooms where room_name=$1`,[roomId]);
            }catch(e){
                console.error('error deleting empty room',e);
            }
        }
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

    socket.on("disconnect",async ()=>{
        if(socket.currentRoom){
            const roomID=socket.currentRoom;
        socket.to(socket.currentRoom).emit("notification",{
            message:`${socket.userName} left the room`,
            timestamp:new Date().toLocaleTimeString()
        });
        const clients=io.sockets.adapter.rooms.get(roomID);
        const count=clients? clients.size:0;
        io.to(roomID).emit("room_user_count",{count});

        if(count===0){
            try{
                await pool.query(`delete from rooms where room_name=$1`,[roomID]);
            }catch(e){
                console.error('error deleting empty room',e);
            }
        }
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
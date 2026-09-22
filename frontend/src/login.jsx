import { useState,useEffect } from "react";

const backendUrl=import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export default function Login({onRoomJoined,connected}){
    const [email,setEmail]=useState('');
    const[name,setName]=useState('');
    const[roomName,setRoom]=useState('');
    const[pass,setPass]=useState('');
    const[error,setError]=useState('');
    const[load,setLoad]=useState(false);
    const[status,setStatus]=useState('');

    useEffect(()=>{
        const savedEmail=localStorage.getItem('userEmail');
        const savedName=localStorage.getItem('userName');
        if(savedEmail) setEmail(savedEmail);
        if(savedName) setName(savedName);
    },[]);

    const handleSubmit=async (e)=>{
        e.preventDefault();
        setError('');
        setLoad(true);

        try{
          const res=await fetch(`${backendUrl}/api/join-room`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({email,name,roomName,pass})
          });

          const data=await res.json();
          if(data.success){
            localStorage.setItem('userEmail',email);
            localStorage.setItem('userName',name);
            onRoomJoined(roomName);
          }else{
            setError(data.message || 'Authentication failed');
          }

        }catch(e){
            console.error('Connection error',e)
            setError('Could not connect to the server');
        }finally{setLoad(false);}
    };

        useEffect(()=>{
        if (!roomName.trim()){
            setStatus('');
            return;
        }
        const timer=setTimeout(async()=>{
            try{
              const res=await fetch(`${backendUrl}/api/check-room/${roomName}`);
              const data=await res.json();
              if(data.exists){
                setStatus('🟢 Room is active (Enter password to join)');
              }else{
                setStatus('Room does not exist (A new one will be created)');
              }
            }catch(e){
                setStatus('');
            }
        },400);
        return ()=>clearInterval(timer);
    },[roomName]);

    return(
        <div style={{display:'flex',
      flexDirection:'column',      
      justifyContent:'center',
      alignItems:'center',
      height:'100vh',
      backgroundColor:'#1e1e1e',
      color:'#fff',
      fontFamily:'sans-serif'
      }}>
        <h1>CODE COLLAB</h1>
        

        <form onSubmit={handleSubmit} style={{background: '#252526',
        padding:'25px',
        borderRadius:'6px',
        border:'1px solid #444',
        width:'300px',
        display:'flex',
        flexDirection:'column',
        gap:'12px'
        }}>
            <h2 style={{textAlign:'center',fontSize:'18px'}}>Join Coding Room</h2>
            {error &&(
                <div style={{background:'#512b2b',color:'#ff8080',padding:'6px',borderRadius:'4px',fontSize:'12px'}}>{error}</div>
            )}

            <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                <label style={{fontSize:'12px',color:'#bbb'}}>Email</label>
                <input type="email" required placeholder="you@mail.com" value={email} onChange={(e)=>setEmail(e.target.value)}
                style={{padding:'6px 8px',borderRadius:'4px',border:'1px solid#555',background:'#333',color:'#fff',fontSize:'13px'}} />
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                <label style={{fontSize:'12px',color:'#bbb'}}>Name</label>
                <input type="text" required placeholder="your name" value={name} onChange={(e)=>setName(e.target.value)}
                style={{padding:'6px 8px',borderRadius:'4px',border:'1px solid#555',background:'#333',color:'#fff',fontSize:'13px'}} />
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                <label style={{fontSize:'12px',color:'#bbb'}}>Room Name</label>
                <input type="text" required placeholder="Room ID" value={roomName} onChange={(e)=>setRoom(e.target.value)}
                style={{padding:'6px 8px',borderRadius:'4px',border:'1px solid#555',background:'#333',color:'#fff',fontSize:'13px'}} />
            </div>
            
            {status && <div style={{fontSize:'11px',color:'#888'}}>{status}</div>}

            <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                <label style={{fontSize:'12px',color:'#bbb'}}>Room Password</label>
                <input type="password" required placeholder="Room ID" value={pass} onChange={(e)=>setPass(e.target.value)}
                style={{padding:'6px 8px',borderRadius:'4px',border:'1px solid#555',background:'#333',color:'#fff',fontSize:'13px'}} />
            </div>
             
             <button type="submit" disabled={load} style={{marginTop:'8px', 
            padding:'8px', 
            cursor:load?'not-allowed':'pointer', 
            borderRadius:'4px', 
            background:'#0d24a7', 
            color:'#fff', 
            fontSize:'13px', 
            fontWeight:'bold',
            border:'none'
          }}>{load?'Checking':'Enter Room'}</button>

        </form>
        <div style={{fontSize:'15px',color:'#bbb'}}>
            Server Status:<strong>{connected?'🟢 Connected':'🔴 Disconnected Please wait server is starting....'}</strong>
        </div>
      </div>
    );

}
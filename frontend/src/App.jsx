import Login from "./login";
import {useEffect,useRef,useState} from "react";
import{io} from "socket.io-client";
import Editor, { useMonaco } from "@monaco-editor/react";
import OutputTerminal from "./OutputTreminal";
const backendUrl=import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const socket=io(backendUrl);

export default function App() {
  //backend values
  const[connected,setConnected]=useState(socket.connected);

  const[room,setRoom]=useState("");
  const[joinedRoom,setJoinedRoom]=useState("");
  const[logs,setLogs]=useState([]);
  const[userCount,setUserCount]=useState(0);
  
  //monaco values
  const[files,setFiles]=useState([
    {id:'1',name:'main',content:'//Write your own code here\nconsole.log("hello world")',language:'javascript'}
  ]);
  const[activeField,setActiveField]=useState('1');
  const activeFile=files.find(f=>f.id===activeField) ||files[0];
  const code=activeFile.content;
  const lang=activeFile.language;
  const activeFieldRef=useRef(activeField);
  activeFieldRef.current=activeField;
  const filesRef=useRef(files);
  filesRef.current=files;

  const[fontSize,setFontSize]=useState(14);
  const[theme,setTheme]=useState('vs-dark');
  const[showMinmap,setMinmap]=useState(false);

  const editorRef=useRef(null);
  const isRemoteUpdate=useRef(false);
  const logContainer=useRef(null);

  //backend functions
  const codeRef=useRef(code);
  codeRef.current=code;
  const langRef=useRef(lang);
  langRef.current=lang;

  useEffect(()=>{
    if (socket.connected) {
    setConnected(true);
  }
    
    function onRoomUserCount(data){setUserCount(data.count);}
    function onConnect(){setConnected(true);}
    function onDisconnect(){setConnected(false);}
    function onNotification(data){setLogs((prev)=>[...prev,`${data.timestamp}:${data.message}`]);}

    function onReceiveNewFile(newFile){
      setFiles(prev=>{
        if(prev.some(f=>f.id===newFile.id)) return prev;
        return [...prev,newFile];
      });
    }

    function onRequestCurrentFiles({targetSocketId}){
      socket.emit("sync_files_response",{
        targetSocketId,
        files:filesRef.current
      });
    }
    function onReceiveAllFiles(data){
      if(data.files && data.files.length>0) setFiles(data.files);
    }

    function onReceiveCode(data){
      setFiles(prev=>prev.map(f=>f.id===data.fileId?{...f,content:data.text}:f));
      if(data.fileId===activeFieldRef.current){
      if(editorRef.current){
        const editor=editorRef.current;
        const model=editor.getModel();
        
        if(data.language)
          setFiles(prev=>prev.map(f=>f.id===activeFieldRef.current?{...f,language:data.language}:f));

        if(!model) return;

        if(model.getValue()!==data.text){
        isRemoteUpdate.current=true;

        const fullRange=model.getFullModelRange();
        model.pushEditOperations(
          [],
          [
            {
              range:fullRange,
              text:data.text
            }
          ],
          ()=>null
        );
        
        isRemoteUpdate.current=false;
        }
      }
      }
    }

    function onReceiveLanguage(data){
      setFiles(prev=>prev.map(f=>f.id===activeFieldRef.current?{...f,language:data.language}:f))}

    function onRequestCurrentCode({targetSocketId}){
      socket.emit("sync_code_response",{
        targetSocketId,
        text:codeRef.current,
        language:langRef.current
      });
    }

    function onReceiveDeleteFile({fileId}){
      setFiles(prev=>{
        const updated=prev.filter(f=>f.id!==fileId);
        if(updated.length===0) return prev;

        if(activeField.current===fileId)
          setActiveField(updated[0].id);
        return updated;
      });
    }
    socket.on("receive_delete_file",onReceiveDeleteFile);
    
    socket.on("room_user_count",onRoomUserCount);
    socket.on("request_current_code",onRequestCurrentCode);
    socket.on("receive_new_file",onReceiveNewFile);
    socket.on("request_current_files",onRequestCurrentFiles);
    socket.on("receive_all_files",onReceiveAllFiles);
    socket.on("receive_language",onReceiveLanguage);
    socket.on("connect",onConnect);
    socket.on("disconnect",onDisconnect);
    socket.on("notification",onNotification);
    socket.on("receive_code",onReceiveCode);

    return()=>{
      socket.off("receive_delete_file",onReceiveDeleteFile);
      socket.off("room_user_count",onRoomUserCount);
      socket.off("request_current_code",onRequestCurrentCode);
      socket.off("receive_new_file",onReceiveNewFile);
      socket.off("request_current_files",onRequestCurrentFiles);
      socket.off("receive_all_files",onReceiveAllFiles);
      socket.off("connect",onConnect);
      socket.off("disconnect",onDisconnect);
      socket.off("notification",onNotification);
      socket.off("receive_code",onReceiveCode);
      socket.off("receive_language",onReceiveLanguage);

    };
  },[]);
  
  const leaveRoom=()=>{
    if(joinedRoom){
      socket.emit("leave_room",joinedRoom);
      setJoinedRoom('');
      setRoom('');
      setUserCount(0);
    }
  };

  const handleLanguageChange=(e)=>{
    const newLang=e.target.value;
    setFiles(prev=>prev.map(f=>f.id===activeField?{...f,language:newLang}:f));
    if(joinedRoom){
      socket.emit("change_language",{
        roomID:joinedRoom,
        language:newLang
      });
    }
  };
  //monaco 
  const handleEditorChange=(newValue)=>{
    if(isRemoteUpdate.current) return;
    const updatedCode=newValue || '';

    setFiles(prevFiles=>prevFiles.map(file=>file.id===activeField?{...file,content:updatedCode}:file));
  
    if(joinedRoom){
      socket.emit("type_code",{
        roomID:joinedRoom,
        fileId:activeField,
        text:updatedCode
      });
    }
  };

  const handleEditorMount=(editor)=>{
    editorRef.current=editor;
  };

  const handleFileSelect=(e)=>{
    const value=e.target.value;
    if(value==='new'){
      const fileName=prompt("Enter new file name");
      if(fileName && fileName.trim()){
        const trimmedName=fileName.trim();

        if(files.some(f=>f.name.toLowerCase()===trimmedName.toLowerCase())){
          alert(`A file named ${trimmedName} already exists`);
          return;
        }
         const newId=Date.now().toString();
        const newFile={
          id:newId,
          name:trimmedName,
          content:`//Created ${trimmedName}\n//Type Your Code Here`,
          language:lang
        };
        setFiles(prev=>[...prev,newFile]);
        setActiveField(newId);

        if(joinedRoom){
          socket.emit("create_file",{
            roomID:joinedRoom,
            file:newFile
          });
        }
      }
    }else if (value) setActiveField(value);
  };

  const handleSaveFile=()=>{
    let extension='.js';
    if(activeFile.language==='python') extension='.py';
    else if(activeFile.language==='cpp') extension='.cpp';

    let downloadName=activeFile.name;
    if(!downloadName.endsWith(extension))
      downloadName+=extension;

    const blob=new Blob([activeFile.content],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=downloadName;
    link.click();
    url.revokeObjectURL(url);
  };

  const handleDeleteFile=()=>{
    if(files.length<=1){
      alert("Cannot delete the last remaining file");
      return;
    }
    const fileDeleteId=activeField;
    const updatedFiles=files.filter(f=>f.id!==fileDeleteId);
    setFiles(updatedFiles);
    setActiveField(updatedFiles[0].id);
    
    if(joinedRoom){
      socket.emit("delete_file",{
        roomID:joinedRoom,
        fileId:fileDeleteId
      });
    }
  };

  useEffect(()=>{
    if(logContainer.current)
      logContainer.current.scrollTop=logContainer.current.scrollHeight;
  },[logs]);

  const handleRoomJoined=(roomName)=>{
    setJoinedRoom(roomName);
    const userName=localStorage.getItem('userName')||'User';
    socket.emit('join_room',{roomID:roomName,userName});
  }

  if(!joinedRoom){
    return <Login onRoomJoined={handleRoomJoined} socket={socket} connected={connected}/>;
  }

  const userName=localStorage.getItem('userName') || 'user';

  return (
    <div style={{ userSelect:'none', padding:'10px',fontFamily:'sans-serif',width:'100%',boxSizing:'border-box'}}>
      
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'5px',flexWrap:'wrap',gap:'5px',background:'#252526',padding:"5px",borderRadius:'6px',border:'1px solid #444'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
        <select
        value={activeField}
        onChange={handleFileSelect} 
        style={{padding:'3px 6px',background:'#333',color:'#fff',border:'1px solid #555',borderRadius:'4px',fontSize:'13px',cursor:'pointer'}}>
          <option value="" disabled>📁File</option>
          {files.map(file=>(
            <option key={file.id} value={file.id}>{file.name}</option>
          ))}
          <option value="new">+📁New File</option>
        </select>
        <button
        onClick={handleSaveFile} title="Save/Download File"
        style={{padding:'3px 5px',background:'#333',color:'#fdfdfd',border:'1px solid #555',borderRadius:'5px',fontSize:'12px',cursor:'pointer',fontWeight:'bold'}}>💾Save</button>

        <button
        onClick={handleDeleteFile}
        title="Delete Active File"  style={{padding:'3px 5px',background:'#333',color:'#fdfdfd',border:'1px solid #555',borderRadius:'5px',fontSize:'12px',cursor:'pointer',fontWeight:'bold'}}>🗑️Delete</button>
        <label>
          Language: 
          <select value={lang} onChange={handleLanguageChange}>
            <option value="javascript">Javascript</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
          </select>
        </label>
       
          <select value={theme} onChange={(e)=>{setTheme(e.target.value)}} style={{padding:'3px 5px',background:'#333',color:'#fff',border:'1px solid #555',borderRadius:'4px',fontSize:'13px'}}>
            <option value="vs-dark">Dark (vs-dark)</option>
            <option value="light">Light</option>
            <option value="hc-black">High Contrast (hc-black)</option>
          </select>
     
          <input type="number" value={fontSize} onChange={(e)=>{setFontSize(Number(e.target.value))}} title="Font Size"
          style={{width:'50px',padding:'3px',background:"#333",color:'#fff', border:'1px solid #555',borderRadius:'4px', fontSize:'13px',textAlign:'center'}}/>
      
        <label>
          <input type="checkbox" checked={showMinmap} onChange={(e)=>{setMinmap(e.target.checked)}} />
          Show Minimap
        </label>
      </div>

        <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:'wrap' }}>
           <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <span style={{color:'#4caf50',fontWeight:'bold',display:'flex',gap:'8px',alignItems:'center',fontSize:'13px'}}>
              <span>👤 {userName}</span>
              <span>(Room:{joinedRoom})</span>
              <span style={{backgroundColor:'#2e7d32',color:'#fff', padding:'2px 8px',borderRadius:'12px',fontSize:'12px'}}>
                {userCount} {userCount===1?'User':'Users'}
              </span>
            </span>
            <button onClick={leaveRoom} style={{padding:"5px 10px", cursor:"pointer",borderRadius:"10px",backgroundColor:"#ff4d4d", color:"#fff",border:"none",fontSize:'13px'}}>Leave Room</button>
           </div>
       <span style={{fontSize:'15px'}}>
        Status:<strong>{connected?'🟢Connected':'🔴Disconnected'}</strong>
       </span>
      </div>
      </div>


      <div style={{display:'flex',gap:'15px',alignItems:'flex-start'}}>
        <div style={{flex:'1',minWidth:'0'}}>
          <div  style={{border:'1px solid #ccc',borderRadius:'4px',overflow: 'auto'}}>
        <Editor
        height='450px'
        width='100%'
        language={lang}
        theme={theme}
        value={code}
        onMount={handleEditorMount}
        onChange={handleEditorChange}
        options={{
          fontSize:fontSize,
          minimap:{enabled:showMinmap},
          automaticLayout:true,
          tabSize:2,
          scrollBeyondLastLine:true,
          lineNumbers: "on"
        }} />
      </div>
      <OutputTerminal 
      socket={socket}
      code={code}
      lang={lang}
      joinedRoom={joinedRoom}/>
      </div>
      <div ref={logContainer} style={{width:'280px',flexShrink:0,background:'#f4f4f4',padding:'10px',borderRadius:'4px',maxHeight:'400px',overflowY:'auto'}}>
        <strong>Room Activity Log:</strong>
        <ul style={{margin:'5px 0 0 20px',padding:0}}>
          {logs.map((log,index)=>(
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  );
}
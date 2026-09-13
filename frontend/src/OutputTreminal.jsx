import{useState,useEffect}from 'react';

const LANGUAGE_VERSIONS = {
    javascript: { language: "javascript", version: "*" },
    python: { language: "python", version: "*" },
    cpp: { language: "cpp", version: "*" }};

    export default function OutputTerminal({socket,code,lang,joinedRoom}){
        const[output,setOutput]=useState('');
        const[executing,setExecuting]=useState(false);
        const[error,setError]=useState(false);
        const[terminalInput,setTerminalInput]=useState('');
        useEffect(()=>{
            if(!socket) return;
            function onExecution(data){setExecuting(data.executing);}
            function onExecutionResult(data){
                setOutput(data.output);
                setError(data.error);
                setExecuting(false);
            }
            socket.on("code_execution_status",onExecution);
            socket.on("code_execution_result",onExecutionResult);

            return()=>{
            socket.off("code_execution_status",onExecution);
            socket.off("code_execution_result",onExecutionResult);
            };
        },[socket]);
        const runCode=async()=>{
            console.log('run button clicked:status',socket?.connected);
            if(!socket||!socket.connected){
                setOutput("Socket is disconnecte from backend server");
                setError(true);
                return;
            }

            setExecuting(true);
            setOutput("Executing code...");
            setError(false);

            if(joinedRoom)
                socket.emit("code_execution_status",{roomID:joinedRoom,executing:true});

            const{language,version}=LANGUAGE_VERSIONS[lang] || LANGUAGE_VERSIONS.javascript;
            const payload={language,version,files:[{content:code}],stdin:terminalInput};
             
            socket.emit('request_piston_execute',{payload},(res)=>{
                let resultOutput="";
                let isErr=false;

                if(res.success && res.data.run){
                    const runResult=res.data.run;
                    resultOutput=runResult.stderr || runResult.output || 'code executed with no output';
                    isErr=!!runResult.stderr;
                }else{
                    resultOutput=res.error || "failed to reach execution server";
                    isErr=true;
                }
                setOutput(resultOutput);
                setError(isErr);
                setExecuting(false);

                if(joinedRoom){
                    socket.emit("code_execution_result",{
                        roomID:joinedRoom,
                        output:resultOutput,
                        error:isErr
                    });
                }
            });
        };
        return(
            <div style={{marginTop:'15px'}}>
                <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'8px'}}>
                <button onClick={runCode} disabled={executing}
                style={{
                    padding: "8px 16px",
                    cursor: executing ? "not-allowed" : "pointer",
                    backgroundColor: executing ? "#888" : "#28a745",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    fontWeight: "bold",
                    flexShrink:0
                }}>{executing?'⚙️Running...':'▶ Run Code'}</button>
                <input type="text"
                value={terminalInput}
                onChange={(e)=>{setTerminalInput(e.target.value)}}
                placeholder='input terminal....(input)'
                style={{flex:1,padding:'6px 8px',borderRadius:'4px',border:'1px solid #555',background:'#2d2d2d',color:'#fff',fontSize:'13px'}}/>
                </div>

                <div style={{ background: '#1e1e1e', color: '#fff', borderRadius: '4px', padding: '12px', fontFamily: 'monospace' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                        <strong>Output Terminal</strong>
                        {output &&(
                            <button onClick={()=>setOutput("") } style={{ background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Clear Terminal</button>
                        )}
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: error ? '#ff6b6b' : '#4ec9b0', minHeight: '60px', maxHeight: '180px', overflowY: 'auto' }}>{output || "// OUtput will appear here after clcking 'Run Code'"}</pre>
                </div>
            </div>
        );
    }
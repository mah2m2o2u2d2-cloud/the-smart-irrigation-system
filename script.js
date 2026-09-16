const $=id=>document.getElementById(id);
let readings=[],demoTimer=null,port=null,reader=null,buffer="";

function motorPercent(m){if(m<30)return 100;if(m<50)return 75;if(m<70)return 50;return 0}

function addReading(soil,moisture,speed,status){
 moisture=Math.max(0,Math.min(100,Number(moisture)));
 speed=Math.max(0,Math.min(100,Number(speed)));
 readings.push({time:new Date().toLocaleTimeString(),soil:Math.round(soil),moisture:Math.round(moisture),speed:Math.round(speed),status:status||(speed?"ON":"OFF")});
 if(readings.length>30)readings.shift();
 update();
}

function update(){
 const r=readings[readings.length-1];
 $("points").textContent=readings.length;
 if(r){$("moisture").textContent=r.moisture+"%";$("speed").textContent=r.speed+"%";$("pwm").textContent="PWM: "+Math.round(r.speed*255/100);$("status").textContent=r.status}
 $("table").innerHTML=readings.slice().reverse().map(r=>`<tr><td>${r.time}</td><td>${r.soil}</td><td>${r.moisture}%</td><td>${r.speed}%</td><td>${r.status}</td></tr>`).join("");
 prediction();draw();
}

function prediction(){
 if(readings.length<2){$("prediction").textContent="Collect at least 2 readings.";return}
 const a=readings.at(-2).moisture,b=readings.at(-1).moisture,d=b-a,next=Math.max(0,Math.min(100,Math.round(b+d)));
 if(d<0)$("prediction").innerHTML=`Moisture is decreasing.<br><b>Estimated next reading: ${next}%</b><br>The soil may become dry soon if this trend continues.`;
 else if(d>0)$("prediction").innerHTML=`Moisture is increasing.<br><b>Estimated next reading: ${next}%</b>`;
 else $("prediction").innerHTML=`Moisture is stable.<br><b>Estimated next reading: ${b}%</b>`;
}

function draw(){
 const c=$("chart"),x=c.getContext("2d"),w=c.width,h=c.height;
 x.clearRect(0,0,w,h);x.strokeStyle="#dbe3ee";x.lineWidth=1;
 for(let p=0;p<=100;p+=20){let y=h-35-(p/100)*(h-60);x.beginPath();x.moveTo(45,y);x.lineTo(w-15,y);x.stroke();x.fillStyle="#64748b";x.font="13px Arial";x.fillText(p+"%",8,y+4)}
 if(!readings.length){x.fillStyle="#64748b";x.font="16px Arial";x.fillText("No data yet. Connect Arduino or start demo data.",240,160);return}
 let left=45,right=w-15,top=15,bottom=h-35;
 x.strokeStyle="#1264c8";x.lineWidth=3;x.beginPath();
 readings.forEach((r,i)=>{let px=readings.length===1?left+(right-left)/2:left+i/(readings.length-1)*(right-left),py=bottom-r.moisture/100*(bottom-top);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();
 readings.forEach((r,i)=>{let px=readings.length===1?left+(right-left)/2:left+i/(readings.length-1)*(right-left),py=bottom-r.moisture/100*(bottom-top);x.fillStyle="#1264c8";x.beginPath();x.arc(px,py,4,0,Math.PI*2);x.fill()});
}

function parseLine(line){
 const m=line.match(/MOISTURE:(\d+)/i),s=line.match(/SPEED:(\d+)/i),st=line.match(/STATUS:(ON|OFF)/i);
 if(!m||!s)return;
 const moisture=Number(m[1]),pwm=Number(s[1]);
 addReading(Math.round(moisture*1023/100),moisture,Math.round(pwm*100/255),st?st[1].toUpperCase():(pwm?"ON":"OFF"));
}

async function connectArduino(){
 if(!("serial" in navigator)){alert("Use Google Chrome or Microsoft Edge for Arduino USB connection.");return}
 try{
  port=await navigator.serial.requestPort();await port.open({baudRate:9600});
  $("connection").textContent="Status: Arduino Connected";$("connection").style.color="#15803d";
  reader=port.readable.getReader();
  while(true){const {value,done}=await reader.read();if(done)break;buffer+=new TextDecoder().decode(value);let lines=buffer.split("\n");buffer=lines.pop();lines.forEach(l=>parseLine(l.trim()))}
 }catch(e){$("connection").textContent="Status: Connection Failed";$("connection").style.color="#b91c1c";console.error(e)}
}

function startDemo(){
 if(demoTimer)return;
 let moisture=25;
 $("connection").textContent="Status: Demo Data";$("connection").style.color="#b45309";
 demoTimer=setInterval(()=>{moisture+=Math.random()*10-4;if(moisture>85)moisture=25;if(moisture<10)moisture=10;let speed=motorPercent(moisture);addReading(Math.round(moisture*1023/100),moisture,speed,speed?"ON":"OFF")},1500);
}
function clearData(){readings=[];update()}

/* n8n AI Chatbot */
const N8N_WEBHOOK_URL="https://msmast3r.app.n8n.cloud/webhook-test/smart-irrigation-chat";

async function sendMessageToN8N(question){
 try{
  const response=await fetch(N8N_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   question:question,
   moisture:readings.length?readings.at(-1).moisture:null,
   motorSpeed:readings.length?readings.at(-1).speed:null,
   pumpStatus:readings.length?readings.at(-1).status:null
  })});
  if(!response.ok)throw new Error("n8n request failed: "+response.status);
  const data=await response.json();
  return data.answer||data.output||"I did not receive an answer from the AI.";
 }catch(error){console.error(error);return "Connection error. Make sure the n8n workflow is running with the Test URL active."}
}

function addChatMessage(text,type){
 const box=$("chatMessages"),msg=document.createElement("div");
 msg.className="message "+(type==="user"?"user-message":"bot-message");
 msg.textContent=text;box.appendChild(msg);box.scrollTop=box.scrollHeight;return msg;
}
async function handleChatSend(){
 const input=$("chatInput"),question=input.value.trim();if(!question)return;
 addChatMessage(question,"user");input.value="";
 const thinking=addChatMessage("Thinking...","bot");
 thinking.textContent=await sendMessageToN8N(question);
}

$("connect").onclick=connectArduino;
$("demo").onclick=startDemo;
$("clear").onclick=clearData;
$("chatToggle").onclick=()=>{$("chatbot").classList.toggle("open");if($("chatbot").classList.contains("open"))$("chatInput").focus()};
$("chatClose").onclick=()=>{$("chatbot").classList.remove("open")};
$("chatSend").onclick=handleChatSend;
$("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter")handleChatSend()});
update();

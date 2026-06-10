const express=require('express');
const http=require('http');
const {Server}=require('socket.io');

const app=express();
const server=http.createServer(app);

const io=new Server(server,{
 cors:{origin:'*'},
 transports:['websocket','polling']
});

const PORT=process.env.PORT||443;
const rooms=new Map();
let roomCounter=1;

function createRoom(){
 const room={id:`room-${roomCounter++}`,players:new Set(),started:false};
 rooms.set(room.id,room);
 return room;
}

function findAvailableRoom(){
 for(const room of rooms.values()){
  if(!room.started&&room.players.size<4) return room;
 }
 return createRoom();
}

io.on('connection',(socket)=>{
 socket.join('lobby');

 socket.on('find_match',()=>{
  const room=findAvailableRoom();
  room.players.add(socket.id);
  socket.data.roomId=room.id;
  socket.leave('lobby');
  socket.join(room.id);

  io.to(room.id).emit('room_update',{
   roomId:room.id,count:room.players.size
  });

  if(room.players.size===4){
   room.started=true;
   io.to(room.id).emit('match_started',{roomId:room.id});
  }
 });

 socket.on('player_update',(state)=>{
  const roomId=socket.data.roomId;
  if(roomId){
   socket.to(roomId).emit('player_update',{id:socket.id,state});
  }
 });

 socket.on('lobby_message',(msg)=>{
  io.to('lobby').emit('lobby_message',{sender:socket.id,message:msg});
 });

 socket.on('room_message',(msg)=>{
  const roomId=socket.data.roomId;
  if(roomId){
   io.to(roomId).emit('room_message',{sender:socket.id,message:msg});
  }
 });

 socket.on('disconnect',()=>{
  const roomId=socket.data.roomId;
  if(!roomId) return;

  const room=rooms.get(roomId);
  if(!room) return;

  room.players.delete(socket.id);
  socket.to(roomId).emit('player_left',socket.id);

  if(room.players.size===0){
   rooms.delete(roomId);
  }
 });
});

server.listen(PORT,()=>console.log(`Running on ${PORT}`));

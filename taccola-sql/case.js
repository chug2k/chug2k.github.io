"use strict";
window.BELL_TABLES = {
  rooms:{
    note:"The house directory. room_id connects the room name to the other registers.",
    columns:["room_id","room_name"],types:["TEXT PRIMARY KEY","TEXT"],
    rows:[["E1","Ember Loft"],["G2","Glass Hall"],["R3","Reed Gallery"],["V4","Vault Annex"]]
  },
  slips:{
    note:"A slip records a bell passing through a room during a shift. The same room can appear twice.",
    columns:["slip_id","bell","shift","room_id"],types:["TEXT PRIMARY KEY","TEXT","TEXT","TEXT"],
    rows:[["S-10","RB-7","day","V4"],["S-11","SB-2","night","V4"],["S-12","RB-7","night","E1"],["S-13","RB-7","night","G2"],["S-14","RB-7","night","R3"],["S-15","RB-7","night","E1"],["S-16","SB-2","day","G2"]]
  },
  readings:{
    note:"A sound meter logged a tone and its signal strength. Larger strength means a louder reading.",
    columns:["reading_id","room_id","tone","strength"],types:["INTEGER PRIMARY KEY","TEXT","TEXT","INTEGER"],
    rows:[[1,"E1","bronze",76],[2,"G2","bronze",84],[3,"R3","bronze",91],[4,"V4","bronze",99],[5,"E1","bronze",91],[6,"R3","silver",97],[7,"G2","silver",93],[8,"R3","bronze",70]]
  },
  crates:{
    note:"Each case has a room tag, a wax seal and a cord color.",
    columns:["case_id","room_id","seal","cord"],types:["TEXT PRIMARY KEY","TEXT","TEXT","TEXT"],
    rows:[["C-09","V4","moth","blue"],["C-17","G2","moth","blue"],["C-24","E1","moth","red"],["C-32","E1","wren","green"],["C-33","R3","moon","blue"],["C-41","R3","moth","blue"],["C-58","R3","wren","green"]]
  }
};
const peakScope="WITH heard AS (\n  SELECT room_id, strength FROM readings\n  WHERE tone = 'bronze'\n    AND room_id IN ('E1', 'G2', 'R3')\n)\n";
const crateJoin="SELECT case_id, room_name\nFROM crates JOIN rooms USING (room_id)\nWHERE room_id IN ('E1', 'R3')\n";
window.BELL_QUEST = [
  {name:"Night slips",heading:"Trace the night route",table:"slips",
   voice:"I found the porter’s book under the music stand. Our rain bell is RB-7. Someone signed it into more than one room last night.",
   ask:"Return each distinct room the rain bell passed through during the night shift.",
   columns:["room_id"],
   starter:"SELECT DISTINCT room_id\nFROM slips\nWHERE bell = 'RB-7' AND shift = 'night'\nORDER BY room_id\nLIMIT 1;",
   answer:"SELECT DISTINCT room_id\nFROM slips\nWHERE bell = 'RB-7' AND shift = 'night'\nORDER BY room_id;",
   hints:["Read the result of the starter query. Its final line stops after one room.","Keep the bell and shift filters. DISTINCT removes a second visit to the same room. Remove the row limit."],
   success:"Three rooms in the book. I heard something ringing in that part of the house. Let’s try the sound meters.",
   journal:"Night route · E1, G2, R3"},
  {name:"Bronze echoes",heading:"Keep the loudest echoes",table:"readings",
   voice:"Ember Loft, Glass Hall, Reed Gallery. The rain bell rings bronze. A meter outside those three rooms picked up a different rehearsal.",
   ask:"Among the three night rooms, return every room with the highest bronze strength, including ties. Return the strength with each room.",
   columns:["room_id","strength"],
   starter:"SELECT room_id, strength FROM readings\nWHERE tone = 'bronze'\n  AND room_id IN ('E1', 'G2', 'R3')\nORDER BY strength DESC, room_id\nLIMIT 1;",
   answer:peakScope+"SELECT DISTINCT room_id, strength FROM heard\nWHERE strength = (SELECT MAX(strength) FROM heard)\nORDER BY room_id;",
   hints:["The casebook lists the rooms that belong in the search. One unusually loud meter is outside that route.","Find the maximum in the filtered readings, then keep every row equal to that maximum. LIMIT 1 would discard an equal reading."],
   success:"Two echoes at 91. I can’t tell them apart by ear. I do remember a wax moth beside a blue cord.",
   journal:"Equal bronze peaks · E1 and R3, 91 each"},
  {name:"Packing seals",heading:"Identify the case",table:"crates",
   voice:"The porters left their cases in the two echo rooms. Find the wax moth tied with blue cord, and tell me the room’s full name. I’ll fetch it.",
   ask:"In either tied room, find the case with both a moth seal and a blue cord. Return its case ID and the room name.",
   columns:["case_id","room_name"],
   starter:crateJoin+"  AND seal = 'moth'\nORDER BY case_id;",
   answer:crateJoin+"  AND seal = 'moth' AND cord = 'blue';",
   plausible:crateJoin+"  AND (seal = 'moth' OR cord = 'blue');",
   hints:["Open the crates and rooms registers. They share room_id. The casebook gives the two eligible rooms.","The starter filters for a wax moth. Add the cord color as a second condition with AND."],
   success:"There it is. Rill noses the latch on C-41 in Reed Gallery. The rain bell makes the noon concert.",
   journal:"Rain bell recovered · C-41, Reed Gallery"}
];

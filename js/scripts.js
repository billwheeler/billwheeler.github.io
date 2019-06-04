(function(t){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=t()}else if(typeof define==="function"&&define.amd){define([],t)}else{var e;if(typeof window!=="undefined"){e=window}else if(typeof global!=="undefined"){e=global}else if(typeof self!=="undefined"){e=self}else{e=this}e.App=t()}})(function(){var t,e,i;return function a(t,e,i){function n(s,o){if(!e[s]){if(!t[s]){var c=typeof require=="function"&&require;if(!o&&c)return c(s,!0);if(r)return r(s,!0);var u=new Error("Cannot find module '"+s+"'");throw u.code="MODULE_NOT_FOUND",u}var d=e[s]={exports:{}};t[s][0].call(d.exports,function(e){var i=t[s][1][e];return n(i?i:e)},d,d.exports,a,t,e,i)}return e[s].exports}var r=typeof require=="function"&&require;for(var s=0;s<i.length;s++)n(i[s]);return n}({1:[function(t,e,i){"use strict";var a=t("./storage.js");var n=t("../dnd/player.js");var r=t("../dnd/npc.js");var s=[];var o=[];var c=function(t){var e=null;if(Utils.isNumeric(t)){for(var i=0,a=s.length;i<a;i++){if(s[i].id===t){e=s[i];break}}}return e};var u=function(t){var e=null;if(Utils.isNumeric(t)){for(var i=0,a=o.length;i<a;i++){if(o[i].id===t){e=o[i];break}}}return e};var d=function(t){if(!Utils.isFunction(t))return;a.pull(function(e){s.length=0;o.length=0;for(var i=0,a=e.players.length;i<a;i++){var c=new n;c.parse(e.players[i]);s.push(c)}for(var i=0,a=e.npcs.length;i<a;i++){var u=new r;u.parse(e.npcs[i]);o.push(u)}t.apply(this)})};var l=function(t){if(!Utils.isFunction(t))return;var e=this;var i={npcs:[],players:[]};for(var n=0,r=o.length;n<r;n++){i.npcs.push(o[n].serialize())}for(var n=0,r=s.length;n<r;n++){i.players.push(s[n].serialize())}a.push(i,t)};var p=function(t){if(!Utils.isFunction(t))return;a.reset(t)};var h=function(t,e){if(!Utils.isFunction(e))return;var i=[];for(var a=0,n=s.length;a<n;a++){if(s[a].state===t)i.push(s[a])}for(var a=0,n=o.length;a<n;a++){if(o[a].state===t)i.push(o[a])}if(t===CharacterState.Encounter){i.sort(function(t,e){return e.initiative-t.initiative})}for(var a=0,n=i.length;a<n;a++){e.call(i[a])}};var f=function(t,e,i){var a=c(t);if(!a)return;switch(e){case CharacterAction.Initiative:a.applyInitiative(i[0]);break;case CharacterAction.Leave:a.leaveEncounter();break;case CharacterAction.Revive:a.revive();break;case CharacterAction.Die:a.die();break}};var v=function(t,e,i){var a=u(t);if(!a)return;switch(e){case CharacterAction.Damage:a.applyDamage(i[0]);break;case CharacterAction.Initiative:a.rollInitiative();break;case CharacterAction.Leave:a.leaveEncounter();break;case CharacterAction.Revive:a.revive();break;case CharacterAction.Die:a.die();break}};e.exports={pull:d,push:l,reset:p,charsByState:h,updatePlayer:f,updateNpc:v}},{"../dnd/npc.js":6,"../dnd/player.js":7,"./storage.js":2}],2:[function(t,e,i){(function(t){"use strict";const i="OssariaPartOne";var a=function(e){var i=new XMLHttpRequest;i.open("GET",t.DataFile,true);i.onreadystatechange=function(){if(this.readyState===4){if(this.status>=200&&this.status<400){n(this.responseText);var t=JSON.parse(this.responseText);e.apply(this,[t])}else{Debug.warn("error fetching state.json: "+this.status+", "+this.statusText)}}};i.send();i=null};var n=function(t){localStorage.setItem(i,t)};var r=function(t){if(!Utils.isFunction(t))return;var e=localStorage.getItem(i);if(e){t.apply(this,[JSON.parse(e)])}else{a(t)}};var s=function(t,e){if(!Utils.isFunction(e))return;n(JSON.stringify(t));e.apply(this)};var o=function(t){if(!Utils.isFunction(t))return;localStorage.removeItem(i);t.apply(this)};e.exports={pull:r,push:s,reset:o}}).call(this,typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{}],3:[function(t,e,i){"use strict";var a=t("./entities.js");var n=document.getElementById("active");var r=document.getElementById("inactive");var s=document.getElementById("deadguys");var o=function(){a.push(function(){c()})};var c=function(){var t=[];n.innerHTML="";r.innerHTML="";s.innerHTML="";a.charsByState(CharacterState.Encounter,function(){var t=document.createElement("tr");var e=document.createElement("td");e.innerHTML=this.render();t.appendChild(e);n.appendChild(t)});a.charsByState(CharacterState.Idle,function(){var t=document.createElement("tr");var e=document.createElement("td");e.innerHTML=this.render();t.appendChild(e);r.appendChild(t)});a.charsByState(CharacterState.Dead,function(){var t=document.createElement("tr");var e=document.createElement("td");e.innerHTML=this.render();t.appendChild(e);s.appendChild(t)})};var u=function(){document.addEventListener("click",function(t){if(t.target){var e=true;var i=parseInt(t.target.getAttribute("data-id"));switch(t.target.className){case"hard_reset":e=false;if(confirm("Are you sure? This cannot be undone.")){var n=document.getElementById("main-content");a.reset(function(){n.innerHTML="resetting up in here";setTimeout(function(){window.location.reload()},600)})}break;case"player_initiative":var r=parseInt(document.getElementById("player_initiative_"+i).value);a.updatePlayer(i,CharacterAction.Initiative,[r]);break;case"player_leave":a.updatePlayer(i,CharacterAction.Leave);break;case"player_revive":a.updatePlayer(i,CharacterAction.Revive);break;case"player_die":a.updatePlayer(i,CharacterAction.Die);break;case"npc_initiative":a.updateNpc(i,CharacterAction.Initiative);break;case"npc_damage":var s=parseInt(document.getElementById("npc_damage_"+i).value);a.updateNpc(i,CharacterAction.Damage,[s]);break;case"npc_leave":a.updateNpc(i,CharacterAction.Leave);break;case"npc_revive":a.updateNpc(i,CharacterAction.Revive);break;case"npc_die":a.updateNpc(i,CharacterAction.Die);break;default:e=false;break}if(e)o()}})};var d=function(){u();a.pull(function(){c()})};e.exports={run:d}},{"./entities.js":1}],4:[function(t,e,i){(function(t){"use strict";t.CharacterState={Dead:"dead",Idle:"alive",Encounter:"encounter"};t.CharacterAction={Damage:"damage",Die:"die",Initiative:"initiative",Leave:"leave",Revive:"revive"};t.DamageType={Acid:"acid",Bludgeoning:"bludgeoning",Cold:"cold",Fire:"fire",Force:"force",Lightning:"lightning",Necrotic:"necrotic",Piercing:"piercing",Poison:"poison",Psychic:"psychic",Radiant:"radiant",Slashing:"slashing",Thunder:"thunder"};e.exports=null}).call(this,typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{}],5:[function(t,e,i){"use strict";e.exports={d4:function(){return Utils.randomInt(1,4)},d6:function(){return Utils.randomInt(1,6)},d8:function(){return Utils.randomInt(1,8)},d10:function(){return Utils.randomInt(1,10)},d12:function(){return Utils.randomInt(1,12)},d20:function(){return Utils.randomInt(1,20)},d100:function(){return Utils.randomInt(1,100)}}},{}],6:[function(t,e,i){"use strict";var a=t("./weapon.js");var n=t("../dnd/dice.js");var r=function(){this.id=0;this.name="";this.health=5;this.armor=10;this.speed=15;this.race="Human";this.initiative=0;this.weapons=[];this.state=CharacterState.Idle};r.prototype.parse=function(t){if(!t)return;if(t.id&&Utils.isNumeric(t.id)){this.id=t.id}if(t.name){this.name=t.name}if(t.health&&Utils.isNumeric(t.health)){this.health=t.health}if(t.armor&&Utils.isNumeric(t.armor)){this.armor=t.armor}if(t.speed&&Utils.isNumeric(t.speed)){this.speed=t.speed}if(t.race){this.race=t.race}if(t.initiative&&Utils.isNumeric(t.initiative)){this.initiative=t.initiative}if(t.state){this.state=t.state}if(t.weapons&&Utils.isArray(t.weapons)){for(var e=0,i=t.weapons.length;e<i;e++){var n=new a;n.parse(t.weapons[e]);this.weapons.push(n)}}};r.prototype.serialize=function(){var t=[];for(var e=0,i=this.weapons.length;e<i;e++){t.push(this.weapons[e].serialize())}return{id:this.id,name:this.name,health:this.health,armor:this.armor,speed:this.speed,race:this.race,initiative:this.initiative,weapons:t,state:this.state}};r.prototype.render=function(){var t="<div class='ent npc' data-id='"+this.id+"'>";t+="<div><span class='bold'>"+this.name+"</span>, <span class='italic'>"+this.race+"</span>. Speed: "+this.speed+"</div>";var e="";if(this.state===CharacterState.Encounter)e=" ("+(this.health>0?"alive":"dead")+"), Initiative: <span class='bold'>"+this.initiative+"</span>";t+="<div>Health: <span class='bold'>"+this.health+"</span>"+e+"</div>";for(var i=0,a=this.weapons.length;i<a;i++){t+="<div>"+this.weapons[i].render()+"</div>"}if(this.state===CharacterState.Encounter){t+="<div><input type='button' class='npc_damage' value='Apply Damage' data-id='"+this.id+"' /><input type='text' id='npc_damage_"+this.id+"' /></div>";t+="<div style='margin-top: 4px;'>";t+="<input type='button' class='npc_leave' value='Leave Encounter' data-id='"+this.id+"' />&nbsp;";t+="<input type='button' class='npc_die' value='Die' data-id='"+this.id+"' />";t+="</div>"}else if(this.state===CharacterState.Idle){t+="<div>";t+="<input type='button' class='npc_initiative' value='Roll Initiative' data-id='"+this.id+"' />&nbsp;";t+="<input type='button' class='npc_die' value='Die' data-id='"+this.id+"' />";t+="</div>"}else if(this.state===CharacterState.Dead){t+="<div><input type='button' class='npc_revive' value='Revive NPC' data-id='"+this.id+"' /></div>"}t+="</div>";return t};r.prototype.rollInitiative=function(){this.state=CharacterState.Encounter;this.initiative=n.d20()};r.prototype.applyDamage=function(t){this.health-=t;if(this.health<=0){this.health=0;this.state=CharacterState.Dead}};r.prototype.revive=function(){this.health=1;this.state=CharacterState.Encounter};r.prototype.leaveEncounter=function(){this.initiative=0;this.state=CharacterState.Idle};r.prototype.die=function(){this.health=0;this.state=CharacterState.Dead};e.exports=r},{"../dnd/dice.js":5,"./weapon.js":8}],7:[function(t,e,i){"use strict";var a=function(){this.id=0;this.name="";this.player="";this.initiative=0;this.state=CharacterState.Idle;this.exhaustion=0};a.prototype.parse=function(t){if(!t)return;if(t.id&&Utils.isNumeric(t.id)){this.id=t.id}if(t.name){this.name=t.name}if(t.player){this.player=t.player}if(t.initiative&&Utils.isNumeric(t.initiative)){this.initiative=t.initiative}if(t.state){this.state=t.state}if(t.exhaustion&&Utils.isNumeric(t.exhaustion)){this.exhaustion=Utils.clamp(t.exhaustion,1,6);if(this.exhaustion==6)this.state=CharacterState.Dead}};a.prototype.serialize=function(){return{id:this.id,name:this.name,initiative:this.initiative,state:this.state,exhaustion:this.exhaustion}};a.prototype.render=function(){var t="<div class='ent player' data-id='"+this.id+"'>";t+="<div><span class='bold'>"+this.name+"</span> <span class='italics'>"+this.player+"</span></div>";if(this.state===CharacterState.Encounter){t+="<div>Initiative: <span class='bold'>"+this.initiative+"</span></div>";t+="<div>";t+="<input type='button' class='player_leave' value='Leave Encounter' data-id='"+this.id+"' style='margin-right:5px' />";t+="<input type='button' class='player_die' value='Die' data-id='"+this.id+"' />";t+="</div>"}else if(this.state===CharacterState.Idle){t+="<div>";t+="<input type='button' class='player_initiative' value='Apply Initiatve' data-id='"+this.id+"' /><input type='text' id='player_initiative_"+this.id+"' />";t+="<input type='button' class='player_die' value='Die' data-id='"+this.id+"' />";t+="</div>"}else if(this.state===CharacterState.Dead){t+="<div><input type='button' class='player_revive' value='Revive Player' data-id='"+this.id+"' /></div>"}t+="</div>";return t};a.prototype.applyInitiative=function(t){this.initiative=t;this.state=CharacterState.Encounter};a.prototype.leaveEncounter=function(){this.initiative=0;this.state=CharacterState.Idle};a.prototype.revive=function(){this.state=CharacterState.Encounter};a.prototype.die=function(){this.state=CharacterState.Dead};e.exports=a},{}],8:[function(t,e,i){"use strict";var a=function(){this.name="";this.dice="1d4";this.hitMod=0;this.attackMod=0;this.damageType=DamageType.Bludgeoning};a.prototype.parse=function(t){if(!t)return;if(t.name){this.name=t.name}if(t.dice){this.dice=t.dice}if(t.hitMod&&Utils.isNumeric(t.hitMod)){this.hitMod=Utils.clamp(t.hitMod,0,999)}if(t.attackMod&&Utils.isNumeric(t.attackMod)){this.attackMod=Utils.clamp(t.attackMod,0,999)}if(t.damageType){this.damageType=t.damageType}};a.prototype.serialize=function(){return{name:this.name,dice:this.dice,hitMod:this.hitMod,attackMod:this.attackMod,damageType:this.damageType}};a.prototype.render=function(){var t="<span class='bold'>"+this.name+"</span>: 1d20";if(this.hitMod>0)t+=" + "+this.hitMod;t+=" to hit, "+this.dice;if(this.attackMod>0)t+=" + "+this.attackMod;t+=", <span class='italic'>"+this.damageType+"</span>";return t};e.exports=a},{}],9:[function(t,e,i){(function(i){"use strict";i.Debug=t("./utils/debug.js");i.Utils=t("./utils/utils.js");t("./dnd/constants.js");i.DataFile="/json/state.json";var a=t("./app/ui.js");e.exports={run:a.run}}).call(this,typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})},{"./app/ui.js":3,"./dnd/constants.js":4,"./utils/debug.js":10,"./utils/utils.js":13}],10:[function(t,e,i){"use strict";e.exports={assert:console?console.assert.bind(console):function(){},clear:console?console.clear.bind(console):function(){},error:console?console.error.bind(console):function(){},group:console?console.group.bind(console):function(){},groupCollapsed:console?console.groupCollapsed.bind(console):function(){},groupEnd:console?console.groupEnd.bind(console):function(){},info:console?console.info.bind(console):function(){},log:console?console.log.bind(console):function(){},trace:console?console.trace.bind(console):function(){},warn:console?console.warn.bind(console):function(){}}},{}],11:[function(t,e,i){"use strict";var a=function(t){return!isNaN(parseFloat(t))&&isFinite(t)};var n=function(t,e){return Math.floor(Math.random()*(e-t+1))+t};var r=function(t){t=t||50;return n(1,100)<=t?true:false};var s=function(t,e,i){if(t<e)return e;if(t>i)return i;return t};e.exports={clamp:s,isNumeric:a,randomInt:n,randomChance:r}},{}],12:[function(t,e,i){"use strict";var a=function(t){return Object.prototype.toString.call(t)==="[object Array]"?true:false};var n=function(t){return typeof t==="function"?true:false};var r=function(t){try{var e=window[t],i="__storage_test__";e.setItem(i,i);e.removeItem(i);return true}catch(a){return a instanceof DOMException&&(a.code===22||a.code===1014||a.name==="QuotaExceededError"||a.name==="NS_ERROR_DOM_QUOTA_REACHED")&&e.length!==0}};e.exports={isArray:a,isFunction:n,storageAvailable:r}},{}],13:[function(t,e,i){"use strict";var a={};var n=function(t){for(var e in t){if(t.hasOwnProperty(e)){a[e]=t[e]}}};n(t("./numbers.js"));n(t("./tools.js"));e.exports=a},{"./numbers.js":11,"./tools.js":12}]},{},[9])(9)});
//# sourceMappingURL=scripts.js.map

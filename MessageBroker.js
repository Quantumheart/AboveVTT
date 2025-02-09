// this shouln't be here...

function mydebounce(func, timeout = 800){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

function clearFrame(){
	$(".streamer-canvas").each(function() {
		let canvas=$(this).get(0);
		let ctx=canvas.getContext('2d');
		ctx.clearRect(0,0,canvas.width,canvas.height);	
	});
}

const delayedClear = mydebounce(() => clearFrame());

function hideVideo(streamerid) {
		$("#streamer-video-"+streamerid+", #streamer-canvas-"+streamerid).toggleClass("hidden", true);
}

function revealVideo(streamerid) {
		$("#streamer-video-"+streamerid+", #streamer-canvas-"+streamerid).toggleClass("hidden", false);
}

function addVideo(stream,streamerid) {
	$("#streamer-video-"+streamerid+" , #streamer-canvas-"+streamerid).remove();
	let video = document.createElement("video");
	video.setAttribute("class", "dicestream");
	video.setAttribute("id","streamer-video-"+streamerid);
	video.autoplay = true;
	$(video).hide();
	video.srcObject = stream;
	document.body.appendChild(video);
	video.play();
	
	
	var dicecanvas=$(`<canvas width='${window.innerWidth}' height='${window.innerHeight}' class='streamer-canvas' />`);
	dicecanvas.attr("id","streamer-canvas-"+streamerid);
	//dicecanvas.css("opacity",0.5);
	dicecanvas.css("position","fixed");
	dicecanvas.css("top","50%");
	dicecanvas.css("left","50%");
	dicecanvas.css("transform","translate(-50%, -50%)");
	dicecanvas.css("z-index",60000);
	dicecanvas.css("touch-action","none");
	dicecanvas.css("pointer-events","none");
	dicecanvas.css("filter", "drop-shadow(-16px 18px 15px black)");
	dicecanvas.css("clip-path", "inset(2px 2px 2px 2px)");
	$("#site").append(dicecanvas);
	
	
	window.MB.sendMessage("custom/myVTT/whatsyourdicerolldefault", {
		to: streamerid,
		from: window.MYSTREAMID
	});
	
	let canvas=dicecanvas.get(0);
	let ctx=canvas.getContext('2d');
	let tmpcanvas = document.createElement("canvas");
  video.addEventListener("resize", function(){
  		let videoAspectRatio = video.videoWidth / video.videoHeight
			if (video.videoWidth > video.videoHeight)
			{
				tmpcanvas.width = Math.min(video.videoWidth, window.innerWidth);
				tmpcanvas.height = Math.min(video.videoHeight, window.innerWidth / videoAspectRatio);		
			}
			else {
				tmpcanvas.width = Math.min(video.videoWidth, window.innerHeight / (1 / videoAspectRatio));
				tmpcanvas.height = Math.min(video.videoHeight, window.innerHeight);		
			}
			dicecanvas.attr("width", tmpcanvas.width + "px");
			dicecanvas.attr("height", tmpcanvas.height  + "px");
			dicecanvas.css("height",tmpcanvas.height);
			dicecanvas.css("width",tmpcanvas.width );
  });

	let updateCanvas=function(){
		//resize canvas due to Chrome bug - this may be fixed in chrome later
		resizeCanvasChromeBug()
		
		let tmpctx = tmpcanvas.getContext("2d");
		window.requestAnimationFrame(updateCanvas);
		tmpctx.drawImage(video, 0, 0, tmpcanvas.width, tmpcanvas.height);
		if(tmpcanvas.width>0)
		{
			const frame = tmpctx.getImageData(0, 0, tmpcanvas.width, tmpcanvas.height);

			for (let i = 0; i < frame.data.length; i += 4) {
				const red = frame.data[i + 0];
				const green = frame.data[i + 1];
				const blue = frame.data[i + 2];
				if ((red < 8) && (green < 8) && (blue < 8))
					frame.data[i + 3] = 128;
				if ((red < 4) && (green < 4) && (blue < 4))
					frame.data[i + 3] = 0;
				
				
			}
			ctx.putImageData(frame,0,0);	
		}
	};
	updateCanvas();
}

function resizeCanvasChromeBug(){
	let diceRollCanvas = $(".dice-rolling-panel__container");
	if(parseInt(diceRollCanvas.attr("width")) % 2 != 0){
		diceRollCanvas.attr("width", parseInt(diceRollCanvas.attr("width"))+1);
	}
	if(parseInt(diceRollCanvas.attr("height")) % 2 != 0){
		diceRollCanvas.attr("height", parseInt(diceRollCanvas.attr("height"))+1);
	}
}

class MessageBroker {

	loadAboveWS(callback=null){
		var self=this;
		if (callback)
			this.callbackAboveQueue.push(callback);
		
		// current dev wss://b2u1l4fzc7.execute-api.eu-west-1.amazonaws.com/v1
		// current prod wss://blackjackandhookers.abovevtt.net/v1
		let searchParams = new URLSearchParams(window.location.search)
		if(searchParams.has("dev")){
			let url="wss://b2u1l4fzc7.execute-api.eu-west-1.amazonaws.com/v1?campaign="+window.CAMPAIGN_SECRET;
			if(window.DM)
				url=url+="&DM=1";
			this.abovews = new WebSocket(url);	
		}
		else{
			let url="wss://blackjackandhookers.abovevtt.net/v1?campaign="+window.CAMPAIGN_SECRET;
			if(window.DM)
				url=url+="&DM=1";
			this.abovews = new WebSocket(url);
			
		}
		this.abovews.onopen=function(){

		}
		
		if (this.loadingAboveWS) {
			return;
		}

		this.loadingAboveWS=true;
		
		this.abovews.onerror = function() {
			self.loadingAboveWS = false;
		};

		this.abovews.onmessage=this.onmessage;

		this.abovews.onopen = function() {
			self.loadingAboveWS = false;
			var recovered = false;
			if (self.callbackAboveQueue.length > 1) {
				recovered = true;
			}
			var cb;
			console.log('Empting callback queue list');
			while (cb = self.callbackAboveQueue.shift()) {
				cb();
			};
			if (recovered && (!window.DM)) {
				console.log('asking the DM for recovery!');
				self.sendMessage("custom/myVTT/syncmeup");
			}
		};
	}

	loadWS(token, callback = null) {

		if (callback)
			this.callbackQueue.push(callback);

		console.log("LOADING WS: There Are " + this.callbackQueue.length + " elements in the queue");
		if (this.loadingWS) {
			console.log("ALREADY LOADING A WS");
			return;
		}
		this.loadingWS = true;

		var self = this;
		var url = this.url;
		var userid = this.userid;
		var gameid = this.gameid;

		console.log("STARTING MB WITH TOKEN=" + token);

		this.ws = new WebSocket(url + "?gameId=" + gameid + "&userId=" + userid + "&stt=" + token);

		this.ws.onmessage=this.onmessage;


		this.ws.onerror = function() {
			self.loadingWS = false;
		};

		this.ws.onopen = function() {
			self.loadingWS = false;
			var cb;
			console.log('Empting callback queue list');
			while (cb = self.callbackQueue.shift()) {
				cb();
			};
		};

		
	}

	/// this will find all pending messages and reprocess them if needed. This is necessary on the characters page because DDB removes/injects the gamelog frequently. Any time they inject it, this gets called
	reprocess_chat_message_history() {
		for (let i = 0; i < window.MB.chat_message_history.length; i++) {
			window.MB.chat_pending_messages.push(window.MB.chat_message_history[i]);
		}
		window.MB.handle_injected_data(window.MB.chat_pending_messages[0], false);
	}

	// we keep a list of the 100 most recent messages so we can re-inject them when DDB re-injects the gamelog on the characters page.
	track_message_history(data) {
		let existingMessage = window.MB.chat_message_history.find(message => message.id == data.id);
		if (existingMessage) {
			// already have this one
			return;
		}
		window.MB.chat_message_history.unshift(data);
		if (window.MB.chat_message_history > 100) {
			window.MB.chat_message_history.pop();
		}
	}

	handle_injected_data(data, trackHistory = true){
		let self=this;
		self.chat_pending_messages.push(data);
		let animationDuration = trackHistory ? 250 : 0; // don't animate if we're reprocessing messages
		if (trackHistory) {
			window.MB.track_message_history(data);
		}
		// start the task
		
		if(self.chat_decipher_task==null){
			self.chat_decipher_task=setInterval(function(){
				console.log("deciphering");
				let pend_length = self.chat_pending_messages.length;
				for(var i=0;i<pend_length;i++){
					var current=self.chat_pending_messages.shift();
					
					var injection_id=current.data.rolls[0].rollType;
					var injection_data=current.data.injected_data;
					console.log(`injection_id = ${injection_id}`);
					console.log(`injection_data = ${injection_data}`);
					
					var found=false;
					$(document.getElementsByClassName(self.diceMessageSelector)).each(function(){
						if($(this).text()==injection_id){
							found=true;
							let li = $(this).closest("li");
							console.log("TROVATOOOOOOOOOOOOOOOOO");
							let oldheight=li.height();
							var newlihtml=self.convertChat(injection_data, current.data.player_name==window.PLAYER_NAME ).html();
							if(newlihtml=="") {
								li.css("display","none"); // THIS IS TO HIDE DMONLY STUFF
							} else if (injection_data.dmonly && window.DM) { 
							}
								
							li.animate({ opacity: 0 }, animationDuration, function() {
							 	li.html(newlihtml);
								let neweight = li.height();
								li.height(oldheight);
								li.animate({ opacity: 1, height: neweight }, animationDuration, () => { li.height("") });
								let img = li.find(".magnify");
								img.magnificPopup({type: 'image', closeOnContentClick: true });

								if (img[0]) {
									img[0].onload = () => {
										if (img[0].naturalWidth > 0) {
											li.find('.chat-link')[0].style.display = 'none';
											img[0].style.display = 'block';
										}
									}
								}

								if (injection_data.dmonly && window.DM) { // ADD THE "Send To Player Buttons"
									let btn = $("<button>Show to Players</button>")
									li.append(btn);
									btn.click(() => {
										li.css("display", "none");
										delete injection_data.dmonly;
										self.inject_chat(injection_data); // RESEND THE MESSAGE REMOVING THE "injection only"
									});
								}
							});

						}
					});
					if(!found){
						console.warn(`couldn't find a message matching ${JSON.stringify(current)}`);
						// It's possible that we could lose messages due to this not being here, but
						// if we push the message here, we can end up in an infinite loop.
						// We may need to revisit this and do better with error handling if we end up missing too many messages.
						// self.chat_pending_messages.push(current);
					}
				}
				if(self.chat_pending_messages.length==0){
					console.log("stop deciphering");
					clearInterval(self.chat_decipher_task);
					self.chat_decipher_task=null;
				}
			},500);
		}
	}

	constructor() {
		var self = this;
		
		this.mysenderid=uuid();
		this.stats={
			reflected:0,
			peers : {}
		};
		this.above_sequence=0;

		this.chat_id=uuid();
		this.chat_counter=0;
		this.chat_pending_messages=[];
		this.chat_message_history=[];
		this.chat_decipher_task=null;

		this.callbackQueue = [];
		this.callbackAboveQueue = [];

		this.userid = $("#message-broker-client").attr("data-userId");
		this.gameid = find_game_id();
		this.url = $("#message-broker-client").attr("data-connectUrl");
		this.diceMessageSelector = "DiceMessage_RollType__wlBsW";
		if (is_encounters_page() || is_characters_page()) {
			this.diceMessageSelector = "tss-r93asv-RollType";
		} 

		this.origRequestAnimFrame = null;
		this.lastAlertTS = 0;
		this.latestVersionSeen = abovevtt_version;

		this.onmessage = function(event,tries=0) {
			if (event.data == "pong")
				return;
			if (event.data == "ping")
				return;

			var msg = $.parseJSON(event.data);
			if (window.location.search.includes("popoutgamelog=true") && msg.eventType != "dice/roll/pending")
				return;
			console.log(msg.eventType);
			
			if(msg.sender){ // THIS MESSAGE CONTAINS DATA FOR TELEMEMTRY (from AboveWS)
				if(msg.sender==self.mysenderid){
					self.stats.reflected++;
					console.error("WARNING. WE RECEIVED BACK OUR OWN MESSAGE");
					return;
				}

				if(self.stats.peers[msg.sender]){
					let shouldbethis=self.stats.peers[msg.sender].sequence+1;
					if(msg.sequence==shouldbethis){
						self.stats.peers[msg.sender].sequence=msg.sequence;
						if(tries>0){
							console.log("FIXED");
							self.stats.peers[msg.sender].future_fixed++;
						}
					}
					if(msg.sequence > shouldbethis){
						if(tries==0)
							self.stats.peers[msg.sender].future++;
						
						console.log("MSG in the future. (was expecting "+shouldbethis+" but we got "+msg.sequence+ " retries :" + tries);
						if(tries<20){
							setTimeout(self.onmessage,300,event,tries+1);
							console.log("trying to fix");
							return;
						}
						else{
							console.error("lost a message");
							self.stats.peers[msg.sender].sequence=msg.sequence;
						}
					}
					if(msg.sequence < shouldbethis){
							if((msg.sequence - self.stats.peers[msg.sender].first_sequence) > 10){
								self.stats.peers[msg.sender].past++;
								console.error("Sequence message is in the past. We should try to recover");
							}
							else{
								console.log("message in the past, but the che connection is new.. so.. I guess it's ok");
							}
							
					}
				}
				else{
					self.stats.peers[msg.sender]={
							future:0,
							future_fixed:0,
							past:0,
							sequence: msg.sequence,
							first_sequence: msg.sequence,
					}
				}
			}

			if(window.CLOUD && msg.sceneId && window.CURRENT_SCENE_DATA){ // WE NEED TO IGNORE CERTAIN MESSAGE IF THEY'RE NOT FROM THE CURRENT SCENE
				if(msg.sceneId!=window.CURRENT_SCENE_DATA.id){
					if(["custom/myVTT/delete_token",
						"custom/myVTT/createtoken",
						"custom/myVTT/reveal",
						"custom/myVTT/fogdata",
						"custom/myVTT/drawing",
						"custom/myVTT/drawdata",
						"custom/myVTT/highlight",
						"custom/myVTT/pointer",
					   ].includes(msg.eventType)){
						   console.log("skipping msg from a different scene");
					   	return;
					   }
				}
			}

			if (msg.eventType == "custom/myVTT/token" && (msg.sceneId == window.CURRENT_SCENE_DATA.id || msg.data.id in window.TOKEN_OBJECTS)) {
				self.handleToken(msg);
			}
			if(msg.eventType=="custom/myVTT/delete_token"){
				let tokenid=msg.data.id;
				if(tokenid in window.TOKEN_OBJECTS){
					window.TOKEN_OBJECTS[tokenid].options.deleteableByPlayers = true;
					window.TOKEN_OBJECTS[tokenid].delete(false,false);
				}
			}
			if(msg.eventType == "custom/myVTT/createtoken"){
				if(window.DM){
					let left = parseInt(msg.data.left);
					let top = parseInt(msg.data.top);
					if (!isNaN(top) && !isNaN(left)) {
						place_token_at_map_point(msg.data, left, top);
					} else {
						place_token_in_center_of_view(msg.data);
					}
				}
			}

			if(msg.eventType == "custom/myVTT/scenelist"){
				remove_loading_overlay();
				if(window.DM){
					console.log("got scene list");

					msg.data.sort((a,b) => {
						if(a.order < b.order)
							return -1;
						if(a.order > b.order)
							return 1;
						return 0
					});
					window.ScenesHandler.scenes=msg.data;
					window.PLAYER_SCENE_ID=msg.playersSceneId;
					refresh_scenes();
					did_update_scenes();
				}
			}

			if(msg.eventType=="custom/myVTT/fetchscene"){
				let sceneId=msg.data.sceneid;

				let http_api_gw="https://services.abovevtt.net"; // uff.. we SHOULD REALLY PLACE THIS CHECK SOMEWHERE ELSE AND DO IT JUST ONE TIME...
				let searchParams = new URLSearchParams(window.location.search);
				if(searchParams.has("dev")){
					http_api_gw="https://jiv5p31gj3.execute-api.eu-west-1.amazonaws.com";
				}

				$.ajax({
					url: http_api_gw+"/services?action=getScene&campaign="+window.CAMPAIGN_SECRET+"&scene="+sceneId,
					success: (response)=>{
						self.handleScene(response);
					}
				});

			}

			if (msg.eventType == "custom/myVTT/scene") {
				self.handleScene(msg);
			}
			if (msg.eventType == "custom/myVTT/syncmeup") {
				self.handleSyncMeUp(msg);
			}
			if (msg.eventType == "custom/myVTT/audioPlayingSyncMe") {
				self.handleAudioPlayingSync(msg);
			}
			if(msg.eventType == "character-sheet/character-update/fulfilled"){
				if(window.DM)
					self.handleCharacterUpdate(msg);
			}

			if (msg.eventType == "custom/myVTT/reveal") {
				window.REVEALED.push(msg.data);
				redraw_fog();
				check_token_visibility(); // CHECK FOG OF WAR VISIBILITY OF TOKEN
			}

			if(msg.eventType== "custom/myVTT/fogdata"){ // WE RESEND ALL THE FOG EVERYTIME NOW
				window.REVEALED=msg.data;
				redraw_fog();
				check_token_visibility();
			}

			if (msg.eventType == "custom/myVTT/drawing") {
				window.DRAWINGS.push(msg.data);
				redraw_drawings();
				redraw_text();
			}

			if(msg.eventType=="custom/myVTT/drawdata"){
				window.DRAWINGS=msg.data;
				redraw_drawings();
				redraw_text();
			}
			if (msg.eventType == "custom/myVTT/chat") { // DEPRECATED!!!!!!!!!
				if(!window.NOTIFIEDOLDVERSION){
					alert('One of the player is using AboveTT 0.0.51 or less. Please update everyone to 0.0.52 or higher');
					window.NOTIFIEDOLDVERSION=true;
				}
			}
			if (msg.eventType == "custom/myVTT/CT" && (!window.DM)) {
				self.handleCT(msg.data);
			}
			if (msg.eventType == "custom/myVTT/highlight") {
				if (msg.data.id in window.TOKEN_OBJECTS) {
					window.TOKEN_OBJECTS[msg.data.id].highlight(true);
				}
			}
			if (msg.eventType == "custom/myVTT/pointer") {
				set_pointer(msg.data,(!msg.data.dm || (msg.data.dm && !msg.data.center_on_ping)));
			}

			if (msg.eventType == "custom/myVTT/lock") {
				if (window.DM)
					return;
				if (getPlayerIDFromSheet(msg.data.player_sheet) == window.PLAYER_ID) {
					//alert('locked');
					var lock_display = $("<div id='lock_display'>The DM is looking at your character sheet</p></div>");
					lock_display.css("font-size", "18px");
					lock_display.css("text-align","center");
					lock_display.css('font-weight', "bold");
					lock_display.css('background', "rgba(255,255,0,0.7)");
					lock_display.css('position', 'absolute');

					if (is_characters_page()) {
						lock_display.css({
							"top": "0px",
							"left": "0px",
							"width": "100%",
							"height": "100%"
						});
						$(".site-bar").append(lock_display);
						adjust_site_bar();
					} else {
						lock_display.css('top', '27px');
						lock_display.css('left', '0px');
						lock_display.width($("#sheet").width());
						//lock_display.height($("#sheet").height());
						lock_display.height(25);
						//lock_display.css('padding-top', '50px');
						//$("#sheet iframe").css('opacity', '0.8');
						$("#sheet").append(lock_display);
						//$("#sheet iframe").attr('disabled', 'disabled');
					}

				}
			}
			if (msg.eventType == "custom/myVTT/unlock") {
				if (window.DM)
				{
					return;
				}
				else if (getPlayerIDFromSheet(msg.data.player_sheet) == window.PLAYER_ID) {
					//alert('unlocked');
					$("#lock_display").remove();
					adjust_site_bar();
					$("#sheet iframe").removeAttr('disabled');
					$("#sheet iframe").css('opacity', '1');
					$("#sheet iframe").attr('src', function(i, val) { return val; }); // RELOAD IFRAME
				}
			}

			if (msg.eventType == "custom/myVTT/player_sheet_closed") {
				if (window.DM)
				{
					//$("[id='PlayerSheet"+getPlayerIDFromSheet(msg.data.player_sheet)+"']").attr('src', function(i, val) { return val; });
					$("[id='PlayerSheet"+getPlayerIDFromSheet(msg.data.player_sheet)+"']").attr('data-changed', 'true');
					return;
				}
			}
			
			
			if(msg.eventType=="custom/myVTT/JournalChapters"){
				if(!window.DM){
					window.JOURNAL.chapters=msg.data.chapters;
					window.JOURNAL.build_journal();
				}
			}
			
			if(msg.eventType=="custom/myVTT/note"){
				if(!window.DM){
					window.JOURNAL.notes[msg.data.id]=msg.data.note;
					
					window.JOURNAL.build_journal();
					
					if(msg.data.id in window.TOKEN_OBJECTS){
						window.TOKEN_OBJECTS[msg.data.id].place();
					}
					
					if(msg.data.popup)
						window.JOURNAL.display_note(msg.data.id);
					
				}
			}
			if(msg.eventType=="custom/myVTT/pausePlayer"){
				if(!window.DM){
					$("#VTT").toggleClass('paused', msg.data.paused);
				}
				if(msg.data.paused){
					if($(".paused-indicator").length == 0){
						let pausedIndicator = $(`
							<div class="paused-indicator">
								<div class="paused-status-indicator__subtext">Game Paused. Waiting for DM</div>
								<svg class="beholder-dm-screen loading-status-indicator__svg animate" viewBox="0 0 285 176" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow:overlay;width:100%;position:relative;padding:0 10%;"><defs><path id="beholder-eye-move-path" d="M0 0 a 15 5 0 0 0 15 0 a 15 5 0 0 1 -15 0 z"></path><clipPath id="beholder-eye-socket-clip-path"><path id="eye-socket" fill-rule="evenodd" clip-rule="evenodd" d="M145.5 76c-8.562 0-15.5-7.027-15.5-15.694 0-8.663 6.938-1.575 15.5-1.575 8.562 0 15.5-7.088 15.5 1.575C161 68.973 154.062 76 145.5 76z"></path></clipPath></defs><g class="beholder-dm-screen__beholder"><path fill-rule="evenodd" clip-rule="evenodd" d="M145.313 77.36c-10.2 0-18.466-8.27-18.466-18.47 0-10.197 8.266-1.855 18.466-1.855 10.199 0 18.465-8.342 18.465 1.855 0 10.2-8.266 18.47-18.465 18.47m59.557 4.296l-.083-.057c-.704-.5-1.367-1.03-1.965-1.59a12.643 12.643 0 0 1-1.57-1.801c-.909-1.268-1.51-2.653-1.859-4.175-.355-1.521-.461-3.179-.442-4.977.007-.897.049-1.835.087-2.827.038-.995.079-2.032.053-3.194-.031-1.158-.11-2.445-.519-3.97a10.494 10.494 0 0 0-1.014-2.43 8.978 8.978 0 0 0-1.938-2.32 9.64 9.64 0 0 0-2.468-1.54l-.314-.137-.299-.114-.609-.212c-.382-.105-.787-.227-1.151-.298-1.495-.315-2.819-.383-4.065-.39-1.248-.004-2.407.087-3.534.2a56.971 56.971 0 0 0-3.18.44c-6.271.646-12.648 1.559-13.689-.837-1.079-2.487-3.35-8.058 3.115-12.19 4.076.154 8.141.347 12.179.62 1.461.098 2.914.212 4.36.34-4.614.924-9.314 1.7-14.019 2.43h-.015a2.845 2.845 0 0 0-2.388 3.066 2.84 2.84 0 0 0 3.088 2.574c5.125-.462 10.25-.973 15.416-1.696 2.592-.378 5.17-.776 7.88-1.42a29.7 29.7 0 0 0 2.108-.59c.181-.06.363-.117.56-.193.197-.072.378-.136.594-.227.208-.09.405-.17.643-.291l.345-.174.394-.235c.064-.042.124-.076.196-.125l.235-.174.235-.174.117-.099.148-.136c.098-.094.189-.189.283-.287l.137-.152a3.44 3.44 0 0 0 .166-.22c.114-.154.224-.317.318-.484l.072-.125.038-.064.042-.09a5.06 5.06 0 0 0 .367-1.154c.045-.308.06-.63.045-.944a4.322 4.322 0 0 0-.042-.458 5.19 5.19 0 0 0-.386-1.207 5.356 5.356 0 0 0-.499-.799l-.091-.117-.072-.083a5.828 5.828 0 0 0-.303-.318l-.155-.151-.083-.076-.057-.05a9.998 9.998 0 0 0-.503-.382c-.152-.102-.28-.178-.424-.265l-.205-.124-.181-.091-.36-.186a18.713 18.713 0 0 0-.643-.28l-.591-.23c-1.521-.538-2.853-.856-4.197-1.159a83.606 83.606 0 0 0-3.951-.772c-2.604-.45-5.185-.829-7.763-1.166-4.273-.564-8.531-1.029-12.785-1.46 0-.004-.004-.004-.004-.004a38.55 38.55 0 0 0-4.81-3.1v-.004c.397-.223.965-.424 1.688-.549 1.135-.208 2.551-.242 4.05-.185 3.024.11 6.366.59 10.022.662 1.832.02 3.781-.056 5.84-.56a12.415 12.415 0 0 0 3.081-1.188 10.429 10.429 0 0 0 2.702-2.135 2.841 2.841 0 0 0-3.774-4.205l-.208.152c-.825.594-1.76.87-2.956.942-1.188.068-2.566-.09-4.004-.367-2.907-.553-6.003-1.556-9.5-2.32-1.763-.371-3.644-.7-5.802-.73a16.984 16.984 0 0 0-3.455.298 13.236 13.236 0 0 0-3.774 1.333 13.065 13.065 0 0 0-3.376 2.615 14.67 14.67 0 0 0-1.646 2.154h-.004a41.49 41.49 0 0 0-8.436-.863c-1.518 0-3.017.079-4.489.238-1.79-1.563-3.444-3.198-4.833-4.913a21.527 21.527 0 0 1-1.4-1.903 15.588 15.588 0 0 1-1.094-1.893c-.606-1.241-.905-2.422-.893-3.22a3.38 3.38 0 0 1 .038-.55c.034-.155.06-.31.121-.446.106-.273.276-.534.571-.776.579-.496 1.681-.81 2.884-.689 1.207.114 2.487.629 3.615 1.476 1.135.848 2.111 2.044 2.868 3.444l.038.076a2.848 2.848 0 0 0 3.471 1.329 2.843 2.843 0 0 0 1.714-3.641c-.768-2.135-1.96-4.235-3.675-6.003-1.71-1.76-3.924-3.18-6.502-3.872a12.604 12.604 0 0 0-4.076-.416 11.248 11.248 0 0 0-4.284 1.128 10.405 10.405 0 0 0-3.702 3.054c-.499.655-.901 1.37-1.237 2.104-.318.73-.568 1.488-.731 2.237-.337 1.503-.356 2.96-.238 4.315.125 1.362.405 2.63.764 3.822.36 1.196.803 2.317 1.298 3.373a31.9 31.9 0 0 0 1.605 3.043c.458.768.935 1.506 1.427 2.233h-.004a39.13 39.13 0 0 0-4.515 2.384c-3.111-.344-6.2-.76-9.242-1.294-2.033-.364-4.043-.769-6.007-1.26-1.96-.485-3.876-1.045-5.662-1.726a24.74 24.74 0 0 1-2.528-1.102c-.772-.393-1.48-.829-1.987-1.234a4.916 4.916 0 0 1-.56-.507c-.02-.015-.03-.03-.046-.045.288-.28.761-.621 1.314-.905.719-.382 1.566-.711 2.456-.984 1.79-.556 3.762-.9 5.76-1.098l.046-.007a2.843 2.843 0 0 0 2.547-2.805 2.846 2.846 0 0 0-2.824-2.868c-2.301-.02-4.628.11-7.028.567-1.2.231-2.418.538-3.671 1.022-.628.246-1.26.526-1.911.901a10.12 10.12 0 0 0-1.96 1.446c-.648.62-1.307 1.438-1.757 2.524-.114.261-.197.56-.284.844a7.996 7.996 0 0 0-.166.909c-.061.609-.05 1.237.049 1.809.189 1.162.632 2.12 1.109 2.891a11.265 11.265 0 0 0 1.529 1.942c1.056 1.082 2.127 1.88 3.194 2.6a33.287 33.287 0 0 0 3.21 1.855c2.142 1.093 4.284 1.979 6.434 2.774a98.121 98.121 0 0 0 6.464 2.112c.511.147 1.018.291 1.529.435a36.8 36.8 0 0 0-4.458 7.089v.004c-1.908-2.014-3.876-3.997-6.022-5.931a52.386 52.386 0 0 0-3.471-2.888 31.347 31.347 0 0 0-2.028-1.408 17.575 17.575 0 0 0-2.574-1.378 11.177 11.177 0 0 0-1.888-.616c-.761-.16-1.73-.31-3.02-.107a6.543 6.543 0 0 0-1.007.254 6.508 6.508 0 0 0-2.79 1.84 6.7 6.7 0 0 0-.594.783c-.083.129-.174.269-.238.39a7.248 7.248 0 0 0-.681 1.692 9.383 9.383 0 0 0-.3 2.02c-.022.584 0 1.09.038 1.568.084.953.231 1.786.401 2.577l.39 1.764c.027.14.065.268.087.408l.057.428.121.855.065.428.033.443.072.886c.061.586.061 1.196.076 1.801.05 2.426-.11 4.92-.435 7.407a50.6 50.6 0 0 1-1.503 7.35c-.17.594-.367 1.17-.548 1.76a55.283 55.283 0 0 1-.632 1.684l-.352.791c-.061.129-.114.276-.178.39l-.193.356-.186.355c-.064.121-.129.246-.193.326-.129.185-.257.375-.378.575l-.303.485a2.813 2.813 0 0 0 4.462 3.387c.295-.322.59-.655.878-.988.155-.17.265-.333.382-.496l.349-.488.344-.492c.117-.166.2-.325.303-.492l.583-.98a53.92 53.92 0 0 0 1.018-1.964c.295-.659.61-1.321.89-1.984a58.231 58.231 0 0 0 2.69-8.114 58.405 58.405 0 0 0 1.51-8.493c.068-.73.152-1.454.167-2.203l.045-1.12.02-.56-.012-.568-.004-.205c.167.186.333.371.496.557 1.608 1.84 3.179 3.838 4.708 5.889a181.94 181.94 0 0 1 4.481 6.328c.14.2.311.428.477.617.284.33.594.62.924.874 0 .216.003.424.015.636-2.661 2.861-5.265 5.821-7.748 9.034-1.567 2.06-3.096 4.19-4.485 6.715-.685 1.267-1.347 2.645-1.854 4.363-.246.879-.454 1.851-.496 3.02l-.007.44.022.473c.012.159.02.314.038.477.023.166.05.337.076.503.113.666.333 1.385.65 2.07.16.337.356.67.557.992.212.299.44.613.681.878a8.075 8.075 0 0 0 1.54 1.328c1.05.697 2.04 1.06 2.938 1.31 1.79.466 3.292.519 4.723.507 2.842-.053 5.367-.48 7.853-.98 4.943-1.022 9.618-2.434 14.243-3.948a2.845 2.845 0 0 0 1.911-3.236 2.842 2.842 0 0 0-3.323-2.267h-.015c-4.648.878-9.322 1.635-13.864 1.965-2.252.155-4.511.208-6.46-.027a10.954 10.954 0 0 1-1.685-.322c.004-.015.012-.026.015-.037.133-.273.322-.606.534-.954.235-.36.477-.73.768-1.117 1.14-1.548 2.619-3.164 4.183-4.723a83.551 83.551 0 0 1 2.585-2.468 35.897 35.897 0 0 0 2.312 4.16c.125.2.261.405.397.602 3.747-.413 7.415-1.06 10.356-1.617l.037-.007a7.47 7.47 0 0 1 8.702 5.957 7.491 7.491 0 0 1-4.724 8.38C132.172 94.372 138.542 96 145.313 96c20.358 0 37.087-14.708 38.994-33.514.193-.05.386-.098.576-.144a23.261 23.261 0 0 1 2.354-.458c.726-.102 1.393-.14 1.847-.125.125-.004.193.015.299.012.03.003.064.007.098.007h.053c.008.004.015.004.027.004.106 0 .094-.019.09-.068-.007-.05-.022-.125.019-.117.038.007.125.083.216.26.087.19.186.443.269.761.079.33.159.69.219 1.102.129.806.216 1.745.307 2.725.091.984.178 2.02.306 3.1.262 2.138.682 4.435 1.533 6.683.837 2.245 2.154 4.406 3.812 6.15.825.871 1.725 1.655 2.66 2.336.943.677 1.919 1.26 2.911 1.782a2.848 2.848 0 0 0 3.641-.874 2.848 2.848 0 0 0-.674-3.966" fill="#0398F3"></path><g clip-path="url(#beholder-eye-socket-clip-path)"><circle cx="137.5" cy="60" r="7" fill="#1B9AF0"><animateMotion dur="2.3s" repeatCount="indefinite"><mpath xlink:href="#beholder-eye-move-path"></mpath></animateMotion></circle></g></g><g class="beholder-dm-screen__screen"><path fill="#EAEEF0" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" d="M76 76h136v97H76z"></path><path d="M218 170.926V74.282l64-35.208v96.644l-64 35.208zM70 171.026V74.318L3 38.974v96.708l67 35.344z" fill="#F3F6F9" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path></g></svg>
							</div>
						`);			
						$("body").append(pausedIndicator);
					}
				}
				else{
					$(".paused-indicator").remove();
				}
			}
			
			if(msg.eventType=="custom/myVTT/playerjoin"){
				if (window.DM) {										
					if (msg.data == null || typeof msg.data.abovevtt_version === "undefined") {
						// Player with version <= 0.64 - avoiding popping too many alert messages
						if (self.lastAlertTS == 0 || (Date.now() - self.lastAlertTS) >= 4 * 1000) {
							console.log("A player just joined with an old version <= 0.64");
							alert("Please note, a player just joined with an old version <= 0.64.\nFor best experience and compatibility, we recommend all players and DM to run the latest AboveVTT version.");
							self.lastAlertTS = Date.now();
						}
					} else {
						if (window.CONNECTED_PLAYERS[msg.data.player_id] === "undefined" ||
						window.CONNECTED_PLAYERS[msg.data.player_id] != msg.data.abovevtt_version) {
							window.CONNECTED_PLAYERS[msg.data.player_id] = msg.data.abovevtt_version;
							
							if (msg.data.abovevtt_version != self.latestVersionSeen) {
								self.latestVersionSeen = check_versions_match();
							}
						}
					}
					if($("[name='streamDiceRolls'].rc-switch-checked").length > 0) {
						window.MB.sendMessage("custom/myVTT/enabledicestreamingfeature")
					}
					window.JOURNAL.sync();
				}	
			}
			if(msg.eventType == "custom/myVTT/endplayerturn" && window.DM){
				if($("#combat_area tr[data-current=1]").attr('data-target').endsWith(`characters/${msg.data.from}`))
					$("#combat_next_button").click();				
			}
			if(msg.eventType=="custom/myVTT/soundpad"){
				build_soundpad(msg.data.soundpad, msg.data.playing);
			}

			if(msg.eventType=="custom/myVTT/playchannel"){
				audio_playchannel(msg.data.channel,msg.data.time,msg.data.volume);
			}
			if(msg.eventType=="custom/myVTT/pausechannel"){
				audio_pausechannel(msg.data.channel);
			}
			if(msg.eventType=="custom/myVTT/changechannel"){
				audio_changesettings(msg.data.channel,msg.data.volume,msg.data.loop);
			}
			if(msg.eventType=="custom/myVTT/changeyoutube"){
					$("#youtube_volume").val(msg.data.volume);
					if(window.YTPLAYER)
					{
						window.YTPLAYER.setVolume(msg.data.volume);
					}
					else{
						$("#scene_map").prop("volume", msg.data.volume/100);
					}
			}

			if (msg.eventType == "custom/myVTT/playerdata") {
				self.handlePlayerData(msg.data);
			}
			if (msg.eventType == "custom/myVTT/actoplayerdata") {
				self.acToPlayerData(msg.data);
			}

			if (msg.eventType == "dice/roll/pending"){
				// check for injected_data!
				if(msg.data.injected_data){
					notify_gamelog();
					self.handle_injected_data(msg);
				}
			}
			
			if(msg.eventType== "custom/myVTT/iceforyourgintonic"){
				if( !window.JOINTHEDICESTREAM)
					return;
				if( (!window.MYSTREAMID)  || (msg.data.to!= window.MYSTREAMID) )
					return;
				setTimeout( () => {
				var peer= window.STREAMPEERS[msg.data.from];
				if(peer.remoteDescription!= null)
					peer.addIceCandidate(msg.data.ice);
				},500); // ritardalo un po'
			}
			if(msg.eventType == "custom/myVTT/whatsyourdicerolldefault"){
				if( !window.JOINTHEDICESTREAM)
					return;
				if( (!window.MYSTREAMID)  || (msg.data.to!= window.MYSTREAMID) )
					return;
				let sendToText = gamelog_send_to_text()	
				if(sendToText == "Everyone") {
					window.MB.sendMessage("custom/myVTT/revealmydicestream",{
						streamid: window.MYSTREAMID
					});		
				}
				else if(sendToText == "Dungeon Master"){
					window.MB.sendMessage("custom/myVTT/showonlytodmdicestream",{
						streamid: window.MYSTREAMID
					});
				}
				else{
					window.MB.sendMessage("custom/myVTT/hidemydicestream",{
						streamid: window.MYSTREAMID
					});
				}
			}

			if(msg.eventType == "custom/myVTT/turnoffsingledicestream"){
				if(window.STREAMPEERS[msg.data.from] === undefined || (msg.data.to != "everyone" && msg.data.to != window.MYSTREAMID)){
				 return;
				}	
					$("[id^='streamer-"+msg.data.from+"']").remove();
					window.STREAMPEERS[msg.data.from].close();
					delete window.STREAMPEERS[msg.data.from];
					if(msg.data.to != "everyone"){
						window.MB.inject_chat({
	              player: window.PLAYER_NAME,
	              img: window.PLAYER_IMG,
	              text: `<span class="flex-wrap-center-chat-message">One of your dice stream connections has failed/disconnected. Try reconnecting to the dice stream if this was not intentional.<br/><br/></div>`,
	              whisper: window.PLAYER_NAME
	          });
					}
			}

			if(msg.eventType == "custom/myVTT/disabledicestream"){
				enable_dice_streaming_feature(false);
			}

			if(msg.eventType == "custom/myVTT/showonlytodmdicestream"){
				if(!window.DM){		
					hideVideo(msg.data.streamid);
				}		
				else{
					revealVideo(msg.data.streamid);
				}
			}
			if(msg.eventType == "custom/myVTT/hidemydicestream"){
					hideVideo(msg.data.streamid);
			}
			if(msg.eventType == "custom/myVTT/revealmydicestream"){
					revealVideo(msg.data.streamid);
			}
			if(msg.eventType == "custom/myVTT/enabledicestreamingfeature"){
					enable_dice_streaming_feature(true);				
			}
					


			if(msg.eventType == "custom/myVTT/wannaseemydicecollection"){
				if( !window.JOINTHEDICESTREAM)
					return;
				if( (!window.MYSTREAMID))
					return;
				const configuration = {
    				iceServers:  [{urls: "stun:stun.l.google.com:19302"}]
  				};
				var peer= new RTCPeerConnection(configuration);

				if(window.MYMEDIASTREAM){
					var stream = window.MYMEDIASTREAM;
					stream.getTracks().forEach(track => peer.addTrack(track, stream));
				}

				peer.addEventListener('track', (event) => {
					console.log("aggiungo video!!!!");
				     addVideo(event.streams[0],msg.data.from);
				});
				window.makingOffer = [];
				window.makingOffer[msg.data.from] = false;
				peer.onconnectionstatechange=() => {
					if(peer.connectionState=="connected"){
						window.MB.inject_chat({
                player: window.PLAYER_NAME,
                img: window.PLAYER_IMG,
                text: `<span class="flex-wrap-center-chat-message"><p>A dice stream peer has ${peer.connectionState}. <br/><br/></div>`,
                whisper: window.PLAYER_NAME,
	          });
					}

					if(peer.connectionState=="closed" || peer.connectionState=="failed" || peer.connectionState == "disconnected"){
						peer.restartIce();
						window.MB.inject_chat({
                player: window.PLAYER_NAME,
                img: window.PLAYER_IMG,
                text: `<span class="flex-wrap-center-chat-message"><p>A dice stream connection has ${peer.connectionState}.</p><p> An automatic reconnect is being attempted. </p><p>If you are still unable to see one or more of your groups dice you may have to manually disable then reenable your dice stream in the chat above.</p><br/><br/></div>`,
                whisper: window.PLAYER_NAME,
	          });	          
					}
				};
				peer.onnegotiationneeded = () => {
					try {
						window.makingOffer[msg.data.from] = true;
						peer.createOffer({offerToReceiveVideo: 1}).then( (desc) => {
							console.log("fatto setLocalDescription");
							peer.setLocalDescription(desc);
							self.sendMessage("custom/myVTT/okletmeseeyourdice",{
								to: msg.data.from,
								from: window.MYSTREAMID,
								offer: desc,
								dm: window.DM
							})
						});
					} catch(err) {
						console.error(err);
					} finally {
						setTimeout(function(){
							window.makingOffer[msg.data.from] = false;
						}, 500)		    
					}	
				};
			 		
				peer.onicecandidate = e => {
					window.MB.sendMessage("custom/myVTT/iceforyourgintonic",{
						to: msg.data.from,
						from: window.MYSTREAMID,
						ice: e.candidate
					})
				};				
				window.STREAMPEERS[msg.data.from]=peer;				
			}


			if(msg.eventType == "custom/myVTT/okletmeseeyourdice"){
				if( !window.JOINTHEDICESTREAM)
					return;
				if( (!window.MYSTREAMID)  || (msg.data.to!= window.MYSTREAMID) )
					return;
				const configuration = {
    				iceServers:  [{urls: "stun:stun.l.google.com:19302"}]
  				};
				var peer= new RTCPeerConnection(configuration);

				if(window.MYMEDIASTREAM){
					var stream=  window.MYMEDIASTREAM;
					stream.getTracks().forEach(track => peer.addTrack(track, stream));
				}

				peer.addEventListener('track', (event) => {
					console.log("aggiungo video!!!!");
				  addVideo(event.streams[0],msg.data.from);
				});
				window.makingOffer = [];
				window.makingOffer[msg.data.from] = false;
				peer.onnegotiationneeded = () => {
					try {
						window.makingOffer[msg.data.from] = true;
						peer.createOffer({offerToReceiveVideo: 1}).then( (desc) => {
							console.log("fatto setLocalDescription");
							peer.setLocalDescription(desc);
							self.sendMessage("custom/myVTT/okletmeseeyourdice",{
								to: msg.data.from,
								from: window.MYSTREAMID,
								offer: desc,
								dm: window.DM
							})
						});
					} catch(err) {
						console.error(err);
					} finally {
						setTimeout(function(){
							window.makingOffer[msg.data.from] = false;
						}, 500)		    
					}	
				};
				peer.onconnectionstatechange=() => {
					if(peer.connectionState=="connected"){
						window.MB.inject_chat({
                player: window.PLAYER_NAME,
                img: window.PLAYER_IMG,
                text: `<span class="flex-wrap-center-chat-message"><p>A dice stream peer has ${peer.connectionState}. <br/><br/></div>`,
                whisper: window.PLAYER_NAME,
	          });
					}
					if((peer.connectionState=="closed") || (peer.connectionState=="failed" || peer.connectionState == "disconnected")){
						peer.restartIce();
						window.MB.inject_chat({
                player: window.PLAYER_NAME,
                img: window.PLAYER_IMG,
                text: `<span class="flex-wrap-center-chat-message"><p>A dice stream connection has ${peer.connectionState}.</p><p> An automatic reconnect is being attempted. </p><p>If you are still unable to see one or more of your groups dice you may have to manually disable then reenable your dice stream in the chat above.</p><br/><br/></div>`,
                whisper: window.PLAYER_NAME,
	          });
					}
				};
		
				peer.onicecandidate = e => {
					window.MB.sendMessage("custom/myVTT/iceforyourgintonic",{
						to: msg.data.from,
						from: window.MYSTREAMID,
						ice: e.candidate
					})
				};				
				window.STREAMPEERS[msg.data.from]=peer;	
				let ignoreOffer = false;
				if(msg.data.offer){
					const offerCollision = (msg.data.offer.type == "offer") && (window.makingOffer[msg.data.from] || window.STREAMPEERS[msg.data.from].signalingState != "stable")
				  let myStreamParse = parseInt(window.MYSTREAMID) || 0;
				  let fromStreamParse = parseInt(msg.data.from) || 0;
				  ignoreOffer = (((myStreamParse > fromStreamParse) && !msg.data.dm) || window.DM) && offerCollision
				  if (ignoreOffer) {
				    return;
				  }
				}		
				peer = window.STREAMPEERS[msg.data.from];
				peer.setRemoteDescription(msg.data.offer);
				console.log("fatto setRemoteDescription");
				window.STREAMPEERS[msg.data.from] = peer;	
	
		
				peer.createAnswer().then( (desc) => {
				peer.setLocalDescription(desc);
				console.log("fatto setLocalDescription");
					
				window.MB.sendMessage("custom/myVTT/okseethem",{
						from: window.MYSTREAMID,
						to: msg.data.from,
						answer: desc
					});
			});
				
				window.STREAMPEERS[msg.data.from] = peer;					
			}



			if(msg.eventType == "custom/myVTT/okseethem"){
				if( !window.JOINTHEDICESTREAM)
					return;
				if( (!window.MYSTREAMID)  || (msg.data.to!= window.MYSTREAMID) )
					return;

				var peer=window.STREAMPEERS[msg.data.from];
				peer.setRemoteDescription(msg.data.answer);
				console.log("fatto setRemoteDescription");
			}
			
			if (msg.eventType == "dice/roll/fulfilled") {
				notify_gamelog();
				if (msg.avttExpression !== undefined && msg.avttExpressionResult !== undefined) {
					let gamelogItem = $("ol.tss-jmihpx-GameLogEntries li").first();
					gamelogItem.attr("data-avtt-expression", msg.avttExpression);
					gamelogItem.attr("data-avtt-expression-result", msg.avttExpressionResult);
					replace_gamelog_message_expressions(gamelogItem);
				}
				if (!window.DM)
					return;
				
				// CHECK FOR INIT ROLLS (auto add to combat tracker)
				if (msg.data.action == "Initiative") {
					console.log(msg.data);
					var total = msg.data.rolls[0].result.total;
					let entityid = msg.data.context.entityId;
					console.log("cerco " + entityid);
					
					$("#tokens .VTTToken").each(
						function(){
							var converted = $(this).attr('data-id').replace(/^.*\/([0-9]*)$/, "$1"); // profiles/ciccio/1234 -> 1234
							if(converted==entityid){
								ct_add_token(window.TOKEN_OBJECTS[$(this).attr('data-id')]);
								window.TOKEN_OBJECTS[$(this).attr('data-id')].options.init = total;
								window.TOKEN_OBJECTS[$(this).attr('data-id')].update_and_sync();
							}
						}
					);
					

					$("#combat_area tr").each(function() {
						var converted = $(this).attr('data-target').replace(/^.*\/([0-9]*)$/, "$1"); // profiles/ciccio/1234 -> 1234
						console.log(converted);
						if (converted == entityid) {
							$(this).find(".init").val(total);
							window.TOKEN_OBJECTS[$(this).attr('data-target')].options.init = total;
							window.TOKEN_OBJECTS[$(this).attr('data-target')].update_and_sync();
						}
					});
					setTimeout(ct_reorder(), 500);
				}
				// CHECK FOR SELF ROLLS ADD SEND TO EVERYONE BUTTON
				if (msg.messageScope === "userId") {
					let gamelogItem = $("ol.tss-jmihpx-GameLogEntries li").first();
					if (gamelogItem.find(".gamelog-to-everyone-button").length === 0) {
						const sendToEveryone = $(`<button class="gamelog-to-everyone-button">Send To Everyone</button>`);
						sendToEveryone.click(function (clickEvent) {
							let resendMessage = msg;
							resendMessage.id = uuid();
							resendMessage.data.rollId = uuid();
							resendMessage.messageScope = "gameId";
							resendMessage.messageTarget = find_game_id();
							resendMessage.dateTime = Date.now();
							window.diceRoller.ddbDispatch(resendMessage);
						});
						gamelogItem.find("time").before(sendToEveryone);
					 }
				}
			}

			if (msg.eventType === "custom/myVTT/peerReady") {
				window.PeerManager.receivedPeerReady(msg);
			}
			if (msg.eventType === "custom/myVTT/peerConnect") {
				window.PeerManager.receivedPeerConnect(msg);
			}

		};

		get_cobalt_token(function(token) {
			self.loadWS(token);
		});

		self.loadAboveWS();

		setInterval(function() {
			self.sendPing();
			self.sendAbovePing();
		}, 480000);

		// Ensure we have an initial delay (15 seconds) before attempting re-connects to let everything load (every 4 seconds)
		setTimeout(setInterval(function() {
			   	forceDdbWsReconnect();
		}, 4000), 15000);
	}

  handleCT(data){
  	$("#combat_area").empty();
		ct_load(data);
	}

	handlePlayerData(data) {
		if (!window.DM)
			return;

		window.PLAYER_STATS[data.id] = data;
		this.sendTokenUpdateFromPlayerData(data);

		// update combat tracker:

		update_pclist();
		send_player_data_to_all_peers(data);
	}

	acToPlayerData(data) {
		if (!window.DM)
			return;
		for(id in window.TOKEN_OBJECTS){
			if(id.endsWith(data.id)){
				window.TOKEN_OBJECTS[id].options.ac = data.ac;
				window.TOKEN_OBJECTS[id].place();
				window.TOKEN_OBJECTS[id].update_and_sync();
				if(id in window.PLAYER_STATS) {
					window.PLAYER_STATS[id].ac = data.ac;
					send_player_data_to_all_peers(window.PLAYER_STATS[id]);
				}
			}
		}	
	}
	
	sendTokenUpdateFromPlayerData(data) {
		console.group("sendTokenUpdateFromPlayerData")
		if (data.id in window.TOKEN_OBJECTS) {
			var cur = window.TOKEN_OBJECTS[data.id];

			// test for any change
			if ((cur.options.hp != (data.hp + (data.temp_hp ? data.temp_hp : 0))) ||
				(cur.options.max_hp != data.max_hp) ||
				(cur.options.ac != data.ac) ||
				(cur.options.temp_hp != data.temp_hp) ||
				(cur.options.inspiration != data.inspiration) ||
				(!areArraysEqualSets(cur.options.conditions, data.conditions)))
			{			
				if (typeof cur.options.hp != "undefined" && cur.options.hp > data.hp && cur.options.custom_conditions.includes("Concentration(Reminder)")) {
					var msgdata = {
						player: cur.options.name,
						img: cur.options.imgsrc,
						text: "<b>Check for concentration!!</b>",
					};

					// window.MB.inject_chat(msgdata);
				}
				cur.options.hp = +data.hp + (data.temp_hp ? +data.temp_hp : 0);


				cur.options.max_hp = data.max_hp;
				cur.options.ac = data.ac;
				cur.options.conditions = data.conditions;
				cur.options.inspiration = data.inspiration;
				cur.options.temp_hp = data.temp_hp;
				cur.place();
				window.MB.sendMessage('custom/myVTT/token', cur.options);
			}
		}
		console.groupEnd()
	}

	encode_message_text(text) {
		if (is_supported_version('0.66')) {
			// This is used when the "Send to Gamelog" button sends HTML over the websocket.
			// If there are special characters, then the _dndbeyond_message_broker_client fails to parse the JSON
			// To work around this, we base64 encode the html here, and then decode it in MessageBroker.convertChat
			return "base64" + b64EncodeUnicode(text);
		} else {
			console.warn("There's at least one connection below version 0.66; not encoding message text to prevent that user from seeing base64 encoded text in the gamelog");
			return text;
		}
	}
	
	decode_message_text(text) {
		// no need to check version because the `startsWith("base64")` will return `false` if there are any connections below 0.65. See `encode_message_text` for more details.
		if (text !== undefined && text.startsWith("base64")) {
			// This is used when the "Send to Gamelog" button sends HTML over the websocket.
			// If there are special characters, then the _dndbeyond_message_broker_client fails to parse the JSON
			// To work around this, we base64 encode the html in encode_message_text, and then decode it here after the message has been received
			text = b64DecodeUnicode(text.replace("base64", ""));
		}
		return text;
	}
	
	convertChat(data,local=false) {

		data.text = this.decode_message_text(data.text);

		//Security logic to prevent content being sent which can execute JavaScript.
		data.player = DOMPurify.sanitize( data.player,{ALLOWED_TAGS: []});
		data.img = DOMPurify.sanitize( data.img,{ALLOWED_TAGS: []});
		data.text = DOMPurify.sanitize( data.text,{ALLOWED_TAGS: ['img','div','p', 'b', 'button', 'span', 'style', 'path', 'svg', 'a'], ADD_ATTR: ['target']}); //This array needs to include all HTML elements the extension sends via chat.

		if(data.dmonly && !(window.DM) && !local) // /dmroll only for DM of or the user who initiated it
			return $("<div/>");
				
		if(data.whisper && (data.whisper!=window.PLAYER_NAME) && (!local))
			return $("<div/>");
		//notify_gamelog();

		var d = new Date();
		var datetime = d.toISOString();
		var timestamp = d.toLocaleTimeString();
		var datestamp = d.toLocaleDateString();
		
		if (is_encounters_page() || is_characters_page()) {
			return $(`
				<li class="tss-8-Other-ref tss-17y30t1-GameLogEntry-Other-Flex">
					<p role="img" class="tss-wyeh8h-Avatar-Flex">
						<img class="tss-1e4a2a1-AvatarPortrait" src="${data.img}" alt="">
					</p>
					<div class="tss-1e6zv06-MessageContainer-Flex">
						<div class="tss-dr2its-Line-Flex">
							<span class="tss-1tj70tb-Sender">${data.player}</span>
						</div>
						<div class="tss-8-Collapsed-ref tss-8-Other-ref tss-11w0h4e-Message-Collapsed-Other-Flex">${data.text}</div>
						<time datetime="${datetime}" title="${datestamp} ${timestamp}" class="tss-1yxh2yy-TimeAgo-TimeAgo">${timestamp}</time>
					</div>
				</li>
			`);
		} /*else if (is_characters_page()) {
			return $(`
				<li class="cwBGi-s80YSXZFf9zFTAGg== wtVS4Bjey6LwdMo1GyKvpQ== QXDbdjnpeXLRB22KlOxDsA== _42x6X+dUmW-21eOxSO1c7Q== _9ORHCNDFVTb1uWMCEaGDYg==">
					<p role="img" class="TILdlgSwOYvXr2yBdjxU7A== QXDbdjnpeXLRB22KlOxDsA==">
						<img class="U5icMJo74qXY3K0pjow8zA==" src="${data.img}" alt="">
					</p>
					<div class="pw06vls7GmA2pPxoGyDytQ== QXDbdjnpeXLRB22KlOxDsA== VwlMdrxdj-7VFbj4bhgJCg== bDu7knPli3v29ahk5PQFIQ==">
						<div class="zmFwkmlgaKJ3kVU14zW8Lg== QXDbdjnpeXLRB22KlOxDsA== CoBE7nCohYcFyEBBP3K93A==">
							<span class="_22SVeI3ayk2KgS4V+GqCCA==">${data.player}</span>
						</div>
						<div class="oDA6c7IdLEVJ7uSe5103CQ== iQqUeZkD8989e4pBhSqIrQ== wtVS4Bjey6LwdMo1GyKvpQ== QXDbdjnpeXLRB22KlOxDsA==">${data.text}</div>
						<time datetime="${datetime}" title="${datestamp} ${timestamp}" class="VL1LOQfDhMHRvAGyWG2vGg== _1-XSkDcxqHW18wFo5qzQzA==">${timestamp}</time>
					</div>
				</li>
			`);
		}*/

		var newentry = $("<div/>");
		newentry.attr('class', 'GameLogEntry_GameLogEntry__2EMUj GameLogEntry_Other__1rv5g Flex_Flex__3cwBI Flex_Flex__alignItems-flex-end__bJZS_ Flex_Flex__justifyContent-flex-start__378sw');
		newentry.append($("<p role='img' class='Avatar_Avatar__131Mw Flex_Flex__3cwBI'><img class='Avatar_AvatarPortrait__3cq6B' src='" + data.img + "'></p>"));
		var container = $("<div class='GameLogEntry_MessageContainer__RhcYB Flex_Flex__3cwBI Flex_Flex__alignItems-flex-start__HK9_w Flex_Flex__flexDirection-column__sAcwk'></div>");
		container.append($("<div class='GameLogEntry_Line__3fzjk Flex_Flex__3cwBI Flex_Flex__justifyContent-space-between__1FcfJ'><span>" + data.player + "</span></div>"));
		var entry = $("<div class='GameLogEntry_Message__1J8lC GameLogEntry_Collapsed__1_krc GameLogEntry_Other__1rv5g Flex_Flex__3cwBI'>" + data.text + "</div>");
		container.append(entry);

		container.append($("<time datetime='" + datetime + "' class='GameLogEntry_TimeAgo__zZTLH TimeAgo_TimeAgo__2M8fr'></time"));

		newentry.append(container);
		
		if ($(".GameLog_GameLog__2z_HZ").scrollTop() < 0) {
			$(".GameLog_GameLog__2z_HZ").addClass("highlight-gamelog");
		}

		return newentry;
		
	}


	handleToken(msg) {
		var data = msg.data;
		let playerTokenId = $(`.token[data-id*='${window.PLAYER_ID}']`).attr("data-id");
		let auraislightchanged = false;
		if(data.id == undefined)
			return;

		if (msg.sceneId != window.CURRENT_SCENE_DATA.id || msg.loading) {
			let gridSquares = parseFloat(data.gridSquares);
			if (!isNaN(gridSquares)) {
				data.size = window.CURRENT_SCENE_DATA.hpps * gridSquares;
			} else {
				data.size = window.CURRENT_SCENE_DATA.hpps;
			}
			if (window.all_token_objects != undefined) {
				if (data.id in window.all_token_objects) {
					for (var property in window.all_token_objects[data.id].options) {		
						if(property == "left" || property == "top" || property == "hidden")
							continue;
						if(msg.loading){
							data[property] = window.all_token_objects[data.id].options[property];
						}
						else if(property in data){
						 window.all_token_objects[data.id].options[property] = data[property]; 
						}
					}


					if (!data.hidden)
						delete window.all_token_objects[data.id].options.hidden;
				}
			}
		}
			
		if (data.id in window.TOKEN_OBJECTS) {
			if(data.id == playerTokenId && window.TOKEN_OBJECTS[data.id].options.auraislight != data.auraislight){
				auraislightchanged = true;
			}
			for (var property in data) {
				if(msg.sceneId != window.CURRENT_SCENE_DATA.id && (property == "left" || property == "top" || property == "hidden"))
					continue;				
				window.TOKEN_OBJECTS[data.id].options[property] = data[property];
			}
			if(data.ct_show == undefined){
				delete window.TOKEN_OBJECTS[data.id].options.ct_show;
			}
			if (!data.hidden && msg.sceneId == window.CURRENT_SCENE_DATA.id)
				delete window.TOKEN_OBJECTS[data.id].options.hidden;

			window.TOKEN_OBJECTS[data.id].place();

			if(window.DM && msg.loading){
				window.TOKEN_OBJECTS[data.id].update_and_sync();
			}
			
			if(playerTokenId != undefined && data.auraislight){
				if(window.TOKEN_OBJECTS[playerTokenId].options.auraislight){
						check_token_visibility();
				}
				else{
					check_single_token_visibility(data.id);
				}	
			}
			else{
				if(auraislightchanged){
					check_token_visibility();
				}
				else{
					check_single_token_visibility(data.id);
				}

			}// CHECK FOG OF WAR VISIBILITY OF TOKEN
		}	
		else if(data.left){
			// SOLO PLAYER. PUNTO UNICO DI CREAZIONE DEI TOKEN
			
			if (window.DM) {
				console.log("ATTENZIONEEEEEEEEEEEEEEEEEEE ATTENZIONEEEEEEEEEEEEEEEEEEE");
			}
			let t = new Token(data);
			window.TOKEN_OBJECTS[data.id] = t;
			t.sync = function(e) { // VA IN FUNZIONE SOLO SE IL TOKEN NON ESISTE GIA					
				window.MB.sendMessage('custom/myVTT/token', t.options);
			};
			t.place();

			let playerTokenId = $(`.token[data-id*='${window.PLAYER_ID}']`).attr("data-id");
			if(playerTokenId != undefined && data.auraislight){
				if(window.TOKEN_OBJECTS[playerTokenId].options.auraislight){
						check_token_visibility()
				}
				else{
					check_single_token_visibility(data.id);
				}	
			}
			else{
				check_single_token_visibility(data.id);
			}
		}


	if (window.DM) {
		console.log("**** persistoooooooooo token");
		window.ScenesHandler.persist();
	}
}

	handleScene(msg) {
		// console.group("handlescene")
		if (window.DM && ! (window.CLOUD) ) {
			alert('WARNING!!!!!!!!!!!!! ANOTHER USER JOINED AS DM!!!! ONLY ONE USER SHOULD JOIN AS DM. EXITING NOW!!!');
			location.reload();
		}

		// DISABLED THANKS TO POLLING
		/*if ((!window.DM) && (typeof window.PLAYERDATA !== "undefined")) {
			window.MB.sendMessage('custom/myVTT/playerdata', window.PLAYERDATA);
		}*/

		window.TOKEN_OBJECTS = {};
		let data = msg.data;
		let self=this;

		if(window.CLOUD){
			if(data.dm_map_usable=="1"){ // IN THE CLOUD WE DON'T RECEIVE WIDTH AND HEIGT. ALWAYS LOAD THE DM_MAP FIRST, AS TO GET THE PROPER WIDTH
				data.map=data.dm_map;
				if(data.dm_map_is_video=="1")
					data.is_video=true;
			}
			else{
				data.map=data.player_map;
				if(data.player_map_is_video=="1")
					data.is_video=true;
			}
		}

		for(i in msg.data.tokens){
			if(i == msg.data.tokens[i].id)
				continue;
			msg.data.tokens[msg.data.tokens[i].id] = msg.data.tokens[i];
			delete msg.data.tokens[i];
		}
		msg.data.tokens = Object.fromEntries(Object.entries(msg.data.tokens).filter(([_, v]) => v != null));
		window.CURRENT_SCENE_DATA = msg.data;
		if(window.CLOUD && window.DM){
			window.ScenesHandler.scene=window.CURRENT_SCENE_DATA;
		}
		window.CURRENT_SCENE_DATA.vpps=parseFloat(window.CURRENT_SCENE_DATA.vpps);
		window.CURRENT_SCENE_DATA.hpps=parseFloat(window.CURRENT_SCENE_DATA.hpps);
		window.CURRENT_SCENE_DATA.offsetx=parseFloat(window.CURRENT_SCENE_DATA.offsetx);
		window.CURRENT_SCENE_DATA.offsety=parseFloat(window.CURRENT_SCENE_DATA.offsety);
		console.log("SETTO BACKGROUND A " + msg.data);
		$("#tokens").children().remove();
		$(".aura-element[id^='aura_'").remove();

		var old_src = $("#scene_map").attr('src');
		$("#scene_map").attr('src', data.map);

		load_scenemap(data.map, data.is_video, data.width, data.height, function() {
			console.group("load_scenemap callback")
			if(!window.CURRENT_SCENE_DATA.scale_factor)
				window.CURRENT_SCENE_DATA.scale_factor = 1;
			const scaleFactor = window.CURRENT_SCENE_DATA.scale_factor;
			// Store current scene width and height
			window.CURRENT_SCENE_DATA.width = $("#scene_map").width();
			window.CURRENT_SCENE_DATA.height = $("#scene_map").height();
			// Scale map according to scaleFactor

			$("#scene_map").width(window.CURRENT_SCENE_DATA.width);
			$("#scene_map").height(window.CURRENT_SCENE_DATA.height);
			$("#VTT").css("--scene-scale", scaleFactor)
			

			reset_canvas();
			redraw_fog();
			redraw_drawings();
			apply_zoom_from_storage();
			redraw_text();

   	 	let darknessPercent = 100 - parseInt(window.CURRENT_SCENE_DATA.darkness_filter);
   	 	if(window.DM && darknessPercent < 25){
   	 		darknessPercent = 25;
   	 	}
   	 	$('#VTT').css('--darkness-filter', darknessPercent + "%");


			set_default_vttwrapper_size()
			
			// WE USED THE DM MAP TO GET RIGH WIDTH/HEIGHT. NOW WE REVERT TO THE PLAYER MAP
			if(window.CLOUD && !window.DM && data.dm_map_usable=="1"){
				$("#scene_map").stop();
				$("#scene_map").css("opacity","0");
				console.log("switching back to player map");
				$("#scene_map").off("load");
				$("#scene_map").on("load", () => {
					$("#scene_map").css('opacity', 1)
					$("#darkness_layer").show();
				});
				$("#scene_map").attr("src",data.player_map);		
			}
			console.log("LOADING TOKENS!");

			for (let id in data.tokens) {
				self.handleToken({
					data: data.tokens[id],
					loading: true,
					persist: false
				});
			}
			if(!window.DM)
					check_token_visibility();
	
			if(window.CLOUD){
				let data = {
					loading: true,
					current: $("#combat_area [data-current]").attr('data-target')
				}
				$("#combat_area").empty();
				ct_load(data);
			}


			if(window.DM)
				get_pclist_player_data();
			else{
			 	window.MB.sendMessage('custom/myVTT/syncmeup');
			}


			if (window.EncounterHandler !== undefined) {
				fetch_and_cache_scene_monster_items();
			}
			did_update_scenes();
			if (window.reorderState === ItemType.Scene) {
				enable_draggable_change_folder(ItemType.Scene);
			}
			console.groupEnd()
			
		});


		if (data.fog_of_war == 1) {
			window.FOG_OF_WAR = true;
			window.REVEALED = data.reveals;
			reset_canvas();
			redraw_fog();
			//$("#fog_overlay").show();
		}
		else {
			window.FOG_OF_WAR = false;
			window.REVEALED = [];
			reset_canvas();
			//$("#fog_overlay").hide();
		}
		if (typeof data.drawings !== "undefined") {
			window.DRAWINGS = data.drawings;
		}
		else {
			window.DRAWINGS = [];
		}



		
		
		// console.groupEnd()
	}

	handleSyncMeUp(msg) {
		if (DM) {
			window.ScenesHandler.sync();
			ct_persist(); // force refresh of combat tracker for late users
			if (window.CURRENT_SOUNDPAD) {
				let audioPlaying;
				for(i in $("audio")){
			    if($("audio")[i].paused == false){
			    		audioPlaying = true;
			        break;
			    }
				}
				var data = {
					soundpad: window.CURRENT_SOUNDPAD,
					playing: audioPlaying
				}
				window.MB.sendMessage("custom/myVTT/soundpad", data); // refresh soundpad
			}
			// also sync the journal
			window.JOURNAL.sync();
			window.MB.sendMessage("custom/myVTT/pausePlayer",{
				paused: $('#pause_players').hasClass('paused')
			});
		}
	}

	handleAudioPlayingSync(msg){
		if(window.DM){
			for(i in $("audio")){
		    if($("audio")[i].paused == false){
		    	var data={
						channel: i,
						time: $("audio")[i].currentTime,
						volume: $("audio")[i].volume,
					}
					window.MB.sendMessage("custom/myVTT/playchannel",data);
		    }
			}
		}
	}

	handleCharacterUpdate(msg){
		let characterId=msg.data.characterId;

		window.pcs.forEach(function(pc){
			if(!pc.sheet.endsWith(characterId)) // we only poll for the characterId that sent this message
				return;

			getPlayerData(pc.sheet, function (playerData) {
				window.PLAYER_STATS[playerData.id] = playerData;
				window.MB.sendTokenUpdateFromPlayerData(playerData);
				update_pclist();
				send_player_data_to_all_peers(playerData);
			});
		});
		
	}
	
	inject_chat(injected_data) {
		var msgid = this.chat_id + this.chat_counter++;

		var data = {
			player_name: window.PLAYER_NAME,
			injected_data: injected_data,
			"action": "ABOVETT",
			"rolls": [
				{
					"diceNotation": {
						"set": [
						],
						"constant": 0
					},
					"diceNotationStr": "1d4",
					"rollType": msgid,
					"rollKind": "",
				}
			],
			"context": {
				"entityId": this.userid,
				"entityType": "user",
				"messageScope": "gameId",
				"messageTarget": this.gameid
			},
			"setId": "01201",
			"rollId": uuid(),
		};
		var eventType = "dice/roll/pending";
		var message = {
			id: uuid(),
			source: "web",
			gameId: this.gameid,
			userId: this.userid,
			persist: false, // INTERESSANTE PER RILEGGERLI, per ora non facciamogli casini
			messageScope: "gameId",
			messageTarget: this.gameid,
			eventType: eventType,
			data: data,
			entityId: this.userid, //proviamo a non metterla
			entityType: "user", // MOLTO INTERESSANTE. PENSO VENGA USATO PER CAPIRE CHE IMMAGINE METTERCI.
		};

		if (this.ws.readyState == this.ws.OPEN) {
			this.ws.send(JSON.stringify(message));
		}

		this.handle_injected_data(message);

	}


	sendMessage(eventType, data,skipSceneId=false) {
		var self = this;

		//this.sendDDBMB(eventType,data); 

		if(eventType.startsWith("custom")){
			this.sendAboveMB(eventType,data,skipSceneId);
		}
		else{
			this.sendDDBMB(eventType,data);
		}
	}

	sendAboveMB(eventType,data,skipSceneId=false){
		var self=this;
		var message = {
			action: "sendmessage",
			campaignId:window.CAMPAIGN_SECRET,
			eventType: eventType,
			sender: this.mysenderid,
			data: data,
		}

		if(window.CLOUD)
			message.cloud=1;

		if(!["custom/myVTT/switch_scene","custom/myVTT/update_scene"].includes(eventType))
			message.sequence=this.above_sequence++;

		if(window.CURRENT_SCENE_DATA && !skipSceneId)
			message.sceneId=window.CURRENT_SCENE_DATA.id;
		if(window.PLAYER_SCENE_ID)
			message.playersSceneId = window.PLAYER_SCENE_ID;

		const jsmessage=JSON.stringify(message);
		if(jsmessage.length > (128000)){
			alert("YOU REACHED THE MAXIMUM MESSAGE SIZE. PROBABLY SOMETHING IS WRONG WITH YOUR SCENE. You may have some tokens with embedded images that takes up too much space. Please delete them and refresh the scene");
			return;
		}

		if (this.abovews.readyState == this.ws.OPEN) {
			this.abovews.send(JSON.stringify(message));
		}
		else {
			self.loadAboveWS(function() {
				self.abovews.send(JSON.stringify(message));
			});
		}
	}

	sendDDBMB(eventType,data){
		var self=this;
		var message = {
			id: uuid(),
			//datetime: Date.now(),
			source: "web",
			gameId: this.gameid,
			userId: this.userid,
			persist: false, // INTERESSANTE PER RILEGGERLI, per ora non facciamogli casini
			messageScope: "gameId",
			messageTarget: this.gameid,
			eventType: eventType,
			data: data,
			// entityId :"43263440", proviamo a non metterla
			// entityType:"character", // MOLTO INTERESSANTE. PENSO VENGA USATO PER CAPIRE CHE IMMAGINE METTERCI.
		};

		if (this.ws.readyState == this.ws.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
		else { // TRY TO RECOVER
			get_cobalt_token(function(token) {
				self.loadWS(token, function() {
					// TODO, CONSIDER ADDING A SYNCMEUP / SCENE PAIR HERE
					self.ws.send(JSON.stringify(message));
				});
			});
		}
	}

	sendPing() {
		self = this;
		if (this.ws.readyState == this.ws.OPEN) {
			this.ws.send("{\"data\": \"ping\"}");
		}
		else {
			get_cobalt_token(function(token) {
				self.loadWS(token, null);
			});
		}
	}

	sendAbovePing(){
		self = this;
		if(this.abovews.readyState == this.abovews.OPEN){
			this.abovews.send(JSON.stringify({action:"keepalive",eventType:"custom/myVTT/keepalive"}));
		}
		else{
			self.loadAboveWS(null);
		}
	}
}

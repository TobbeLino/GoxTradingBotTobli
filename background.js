const MaxSamplesToKeep = 144;

var ApiKey = localStorage.ApiKey || '';
var ApiSec = localStorage.ApiSec || '';

var tradingEnabled = (localStorage.tradingEnabled || 1);

var tradingIntervalMinutes = parseInt(localStorage.tradingIntervalMinutes || 60);
var tickCount = localStorage.tickCount || 1;
var LogLines = parseInt(localStorage.LogLines || 12);
var EmaShortPar = parseInt(localStorage.EmaShortPar || 10);
var EmaLongPar = parseInt(localStorage.EmaLongPar || 21);
//var MaxMinutesBack = parseInt(localStorage.MaxMinutesBack || (MaxSamplesToKeep*tradingIntervalMinutes));
var MinBuyThreshold = parseFloat(localStorage.MinBuyThreshold || 0.25);
var MinSellThreshold = parseFloat(localStorage.MinSellThreshold || 0.25);
var currency = localStorage.currency || 'USD'; 							// Fiat currency to trade with
var keepBTC = parseFloat(localStorage.keepBTC || 0.0); 			// this amount in BTC will be untouched by trade - bot will play with the rest
//var keepFiat = parseFloat(localStorage.keepFiat || 0.0); 	// this amount in Fiat currency will be untouched by trade - bot will play with the rest

var BTC = Number.NaN;
var fiat = Number.NaN;

var utimer=null;
var bootstrap = 1; // progress bar for loading initial H1 data from mtgox

var H1 = []; // the H1 data
var tim = [];
var emaLong = [];
var emaShort = [];

var popupRefresh=null;
var popupUpdateCounter=null;
var updateinprogress=false;

function padit(d) {return d<10 ? '0'+d.toString() : d.toString()}

function updateEMA(ema, N) {
	var pr, k = 2 / (N+1);
	while (ema.length < H1.length) {
		if (ema.length==0) { 
			ema.push(H1[0]);
		} else {
			ema.push(H1[ema.length]*k+ema[ema.length-1]*(1-k));
		}
	}
}

function schedupdate(t) {
	if (utimer) clearTimeout();
	utimer = setTimeout(update,t);
}

function update() {
	mtgoxpost("info.php", [],
		function(e) {
			console.log("info error", e);
			chrome.browserAction.setTitle({title: "Error executing info" });
			schedupdate(10*1000); // retry after 10 seconds
		},
		function(d) {
			//console.log("info.php", d.currentTarget.responseText)
			BTC = Number.NaN;
			fiat = Number.NaN;
			try {
				var rr = JSON.parse(d.currentTarget.responseText);
				if (typeof(rr.Wallets[currency].Balance.value)=="undefined") {
					chrome.browserAction.setTitle({title: rr.error });
				} else {
					BTC = parseFloat(rr.Wallets.BTC.Balance.value);
					fiat = parseFloat(rr.Wallets[currency].Balance.value);
					chrome.browserAction.setTitle({title: (rr.Wallets.BTC.Balance.value + " BTC + " + rr.Wallets[currency].Balance.value + " " + currency)});
				}
			} catch (e) {
				console.log(e);
				chrome.browserAction.setTitle({title: e.toString()});
			}
			//schedupdate(15*60*1000) // Update balance every 15 minutes
			schedupdate(5*60*1000); // Update balance every 5 minutes (should be smaller than the trading interval?)
		}
	)
}

function signdata(data) {
	var shaObj = new jsSHA(data,"ASCII");
	var SecretKey = atob(ApiSec);
	var hmac = shaObj.getHMAC(SecretKey, "ASCII", "SHA-512", "B64");
	while (hmac.length%4) hmac+='='; // workaround for the B64 too short bug
	return hmac;
}

function mtgoxpost(page, params, ef, df) {
	var req = new XMLHttpRequest();
	req.open("POST", "https://mtgox.com/api/0/"+page, true);
	req.onerror = ef;
	req.onload = df;
	var data = "nonce="+((new Date()).getTime()*1000);
	for (var i in params)
		data+="&"+params[i];
	data = encodeURI(data);
	var hmac = signdata(data);
	req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
	req.setRequestHeader("Rest-Key", ApiKey);
	req.setRequestHeader("Rest-Sign", hmac);
	req.send(data);
}

function one(e) {
	console.log("ajax post error", e);
}

function onl(d) {
	console.log("ajax post ok", d);
	schedupdate(2500);
}

function dat2day(ms) {
	var t = new Date(ms);
	var y = t.getUTCFullYear().toString();
	var m = (t.getUTCMonth()+1).toString();
	var d = t.getUTCDate().toString();
	if (m.length<2)  m='0'+m;
	if (d.length<2)  d='0'+d;
	return y+"-"+m+"-"+d;
}

function get_url(req, url) {
	//console.log("get_url(): "+url);
	req.open("GET", url)
	//req.send(null);
	req.send();
}


function getemadif(idx) {
	var cel = emaLong[idx];
	var ces = emaShort[idx];
	return 100 * (ces-cel) / ((ces+cel)/2);
}


function refreshEMA(reset) {
	if (reset) {
		//console.log("refreshEMA(): reset EMA data (EMA/Thresholds/Interval has changed)");
		emaLong = [];
		emaShort = [];
	}

	if (H1.length == 0) {
		console.log("Error: H1 not loaded!");
	} else if (H1.length > MaxSamplesToKeep) {
		var skip = H1.length-MaxSamplesToKeep;
		H1 = H1.slice(skip);
		tim = tim.slice(skip);
		emaLong = emaLong.slice(skip);
		emaShort = emaShort.slice(skip);
	}

	updateEMA(emaLong, EmaLongPar);
	updateEMA(emaShort, EmaShortPar);

	var dif1 = getemadif(H1.length-1);
	var dif2 = getemadif(H1.length-2);
	var dif3 = getemadif(H1.length-3);
	
	var last_minute_fetch=tim[tim.length-1];
	var minute_now = parseInt((new Date()).getTime()/60000);
	if (last_minute_fetch<minute_now-tradingIntervalMinutes) {
		chrome.browserAction.setBadgeText({text: "?"});
		console.log("Last data not yet fetched - do not trade!");
		return;
	} else {
		chrome.browserAction.setBadgeText({text: Math.abs(dif1).toFixed(2)});
	}

	if (dif1>MinBuyThreshold) {
		chrome.browserAction.setBadgeBackgroundColor({color:[0, 128, 0, 200]});
		if (fiat>=0.01) {
		//if (fiat>=(Math.max(0.01,keepFiat))) {
			//var s = fiat - keepFiat;
			//if (getemadif(H1.length-2) > MinBuyThreshold) { //toli: not ready to change this yet...
			if ((tickCount==1) ||
					(tickCount==2 && (dif2>MinBuyThreshold)) ||
					(tickCount==3 && (dif2>MinBuyThreshold) && (dif3>MinBuyThreshold))) {
				if (tradingEnabled==1) {
					console.log("BUY! (EMA("+EmaShortPar+")/EMA("+EmaLongPar+")>"+MinBuyThreshold+"% for "+tickCount+" or more ticks)");
					mtgoxpost("buyBTC.php", ['Currency='+currency,'amount=1000'], one, onl);
				} else {
					console.log("Simulated BUY! (EMA("+EmaShortPar+")/EMA("+EmaLongPar+")>"+MinBuyThreshold+"% for "+tickCount+" or more ticks) - However, since trading is disabled, NO trade was actually made");
				}
			}
		} else {
			console.log("Trend is up, but no "+currency+" to spend...");
		}
	} else if (dif1<-MinSellThreshold) {
		chrome.browserAction.setBadgeBackgroundColor({color:[128, 0, 0, 200]});
		if (BTC>keepBTC) {
			var s = BTC - keepBTC;
			//if (getemadif(H1.length-2) < -MinSellThreshold) { //toli: not ready to change this yet...
			if ((tickCount==1) ||
					(tickCount==2 && (dif2<-MinSellThreshold)) ||
					(tickCount==3 && (dif2<-MinSellThreshold) && (dif3<-MinSellThreshold))) {
			
				if (tradingEnabled==1) {
					console.log("SELL! (EMA("+EmaShortPar+")/EMA("+EmaLongPar+")<-"+MinSellThreshold+"% for "+tickCount+" or more ticks)");
					mtgoxpost("sellBTC.php", ['Currency='+currency,'amount='+s.toString()], one, onl);
				} else {
					console.log("Simulated SELL! (EMA("+EmaShortPar+")/EMA("+EmaLongPar+")<-"+MinSellThreshold+"% for "+tickCount+" or more ticks) - However, since trading is disabled, NO trade was actually made");
				}
			}
		} else {
			console.log("Trend is down, but no BTC to sell...");
		}
	} else {
		if (dif1>0) {
			chrome.browserAction.setBadgeBackgroundColor({color:[10, 100, 10, 100]});
		} else {
			chrome.browserAction.setBadgeBackgroundColor({color:[100, 10, 10, 100]});
		}
	}
}

function updateH1() {
	updateH1(false);
}

function updateH1(reset) { // Added "reset" parameter to clear the H1 data - should be called after changing settings that affects tradingInterval...
	if (updateinprogress) {
		return;
	}
	if (isNaN(BTC) || isNaN(fiat)) {
		console.log("User info not fetched yet! Fetch and call updateH1() again in 2 seconds...");
		schedupdate(10);
		setTimeout(updateH1, 2*1000); 
		return;
	}
	updateinprogress = true;
	//console.log("updateinprogress = true");
	
	if (reset) {
		//console.log("updateH1(): reset H1 data (Interval has changed)");
		H1 = [];
		tim = [];
		emaLong = [];
		emaShort = [];		
		bootstrap = 1;
		chrome.browserAction.setBadgeBackgroundColor({color:[128, 128, 128, 50]});
	}

	//var hour_fetch
	var minute_fetch;
	//var hour_now = parseInt( (new Date()).getTime() / 3600000 )
	//var minute_now = parseInt( (new Date()).getTime() /   60000 );
	var minute_now = parseInt((new Date()).getTime() / (tradingIntervalMinutes*60*1000)) * tradingIntervalMinutes; // Fix trading samples to whole hours...
	
	if (tim.length>0) {
		minute_fetch = tim[tim.length-1] + tradingIntervalMinutes;
		if (minute_fetch > minute_now) {
			//console.log("Already have open price for the current interval")
			updateinprogress = false;
			//console.log("updateinprogress = false");
			return;
		}
	} else {
		minute_fetch = minute_now - (MaxSamplesToKeep*tradingIntervalMinutes);
	}

	var req = new XMLHttpRequest();

	//var url = "https://data.mtgox.com/api/0/data/getTrades.php?Currency="+currency+"&since="+(hour_fetch*3600*1000000).toString()
	var since=(minute_fetch*60*1000000).toString();
	var url = "https://data.mtgox.com/api/0/data/getTrades.php?Currency="+currency+"&since="+since;

	req.onerror = function(e) {
		console.log("getTrades error", e, "-repeat");
		get_url(req, url);
	}

	req.onload = function() {
		var refr = false;
		var done = true;
		try {
			//console.log(req.responseText)
			var trs = JSON.parse(req.responseText);
			//console.log(trs.length)
			if (trs.length > 0) {
				tim.push(minute_fetch);
				var f = parseFloat(trs[0].price);
				var f0 = H1[H1.length-1];
				if (((f/9)>=f0) || ((f*9)<=f0)) { // strange peaks elimination - just keep old val // toli: factor 9 is better than 10...
					f=f0;
				}
				H1.push(f);
				
				var trsDate=new Date(trs[0].date*1000);
				var trsTid=parseInt(trs[0].tid/60/1000000);
				var debugDate=padit(trsDate.getHours())+":"+padit(trsDate.getMinutes());		
				//console.log("updateH1() got sample: trs[0].price="+f+" trs[0].date="+debugDate+" trs[0].tid="+trsTid+" (own time: "+minute_fetch+")");
				
				//hour_fetch++
				minute_fetch=minute_fetch+tradingIntervalMinutes;
				if (minute_fetch <= minute_now) {
					//url = "https://data.mtgox.com/api/0/data/getTrades.php?Currency="+currency+"&since="+(hour_fetch*3600*1000000).toString()
					since=(minute_fetch*60*1000000).toString();
					url = "https://data.mtgox.com/api/0/data/getTrades.php?Currency="+currency+"&since="+since;
					
					get_url(req, url);
					done = false;
					if (bootstrap) {
						bootstrap++;
						chrome.browserAction.setBadgeText({text: ("       |        ").substr(bootstrap%9, 6)});
					}
				} else {
					console.log("Got some new samples", H1.length, MaxSamplesToKeep);
					refr = true;
					bootstrap = 0;
				}
			} else {
				//console.log("trs.length < 1  ("+trs.length+")");
			}
		} catch (e) {
			console.log("getTrades JSON error", e, req.responseText);
			chrome.browserAction.setBadgeText({text: "xxx"});
		}
		if (refr) refreshEMA(reset);
		if (done)  {
			updateinprogress = false;
			//console.log("updateinprogress = false");
		};
		if ((popupRefresh!=null)&&(refr)) {
				try {
					popupRefresh();
				} catch (e) {
					popupRefresh=null;
				}
		} else if (popupUpdateCounter!=null) {
			try {
				popupUpdateCounter();
			} catch (e) {
				popupUpdateCounter=null;
			}				
		}
	}
	get_url(req, url);
}

chrome.browserAction.setBadgeBackgroundColor({color:[128, 128, 128, 50]});
schedupdate(10);
//updateH1();
setTimeout(function(){updateH1(false);}, 2*1000); // toli: Delay first updateH1() to allow user info to be fetched first... 
//setInterval(updateH1, 3*60*1000) // recheck every 3 minutes
setInterval(function(){updateH1(false);}, 150*1000); // toli: recheck every 2.5 minutes (should be a multiple of any trading interval)

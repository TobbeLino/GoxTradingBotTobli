const MaxSamplesToKeep = 144;
const MaxTradingIntervalMinutes = 180;
const	MtGoxAPI2BaseURL = 'https://data.mtgox.com/api/2/';
const useAPIv2=false;

var ApiKey = localStorage.ApiKey || '';
var ApiSec = localStorage.ApiSec || '';

var tradingDisabledOnStart = (localStorage.tradingDisabledOnStart || 0);
var tradingEnabled = (tradingDisabledOnStart? 0 : (localStorage.tradingEnabled || 0));

var tradingIntervalMinutes = parseInt(localStorage.tradingIntervalMinutes || 60);
//var tickCount = localStorage.tickCount || 1;
var tickCountBuy = localStorage.tickCountBuy || localStorage.tickCount || 1;
var tickCountSell = localStorage.tickCountSell || localStorage.tickCount || 1;

var LogLines = parseInt(localStorage.LogLines || 72);
var EmaShortPar = parseInt(localStorage.EmaShortPar || 10);
var EmaLongPar = parseInt(localStorage.EmaLongPar || 21);
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
var abortUpdateAndRedo=false;

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

function schedUpdateInfo(t) {
	if (utimer) clearTimeout();
	utimer = setTimeout(updateInfo,t);
}

function updateInfo() {
	if (ApiKey=='') {
		// No API key. No use trying to fetch info...
		BTC = Number.NaN;
		fiat = Number.NaN;
		chrome.browserAction.setTitle({title: "Gox Trading Bot (Tobli)"});
		return;
	}

	var path;
	if (useAPIv2)
		path="BTC"+currency+"/money/info";
	else
		path="info.php";

	mtgoxpost(path, [],
		function(e) {
			console.log("info error", e);
			chrome.browserAction.setTitle({title: "Error getting user info. MtGox problem?"});
			schedUpdateInfo(10*1000); // retry after 10 seconds
		},
		function(d) {
			//console.log("info.php", d.currentTarget.responseText)
//			BTC = Number.NaN;
//			fiat = Number.NaN;
			try {
				var rr = JSON.parse(d.currentTarget.responseText);
				if (useAPIv2)
					rr=rr.data;

				if (typeof(rr.Wallets[currency].Balance.value)=="undefined") {
					log("Error fetching user info:"+ rr.error);
					chrome.browserAction.setTitle({title: "Error getting balance. MtGox problem?"});
				} else {
					BTC = parseFloat(rr.Wallets.BTC.Balance.value);
					fiat = parseFloat(rr.Wallets[currency].Balance.value);
					chrome.browserAction.setTitle({title: (BTC.toFixed(3) + " BTC + " + fiat.toFixed(2) + " " + currency)});
					refreshPopup(true);
				}
			} catch (e) {
				console.log(e);
				chrome.browserAction.setTitle({title: "Exception parsing user info. MtGox problem?"});
			}
			//schedUpdateInfo(15*60*1000) // Update balance every 15 minutes
			schedUpdateInfo(5*60*1000); // Update balance every 5 minutes (should be smaller than the trading interval?)
		}
	)
}

function hmac_512(message, secret) {
    var shaObj = new jsSHA(message, "TEXT");
    var hmac = shaObj.getHMAC(secret, "B64", "SHA-512", "B64");
    return hmac;
}

function mtgoxpost(path, params, ef, df) {
	var req = new XMLHttpRequest();
	req.open("POST", (useAPIv2 ? MtGoxAPI2BaseURL : "https://mtgox.com/api/0/")+path, true);
	req.onerror = ef;
	req.onload = df;
	var data = "nonce="+((new Date()).getTime()*1000);
	for (var i in params)
		data+="&"+params[i];
	data = encodeURI(data);
	var	hmac=hmac_512((useAPIv2?path+'\0'+data:data),ApiSec);
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
	schedUpdateInfo(2500);
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
	var dif4 = getemadif(H1.length-4);
	var dif5 = getemadif(H1.length-5);

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
			if ((tickCountBuy==1) ||
					(tickCountBuy==2 && (dif2>MinBuyThreshold)) ||
					(tickCountBuy==3 && (dif2>MinBuyThreshold) && (dif3>MinBuyThreshold)) ||
					(tickCountBuy==4 && (dif2>MinBuyThreshold) && (dif3>MinBuyThreshold) && (dif4>MinBuyThreshold)) ||
					(tickCountBuy==5 && (dif2>MinBuyThreshold) && (dif3>MinBuyThreshold) && (dif4>MinBuyThreshold) && (dif5>MinBuyThreshold))) {
				if ((tradingEnabled==1)&&(ApiKey!='')) {
					console.log("BUY! (EMA("+EmaShortPar+")/EMA("+EmaLongPar+")>"+MinBuyThreshold+"% for "+tickCountBuy+" or more ticks)");
					//mtgoxpost("buyBTC.php", ['Currency='+currency,'amount=1000'], one, onl);
					if (useAPIv2)
						mtgoxpost("BTC"+currency+"/money/order/add", ['type=bid','amount_int='+(1000*100000000).toString()], one, onl);
					else
						mtgoxpost("buyBTC.php", ['Currency='+currency,'amount=1000'], one, onl);
				} else {
					console.log("Simulated BUY! (EMA("+EmaShortPar+")/EMA("+EmaLongPar+")>"+MinBuyThreshold+"% for "+tickCountBuy+" or more ticks) - However, since trading is disabled, NO trade was actually made");
				}
			}
		} else {
			console.log("Trend is up, but no "+currency+" to spend...");
		}
	} else if (dif1<-MinSellThreshold) {
		chrome.browserAction.setBadgeBackgroundColor({color:[128, 0, 0, 200]});
		if (BTC>keepBTC) {
			var amount = BTC - keepBTC;
			//if (getemadif(H1.length-2) < -MinSellThreshold) { //toli: not ready to change this yet...
			if ((tickCountSell==1) ||
					(tickCountSell==2 && (dif2<-MinSellThreshold)) ||
					(tickCountSell==3 && (dif2<-MinSellThreshold) && (dif3<-MinSellThreshold)) ||
					(tickCountSell==4 && (dif2<-MinSellThreshold) && (dif3<-MinSellThreshold) && (dif4<-MinSellThreshold)) ||
					(tickCountSell==5 && (dif2<-MinSellThreshold) && (dif3<-MinSellThreshold) && (dif4<-MinSellThreshold) && (dif5<-MinSellThreshold))) {

				if ((tradingEnabled==1)&&(ApiKey!='')) {
					console.log("SELL! (EMA("+EmaShortPar+")/EMA("+EmaLongPar+")<-"+MinSellThreshold+"% for "+tickCountSell+" or more ticks)");
					if (useAPIv2)
						mtgoxpost("BTC"+currency+"/money/order/add", ['type=ask','amount_int='+Math.round(amount*100000000).toString()], one, onl);
					else
						mtgoxpost("sellBTC.php", ['Currency='+currency,'amount='+amount.toString()], one, onl);
				} else {
					console.log("Simulated SELL! (EMA("+EmaShortPar+")/EMA("+EmaLongPar+")<-"+MinSellThreshold+"% for "+tickCountSell+" or more ticks) - However, since trading is disabled, NO trade was actually made");
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

function log(s) {
	var t=new Date();
	console.log(dat2day(t.getTime())+" "+padit(t.getHours())+":"+padit(t.getMinutes())+":"+padit(t.getSeconds())+": "+s);
}

function getNextMinuteFetch() {
	if (tim.length>0) {
		return (tim[tim.length-1] + tradingIntervalMinutes);
	} else {
		var minute_now = parseInt((new Date()).getTime() / (tradingIntervalMinutes*60*1000)) * tradingIntervalMinutes; // Fix trading samples to whole hours...
		return (minute_now - (MaxSamplesToKeep*tradingIntervalMinutes));
	}
}

function cleanSampleCache() {
	// Clean old, cached items from local storage
	//log("cleanSampleCache()");
	var minute_first = parseInt((new Date()).getTime()/(60*1000)) - (MaxSamplesToKeep+1)*MaxTradingIntervalMinutes;
	for (var key in localStorage) {
		if (key.indexOf("sample.")==0) {
			var tid=parseInt(key.substring(7));
			if (tid<minute_first) {
				log("cleanSampleCache(): removing old cached item (key="+key+")");
				localStorage.removeItem(key);
			}
		}
	}
}

function addSample(minuteFetch,price) {
	tim.push(minuteFetch);
	var f = parseFloat(price);
	var f0 = H1[H1.length-1];
	if (((f/9)>=f0) || ((f*9)<=f0)) { // strange peaks elimination - just keep old val // toli: factor 9 is better than 10...
		f=f0;
	}
	H1.push(f);

	var sample=localStorage.getItem("sample."+minuteFetch);
	if ((!sample)||(sample=="null")) {
		// The trade does not exist in local storage - add it...
		localStorage.setItem("sample."+minuteFetch,price);
		//log("Added sample to local storage: sample."+minuteFetch+" = "+price);
	}
}

function getSampleFromMtGox(req,minute_fetch) {
	var since=(minute_fetch*60*1000000).toString();
	if (useAPIv2)
		get_url(req, MtGoxAPI2BaseURL+"BTC"+currency+"/money/trades/fetch?since="+since+"&nonce="+((new Date()).getTime()*1000));
	else
		get_url(req, "https://data.mtgox.com/api/0/data/getTrades.php?Currency="+currency+"&since="+since+"&nonce="+((new Date()).getTime()*1000));
}

function refreshPopup(fullRefresh) {
	if ((popupRefresh!=null)&&(fullRefresh)) {
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

function updateH1(reset) { // Added "reset" parameter to clear the H1 data - should be called after changing settings that affects tradingInterval...
	if (updateinprogress) {
		if (reset) {
			abortUpdateAndRedo=true;
			log("updateH1(): Reset while update in progress: abort current update");
		}
		return;
	}
//	if (ApiKey!='' && (isNaN(BTC) || isNaN(fiat))) {
//		log("updateH1(): User info not fetched yet! Retry in 5 seconds...");
		//schedUpdateInfo(10);
//		setTimeout(updateH1, 5*1000);
//		return;
//	}
	updateinprogress = true;

	if (reset) {
		//console.log("updateH1(): reset H1 data (Interval has changed)");
		H1 = [];
		tim = [];
		emaLong = [];
		emaShort = [];
		bootstrap = 1;
		chrome.browserAction.setBadgeBackgroundColor({color:[128, 128, 128, 50]});
		abortUpdateAndRedo=false;
	}

	var minute_now = parseInt((new Date()).getTime() / (tradingIntervalMinutes*60*1000)) * tradingIntervalMinutes; // Fix trading samples to whole hours...
	var minute_fetch=getNextMinuteFetch();
	var sample=localStorage.getItem("sample."+minute_fetch);
	if (minute_fetch > minute_now) {
		//log("Not yet time to fetch new samples...");
		updateinprogress = false;
		return;
	}
	
	while ((sample)&&(sample!="null")&&(minute_fetch <= minute_now)) {
		// As long as trades exist in in local storage: Just add them...
		//log("Adding sample from local storage: sample."+minute_fetch+" = "+localStorage.getItem("sample."+minute_fetch));
		addSample(minute_fetch,localStorage.getItem("sample."+minute_fetch));
		if (bootstrap) {
			chrome.browserAction.setBadgeText({text: ("       |        ").substr((bootstrap++)%9, 6)});
		}
		minute_fetch=getNextMinuteFetch();
		sample=localStorage.getItem("sample."+minute_fetch);
	}
	if (minute_fetch <= minute_now) {
		// We are not done, and a sample did not exist in local storage: We need to start fetching from MtGox...
		
		// But first remove old, cached trades from local storage...
		cleanSampleCache();

		req = new XMLHttpRequest();
		var url, since;

		//log("Fetching sample from MtGox: minute_fetch="+minute_fetch);

		req.onerror = function(e) {
			if (abortUpdateAndRedo) {
				updateinprogress=false;
				updateH1(true);
				return;
			}
			console.log("getTrades error", e, "-repeat");
			get_url(req, url);
		}

		req.onload = function() {
			if (abortUpdateAndRedo) {
				updateinprogress=false;
				updateH1(true);
				return;
			}

			var refr = false;
			var done = true;
			try {
				//log(req.responseText)
				var trs = JSON.parse(req.responseText);
				if (useAPIv2)
					trs=trs.data;

				if (trs.length > 0) {
					//log("Adding sample from MtGox: sample."+minute_fetch+" = "+trs[0].price);
					addSample(minute_fetch,trs[0].price);
				} else {
					//log("Empty sample chunk from MtGox - no trades since minute_fetch="+minute_fetch);
					if (parseInt((new Date()).getTime()/(60*1000)) - minute_fetch < 5) {
						// The trade we where trying to fetch is less than 5 minutes old
						// => Probably no trades where made since then, so stop retrying...
						// This will happen a lot with short sample interval on a calm market, so abort update to prevent hammering of MtGox
						//log("Aborting update (probably no trades have been made since minute_fetch)");
						updateinprogress=false;
						refreshPopup(true);
						return;
					}
				}

				minute_fetch=getNextMinuteFetch();
				sample=localStorage.getItem("sample."+minute_fetch);
				while ((sample)&&(sample!="null")&&(minute_fetch <= minute_now)) {
					// As long as trades exist in in local storage: Just add them...
					//log("Adding sample from local storage (2): sample."+minute_fetch+" = "+localStorage.getItem("sample."+minute_fetch));
					addSample(minute_fetch,localStorage.getItem("sample."+minute_fetch));
					if (bootstrap) {
						chrome.browserAction.setBadgeText({text: ("       |        ").substr((bootstrap++)%9, 6)});
					}
					minute_fetch=getNextMinuteFetch();
					sample=localStorage.getItem("sample."+minute_fetch);
				}
				if (minute_fetch <= minute_now) {
					// We are not done, but a sample did not exist in local storage: We need to fetch more samples from MtGox...
					getSampleFromMtGox(req,minute_fetch);
					done = false;
					if (bootstrap) {
						chrome.browserAction.setBadgeText({text: ("       |        ").substr((bootstrap++)%9, 6)});
					}
				} else {
					log("Got new samples from MtGox "+H1.length+" "+MaxSamplesToKeep);
					refr = true;
					bootstrap = 0;
				}
			} catch (e) {
				log("getTrades JSON error", e, req.responseText);
				chrome.browserAction.setBadgeText({text: "xxx"});
			}

			if (refr)
				refreshEMA(reset);
			if (done)
				updateinprogress = false;

			refreshPopup(refr);
		}
		getSampleFromMtGox(req,minute_fetch);
	} else {
		// Done, and all samples where loaded from local storage...
		log("Got new samples (all loaded from cache) "+H1.length+" "+MaxSamplesToKeep);
		refreshEMA(reset);
		updateinprogress = false;
		bootstrap = 0;
		refreshPopup(true);
	}
}

log("Using MtGox API v"+(useAPIv2?"2":"0"));
chrome.browserAction.setBadgeBackgroundColor({color:[128, 128, 128, 50]});
schedUpdateInfo(10);
setTimeout(function(){updateH1(false);}, 2*1000); 	// Delay first updateH1() to allow user info to be fetched first...
setInterval(function(){updateH1(false);}, 60*1000); // Recheck every minute (should be a multiple of any trading interval)

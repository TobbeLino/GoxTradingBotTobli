const MaxSamplesToKeep = 200; // Should be "visible sample" + preSamples below
const preSamples=56; // Use this number of samples from the MaxSamplesToKeep only for initial EMA-calculation (these samples will not show in the graph, but provides better buy/sell-indicator arrows early in the graph)
const validSampleIntervalMinutes=[1,5,10,15,30,45,60,120,180,240,300];
const showLastHours=[1,2,3,6,12,24,48,72,96,120,240,0];
const	MtGoxAPI2BaseURL = 'https://data.mtgox.com/api/2/';
const useAPIv2=true;

var ApiKey = localStorage.ApiKey || '';
var ApiSec = localStorage.ApiSec || '';

var tradingDisabledOnStart = (localStorage.tradingDisabledOnStart || 0);
var tradingEnabled = (tradingDisabledOnStart? 0 : (localStorage.tradingEnabled || 0));
if (tradingEnabled) {
	chrome.browserAction.setIcon({path: 'robot_trading_on.png'});
} else {
	chrome.browserAction.setIcon({path: 'robot_trading_off.png'});
}

// General settings
var tradingIntervalMinutes = parseInt(localStorage.tradingIntervalMinutes || 60);
var LogLines = parseInt(localStorage.LogLines || 0);
var currency = localStorage.currency || 'USD'; 							// Fiat currency to trade with
var keepBTC = parseFloat(localStorage.keepBTC || 0.0); 			// this amount in BTC will be untouched by trade - bot will play with the rest
var keepBTCUnitIsPercentage = 0;//(localStorage.keepBTCUnitIsPercentage || 0);  // Does not work, so don't uncomment...
//var keepFiat = parseFloat(localStorage.keepFiat || 0.0); 	// this amount in Fiat currency will be untouched by trade - bot will play with the rest - does not work, so don't uncomment...

// Parameteres for "EMA settings"
var EmaShortPar = parseInt(localStorage.EmaShortPar || 10);
var EmaLongPar = parseInt(localStorage.EmaLongPar || 21);
var MinBuyThreshold = parseFloat(localStorage.MinBuyThreshold || 0.25);
var MinSellThreshold = parseFloat(localStorage.MinSellThreshold || 0.25);
var tickCountBuy = localStorage.tickCountBuy || localStorage.tickCount || 1;
var tickCountSell = localStorage.tickCountSell || localStorage.tickCount || 1;

// Parameters for "Experimental settings"
var tradeOnlyAfterSwitch=(localStorage.tradeOnlyAfterSwitch || 0);
var inverseEMA=(localStorage.inverseEMA || 0);
/*
var simpleRulesMode=(localStorage.simpleRulesMode || 0);
var simple_buy_below=(localStorage.simple_sell_above || 0);
var simple_sell_above=(localStorage.simple_sell_above || 0);
*/

var BTC = Number.NaN;
var fiat = Number.NaN;

var utimer=null;
var bootstrap = 1; // progress bar for loading initial H1 data from mtgox

var H1 = []; // the H1 data
var tim = [];
var emaLong = [];
var emaShort = [];
var latestSolidTrend=0;

var popupRefresh=null;
var popupUpdateCounter=null;
var updateInProgress=false;
var lastUpdateStartTime=0;
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

var updateInfoTimer=null;
function schedUpdateInfo(t) {
	if (updateInfoTimer)
		clearTimeout(updateInfoTimer);
	updateInfoTimer = setTimeout(updateInfo,t);
}

function updateInfo() {
	updateInfoTimer=null;
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
			schedUpdateInfo(60*1000); // retry after 1 minute
		},
		function(d) {
			//console.log("info.php", d.currentTarget.responseText)
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
				console.log(e);//+" "+d.currentTarget.responseText);
				chrome.browserAction.setTitle({title: "Exception parsing user info. MtGox problem?"});
			}
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
	var t=(new Date()).getTime();
	req.open("POST", (useAPIv2 ? MtGoxAPI2BaseURL : "https://mtgox.com/api/0/")+path+"?t="+t, true); // Extra cache-busting...
	req.onerror = ef;
	req.onload = df;
	var data = "nonce="+(t*1000);
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
	req.open("GET",url);
	req.send();
}


function getemadif(idx) {
	var cel = emaLong[idx];
	var ces = emaShort[idx];
	return 100 * (ces-cel) / ((ces+cel)/2);
}

function getTrendAtIndex(i) {
	if ((H1.length<5)||(i<5)||(i>=H1.length)) {
		// All data not available
		return 0;
	}

	var trend=0;
	var dif1 = getemadif(i);
	if (dif1>0) {
		trend=1;
		if (dif1>MinBuyThreshold) {
			trend=2;
			var dif2 = getemadif(i-1);
			var dif3 = getemadif(i-2);
			var dif4 = getemadif(i-3);
			var dif5 = getemadif(i-4);
			if ((tickCountBuy==1) ||
					(tickCountBuy==2 && (dif2>MinBuyThreshold)) ||
					(tickCountBuy==3 && (dif2>MinBuyThreshold) && (dif3>MinBuyThreshold)) ||
					(tickCountBuy==4 && (dif2>MinBuyThreshold) && (dif3>MinBuyThreshold) && (dif4>MinBuyThreshold)) ||
					(tickCountBuy==5 && (dif2>MinBuyThreshold) && (dif3>MinBuyThreshold) && (dif4>MinBuyThreshold) && (dif5>MinBuyThreshold))) {
				trend=3;
			}
		}
	} else if (dif1<0) {
		trend=-1;
		if (dif1<-MinSellThreshold) {
			trend=-2;
			var dif2 = getemadif(i-1);
			var dif3 = getemadif(i-2);
			var dif4 = getemadif(i-3);
			var dif5 = getemadif(i-4);
			if ((tickCountSell==1) ||
					(tickCountSell==2 && (dif2<-MinSellThreshold)) ||
					(tickCountSell==3 && (dif2<-MinSellThreshold) && (dif3<-MinSellThreshold)) ||
					(tickCountSell==4 && (dif2<-MinSellThreshold) && (dif3<-MinSellThreshold) && (dif4<-MinSellThreshold)) ||
					(tickCountSell==5 && (dif2<-MinSellThreshold) && (dif3<-MinSellThreshold) && (dif4<-MinSellThreshold) && (dif5<-MinSellThreshold))) {
				trend=-3;
			}
		}
	}
	return trend;
}

function findLatestSolidTrend() {
	latestSolidTrend=0;
	for (var i=H1.length-2;i>=4;i--) {
		var trend=getTrendAtIndex(i);
		if (Math.abs(trend)==3) {
			latestSolidTrend=trend;
			break;
		}
	}
	log("Latest solid trend: "+(latestSolidTrend==3?"up":(latestSolidTrend==-3?"down":"none")));
}

function trade() {
/*
	if (simpleRulesMode==2) {
		// Not implemented yet...
	}
*/
	var keepBTCAmount=(keepBTCUnitIsPercentage==1?(BTC*keepBTC/100):keepBTC);
	var sellAmount = BTC - keepBTCAmount;
	var currentTrend=getTrendAtIndex(H1.length-1);

	if (currentTrend>1) {
		// Trend is up
		chrome.browserAction.setBadgeBackgroundColor({color:[0, 128, 0, 200]});

		if (currentTrend==3) {

			// Trend is up, also according to the "Buy after X samples"-setting

			if ((tradeOnlyAfterSwitch)&&(latestSolidTrend==3)) {
				// tradeOnlyAfterSwitch==true but the trend has not switched: Don't trade
				log("Trend has not switched (still up). The setting \"tradeOnlyAfterSwitch==true\", so do not trade...");
				return;
			}
			latestSolidTrend=3;

			if ((fiat>0) || ((inverseEMA==1)&&(sellAmount>0))) {
			//if (fiat>(Math.max(0,keepFiat))) {
				//var s = fiat - keepFiat;
				if ((tradingEnabled==1)&&(ApiKey!='')) {
					if (inverseEMA!=1) {
						// Normal EMA-strategy
						console.log("BUY! (EMA("+EmaShortPar+")/EMA("+EmaLongPar+")>"+MinBuyThreshold+"% for "+tickCountBuy+" or more ticks)");
						if (useAPIv2)
							mtgoxpost("BTC"+currency+"/money/order/add", ['type=bid','amount_int='+(1000*100000000).toString()], one, onl);
						else
							mtgoxpost("buyBTC.php", ['Currency='+currency,'amount=1000'], one, onl);
					} else {
						// Crazy Ivan!
						console.log("Crazy Ivan SELL "+sellAmount+" BTC!"+(keepBTC>0?" (keep "+(keepBTC.toString()+(keepBTCUnitIsPercentage==1?" %":" BTC"))+")":"")+" EMA("+EmaShortPar+")/EMA("+EmaLongPar+")>"+MinBuyThreshold+"% for "+tickCountBuy+" or more ticks");
						if (useAPIv2)
							mtgoxpost("BTC"+currency+"/money/order/add", ['type=ask','amount_int='+Math.round(sellAmount*100000000).toString()], one, onl);
						else
							mtgoxpost("sellBTC.php", ['Currency='+currency,'amount='+sellAmount.toString()], one, onl);
					}
				} else {
					// Simulation only
					if (inverseEMA!=1)
						console.log("Simulted BUY! EMA("+EmaShortPar+")/EMA("+EmaLongPar+")>"+MinBuyThreshold+"% for "+tickCountBuy+" or more ticks (Simulation only: no trade was made)");
					else
						console.log("Simulated Crazy Ivan SELL "+sellAmount+" BTC!"+(keepBTC>0?" (keep "+(keepBTC.toString()+(keepBTCUnitIsPercentage==1?" %":" BTC"))+")":"")+" EMA("+EmaShortPar+")/EMA("+EmaLongPar+")>"+MinBuyThreshold+"% for "+tickCountBuy+" or more ticks (Simulation only: no trade was made)");
				}
			} else {
				console.log("Trend is up, but no "+currency+" to spend...");
			}
		} else {
			console.log("Trend is up, but not for long enough (needs to be \"up\" for at least "+tickCountBuy+" samples)");
		}
	} else if (currentTrend<-1) {
		// Trend is down
		chrome.browserAction.setBadgeBackgroundColor({color:[128, 0, 0, 200]});
	
		if (currentTrend==-3) {
			// Trend is down, also according to the "Sell after X samples"-setting

			if ((tradeOnlyAfterSwitch)&&(latestSolidTrend==-3)) {
				// tradeOnlyAfterSwitch==true but the trend has not switched: Don't trade
				log("Trend has not switched (still down). The setting \"tradeOnlyAfterSwitch==true\", so do not trade...");
				return;
			}
			latestSolidTrend=-3;

			if ((sellAmount>0)||((inverseEMA==1)&&(fiat>0))) {
				if ((tradingEnabled==1)&&(ApiKey!='')) {
					if (inverseEMA!=1) {
						// Normal EMA-strategy
						console.log("SELL "+sellAmount+" BTC! (keep "+(keepBTC.toString()+(keepBTCUnitIsPercentage==1?" %":" BTC"))+") EMA("+EmaShortPar+")/EMA("+EmaLongPar+")<-"+MinSellThreshold+"% for "+tickCountSell+" or more ticks");
						if (useAPIv2)
							mtgoxpost("BTC"+currency+"/money/order/add", ['type=ask','amount_int='+Math.round(sellAmount*100000000).toString()], one, onl);
						else
							mtgoxpost("sellBTC.php", ['Currency='+currency,'amount='+sellAmount.toString()], one, onl);
					} else {
						// Crazy Ivan!
						console.log("Crazy Ivan BUY! (EMA("+EmaShortPar+")/EMA("+EmaLongPar+")<-"+MinSellThreshold+"% for "+tickCountSell+" or more ticks)");
						if (useAPIv2)
							mtgoxpost("BTC"+currency+"/money/order/add", ['type=bid','amount_int='+(1000*100000000).toString()], one, onl);
						else
							mtgoxpost("buyBTC.php", ['Currency='+currency,'amount=1000'], one, onl);
					}
				} else {
					// Simulation only
					if (inverseEMA!=1)
						console.log("Simulated SELL "+sellAmount+" BTC! (keep "+(keepBTC.toString()+(keepBTCUnitIsPercentage==1?" %":" BTC"))+") EMA("+EmaShortPar+")/EMA("+EmaLongPar+")<-"+MinSellThreshold+"% for "+tickCountSell+" or more ticks (Simulation only: no trade was made)");
					else
						console.log("Simulted Crazy Ivan BUY! EMA("+EmaShortPar+")/EMA("+EmaLongPar+")<-"+MinSellThreshold+"% for "+tickCountSell+" or more ticks (Simulation only: no trade was made)");
				}
			} else {
				console.log("Trend is down, but no BTC to sell...");
			}
		} else {
			console.log("Trend is down, but not for long enough (needs to be \"down\" for at least "+tickCountSell+" samples)");
		}
	} else {
		// Trend is undefined/weak
		if (currentTrend>0) {
			chrome.browserAction.setBadgeBackgroundColor({color:[10, 100, 10, 100]});
		} else {
			chrome.browserAction.setBadgeBackgroundColor({color:[100, 10, 10, 100]});
		}
	}
}

function refreshEMA(reset) {
	if (reset) {
		//console.log("refreshEMA(): reset EMA data (EMA/Thresholds/Interval has changed)");
		emaLong = [];
		emaShort = [];
	}
	if ((emaLong.length==0)||(emaShort.length==0)) {
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

	if ((emaShort.length<H1.length-1)||(emaLong.length<H1.length-1)) {
		//log("refreshEMA H1.length="+H1.length+" emaShort.length="+emaShort.length+" emaLong.length="+emaLong.length);
		reset=true;
	}

	updateEMA(emaLong, EmaLongPar);
	updateEMA(emaShort, EmaShortPar);

	if (reset)
		findLatestSolidTrend();

	if (updateInProgress) {
		chrome.browserAction.setBadgeText({text: "?"});
		console.log("Update not finished - do not trade!");
		return;
	}
	chrome.browserAction.setBadgeText({text: getemadif(H1.length-1).toFixed(2)});
	trade();
}

var origLog = console.log;
var log = console.log = function() {
		var t=new Date();
		var file="";
		var line="";
		try {
			var stack = new Error().stack;
    	file = stack.split("\n")[2].split("/")[3].split(":")[0];
    	line = stack.split("\n")[2].split("/")[3].split(":")[1];
    } catch (e) {}
    var args = [];
    args.push(dat2day(t.getTime())+" "+padit(t.getHours())+":"+padit(t.getMinutes())+":"+padit(t.getSeconds()));
    args.push("["+file + ":" + line+"]");
    // now add all the other arguments that were passed in:
    for (var _i = 0, _len = arguments.length; _i < _len; _i++) {
      arg = arguments[_i];
      args.push(arg);
    }
    // pass it all into the "real" log function
    origLog.apply(window.console, args);
}

Object.size = function(obj) {
	var size=0,key;
	for (key in obj)
		if (obj.hasOwnProperty(key))
			size++;
	return size;
}

function tidBinarySearch(trs,tid) {
	if ((trs.length<=1) || (tid<trs[1].tid) || (tid>trs[trs.length-1].tid))
		return -1;
	var l=1,u=trs.length,m;
	while (l<=u) {
		if (tid > parseInt(trs[(m=Math.floor((l+u)/2))].tid))
			l=m+1;
		else
			u=(tid==parseInt(trs[m].tid)) ? -2 : m-1;
	}
	return (u==-2) ? m : l;
}

function cacheOtherUsefulSamples(trs) {
	//log("generating usefulSamplePoints");
	// May not really be needed to generate this on every call, but to get the very latest sample points for long date durations, do it anyway (not very intensive)...
	var time_now=(new Date()).getTime();
	var usefulSamplePoints={};
	for (var j=0;j<validSampleIntervalMinutes.length;j++) {
		var minute_now = parseInt(time_now/(validSampleIntervalMinutes[j]*60*1000)) * validSampleIntervalMinutes[j]; // Fix trading samples to whole hours...
		var interval_minute_fetch = minute_now - (MaxSamplesToKeep*validSampleIntervalMinutes[j]);
		while(interval_minute_fetch<minute_now) {
			usefulSamplePoints[interval_minute_fetch.toString()]=1;
			interval_minute_fetch += validSampleIntervalMinutes[j];
		}
	}
	//log("Useful sample points generated (size="+Object.size(usefulSamplePoints)+")");

//	var found=0;
	try {
		for (var key in usefulSamplePoints) {
			var sample=localStorage.getItem("sample."+key);
			if ((!sample)||(sample=="null")) {
				var i=tidBinarySearch(trs,parseInt(key)*60*1000000);
				if (i!=-1) {
//					found++;
//					log("Sample should be cached. key="+key+" tid="+parseInt(trs[i].tid/60/1000000)+" lastTid="+parseInt(trs[i-1].tid/60/1000000)+" price="+trs[i].price);
					localStorage.setItem("sample."+key,trs[i].price);
				}
			}
		}
	} catch (e) {
		log("Exception in cacheOtherUsefulSamples(): "+e.stack);
	}
//	log("cacheOtherUsefulSamples() - done - found="+found);
}

function getNextMinuteFetch() {
	if (tim.length>0) {
		return (tim[tim.length-1] + tradingIntervalMinutes);
	} else {
		var minute_now = parseInt((new Date()).getTime() / (tradingIntervalMinutes*60*1000)) * tradingIntervalMinutes; // Fix trading samples to whole hours...
		return (minute_now - (MaxSamplesToKeep*tradingIntervalMinutes));
	}
}

function emptySampleCache() {
	log("emptySampleCache(): remove all cached samples");
	for (var key in localStorage) {
		if (key.indexOf("sample.")==0) {
			localStorage.removeItem(key);
		}
	}
}
//emptySampleCache(); // Only used when debugging...

function cleanSampleCache() {
	// Clean old, cached items from local storage
	//log("cleanSampleCache()");
	var minute_first = parseInt((new Date()).getTime()/(60*1000)) - (MaxSamplesToKeep+1)*(validSampleIntervalMinutes[validSampleIntervalMinutes.length-1]);
	for (var key in localStorage) {
		if (key.indexOf("sample.")==0) {
			var tid=parseInt(key.substring(7));
			if (tid<minute_first) {
				//log("cleanSampleCache(): removing old cached item (key="+key+")");
				localStorage.removeItem(key);
			}
		}
	}
}

function addSample(minuteFetch,price,nocache) {
	tim.push(minuteFetch);
	var f = parseFloat(price);
	var f0 = H1[H1.length-1];
	if (((f/9)>=f0) || ((f*9)<=f0)) { // strange peaks elimination - just keep old val // toli: factor 9 is better than 10...
		f=f0;
	}
	H1.push(f);

	if (nocache)
		return;

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

function getSamplesFromCache(minute_fetch, minute_now) {
	var sample=localStorage.getItem("sample."+minute_fetch);
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
	return minute_fetch;
}

var forceAbortTimer=null;
function forceAbort() {
	forceAbortTimer=null;
	if ((updateInProgress)&&(abortUpdateAndRedo)) {
		// Still not aborted: force!
		log("forceAbort(): Still not aborted: force!");
		updateInProgress=false;
		lastUpdateStartTime=0;
		updateH1(true);
	}
}

function updateH1(reset) { // Added "reset" parameter to clear the H1 data - should be called after changing settings that affects tradingInterval...
	var now=(new Date()).getTime();
	if ((updateInProgress)&&((lastUpdateStartTime==0)||(now-lastUpdateStartTime<30*1000))) {
		// Skip update if updateInProgress and no "long call" exists.
		// Unless reset==true - in that case, abort and re-update
		// Check abort status after 30 seconds and forst abort if still not 
		if (reset) {
			abortUpdateAndRedo=true;
			log("updateH1(): Reset while update in progress: abort current update");
			if (forceAbortTimer)
				clearTimeout(forceAbortTimer);
			forceAbortTimer=setTimeout(forceAbort,30*1000);
		}
		return;
	}

	updateInProgress = true;
	lastUpdateStartTime=(new Date()).getTime();

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

	var minute_now = parseInt(now / (tradingIntervalMinutes*60*1000)) * tradingIntervalMinutes; // Fix trading samples to whole hours...
	var minute_fetch=getNextMinuteFetch();
	if (minute_fetch > minute_now) {
		//log("Not yet time to fetch new samples...");
		updateInProgress = false;
		lastUpdateStartTime=0;
		return;
	}

	minute_fetch=getSamplesFromCache(minute_fetch, minute_now);
	if (minute_fetch <= minute_now) {
		// We are not done, and a sample did not exist in local storage: We need to start fetching from MtGox...

		// But first remove old, cached trades from local storage...
		cleanSampleCache();

		req = new XMLHttpRequest();
		var url, since;

		req.onerror = function(e) {
			if (abortUpdateAndRedo) {
				updateInProgress=false;
				lastUpdateStartTime=0;
				updateH1(true);
				return;
			}
			console.log("getTrades error", e, "-repeat");
			//lastUpdateStartTime=(new Date()).getTime();
			get_url(req, url);
		}

		req.onload = function() {
			if (abortUpdateAndRedo) {
				updateInProgress=false;
				lastUpdateStartTime=0;
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

					// Check if the chunk contains more any useful data
					minute_fetch=getNextMinuteFetch();
					var i=1;
					while ((i<trs.length)&&(minute_fetch <= minute_now)) {
						if (parseInt(trs[i].tid) > minute_fetch*60*1000000) {
							//log("Adding bonus sample from MtGox :) sample."+minute_fetch+" = "+trs[i].price);
							addSample(minute_fetch,trs[i].price);
							minute_fetch=getNextMinuteFetch();
						}
						i++;
					}
					cacheOtherUsefulSamples(trs);
				} else {
					log("Empty sample chunk from MtGox - no trades since minute_fetch="+minute_fetch);
					if (parseInt((new Date()).getTime()/(60*1000)) - minute_fetch < 5) {
						// The trade we where trying to fetch is less than 5 minutes old
						// => Probably no trades where made since then, so stop retrying...
						// This will happen a lot with short sample interval on a calm market, so abort the update to prevent hammering of MtGox
						//log("Aborting update (probably no trades have been made since minute_fetch)");
						updateInProgress=false;
						lastUpdateStartTime=0;
						refreshPopup(true);
						return;
					}
					// Empty chunk of old data => Probably MtGox error!
					// Go on with next sample (otherwise we might get stuck here)
					//minute_fetch=getNextMinuteFetch();
					minute_fetch+=tradingIntervalMinutes;
				}

				// Check if next sample(s) exist in cache
				minute_fetch=getSamplesFromCache(minute_fetch, minute_now);
				if (minute_fetch <= minute_now) {
					// We are not done, but a sample did not exist in local storage: We need to fetch more samples from MtGox...
					lastUpdateStartTime=(new Date()).getTime();
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
				var error=req.responseText;
				if (error.indexOf("Website is currently unreachable")!=-1) {
					error="MtGox says: Website is currently unreachable";
				}
				log("getTrades JSON error", e, error);
				chrome.browserAction.setBadgeText({text: "?"});
			}

			if (done) {
				updateInProgress = false;
				lastUpdateStartTime=0;
			}
			if (refr)
				refreshEMA(reset);

			refreshPopup(refr);
		}

		//log("Fetching sample from MtGox: minute_fetch="+minute_fetch);
		lastUpdateStartTime=(new Date()).getTime();
		getSampleFromMtGox(req,minute_fetch);
	} else {
		// Done, and all samples where loaded from local storage...
		log("Got new samples (all loaded from cache) "+H1.length+" "+MaxSamplesToKeep);
		updateInProgress = false;
		lastUpdateStartTime=0;
		refreshEMA(reset);
		bootstrap = 0;
		refreshPopup(true);
	}
}

console.log("Using MtGox API v"+(useAPIv2?"2":"0"));
chrome.browserAction.setBadgeBackgroundColor({color:[128, 128, 128, 50]});
schedUpdateInfo(100);
setTimeout(function(){updateH1(false);}, 2*1000); 	// Delay first updateH1() to allow user info to be fetched first...
setInterval(function(){updateH1(false);}, 60*1000); // Recheck every minute (should be a multiple of any trading interval)

/*
function onErr(e) {
	log("getTrades post error", e);
}
function onLod(d) {
	log("getTrades post ok", d.currentTarget.responseText);
}
setTimeout(function(){
	mtgoxpost("money/wallet/history", ['currency=USD'], onErr, onLod);
	mtgoxpost("BTCUSD/money/info", [], onErr, onLod);
},1000);
*/
